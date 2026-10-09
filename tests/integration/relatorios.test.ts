/** Fase 8: pedido de relatório, fila, snapshot e PDF com todas as seções (CA-70). */
import { randomUUID } from "node:crypto";

import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import { jsonCanonico, sha256Hex } from "@/lib/relatorios/integridade";
import { DocumentoRelatorio, VERSAO_TEMPLATE } from "@/lib/relatorios/pdf/documento";
import { snapshotSchema } from "@/lib/relatorios/snapshot";

import {
  comoAtor,
  encerrarPool,
  SQLSTATE,
  serviceRole,
  superusuario,
  usuario,
  type Sessao,
} from "../support/db";
import { A, B, EMPRESA_A, USUARIOS } from "../support/fixtures";

afterAll(encerrarPool);

const admin = usuario(USUARIOS.adminA);

async function pedir(s: Sessao, tipo: string, alvo: string, extra = "") {
  const [r] = await s.query<{ id: string }>(
    `select public.rpc_solicitar_relatorio($1::public.tipo_relatorio, $2, p_versao_template => $3${extra}) id`,
    [tipo, alvo, VERSAO_TEMPLATE],
  );
  return r?.id as string;
}

/** Texto de todas as páginas e quantidade de imagens desenhadas. */
async function lerPdf(pdf: Uint8Array) {
  const doc = await getDocument({
    data: pdf,
    useSystemFonts: false,
    standardFontDataUrl: `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`,
  }).promise;
  let texto = "";
  let imagens = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    texto += conteudo.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
    const ops = await pagina.getOperatorList();
    imagens += ops.fnArray.filter((f) => f === OPS.paintImageXObject).length;
  }
  return { texto: texto.replace(/\s+/g, " "), paginas: doc.numPages, imagens };
}

describe("pedido de relatório (RN-110..112)", () => {
  it("enfileira PENDENTE com código, decide 'incluir valores' no servidor e audita", async () => {
    await comoAtor(admin, async (s) => {
      const id = await pedir(s, "LOCACAO", A.locacaoAtiva);
      const [r] = await s.query<{
        status: string;
        codigo: string;
        parametros: { incluir_valores: boolean };
      }>("select status, codigo, parametros from public.relatorios where id = $1", [id]);
      expect(r).toMatchObject({ status: "PENDENTE", parametros: { incluir_valores: true } });
      expect(r?.codigo).toMatch(/^REL-\d{6}$/);
      await s.como(superusuario);
      const [a] = await s.query<{ n: string }>(
        "select count(*)::text n from public.auditoria where entidade_id = $1 and acao = 'relatorio.solicitar'",
        [id],
      );
      expect(a?.n).toBe("1");
    });
  });

  it("recusa alvo de outra empresa, perfil sem permissão e escrita/fila diretas", async () => {
    await comoAtor(usuario(USUARIOS.adminB), async (s) => {
      const r = await s.tentar(
        "select public.rpc_solicitar_relatorio('LOCACAO', $1, p_versao_template => 'x')",
        [A.locacaoAtiva],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.naoEncontrado);
    });
    await comoAtor(usuario(USUARIOS.responsavelA), async (s) => {
      const r = await s.tentar(
        "select public.rpc_solicitar_relatorio('BEM', $1, p_versao_template => 'x')",
        [A.bemEstacao1],
      );
      expect(r.ok).toBe(false);
    });
    await comoAtor(admin, async (s) => {
      for (const sql of [
        "select public.relatorio_reivindicar()",
        `select public.relatorio_snapshot('${randomUUID()}')`,
        `insert into public.relatorios (empresa_id, codigo, tipo, parametros, solicitado_por, versao_template)
         values ('${EMPRESA_A}', '', 'LOCACAO', '{}', '${USUARIOS.adminA}', 'x')`,
      ]) {
        const r = await s.tentar(sql);
        expect(r.ok, sql).toBe(false);
        if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
      }
    });
  });

  it("período exige intervalo válido de até 1 ano e o alvo é a própria empresa", async () => {
    await comoAtor(admin, async (s) => {
      const invertido = await s.tentar(
        "select public.rpc_solicitar_relatorio('PERIODO', $1, current_date, current_date - 1, 'x')",
        [EMPRESA_A],
      );
      expect(invertido.ok).toBe(false);
      const outra = await s.tentar(
        "select public.rpc_solicitar_relatorio('PERIODO', $1, current_date - 30, current_date, 'x')",
        [B.locacaoAtiva],
      );
      expect(outra.ok).toBe(false);
      const ok = await s.tentar(
        "select public.rpc_solicitar_relatorio('PERIODO', $1, current_date - 30, current_date, 'x')",
        [EMPRESA_A],
      );
      expect(ok.ok).toBe(true);
    });
  });

  it("fila: reivindica um job por vez; watchdog marca ERRO e tenta de novo (máx. 3)", async () => {
    await comoAtor(admin, async (s) => {
      const id = await pedir(s, "BEM", A.bemEstacao1);
      await s.como(serviceRole);
      const [job] = await s.query<{ id: string; status: string; tentativas: number }>(
        "select id, status, tentativas from public.relatorio_reivindicar() where id is not null",
      );
      expect(job).toMatchObject({ id, status: "PROCESSANDO", tentativas: 1 });
      await s.como(superusuario);
      await s.query(
        "update public.relatorios set iniciado_em = now() - interval '11 minutes', updated_at = now() - interval '1 minute' where id = $1",
        [id],
      );
      await s.como(serviceRole);
      await s.query("select public.relatorio_reivindicar()");
      const [depois] = await s.query<{ status: string; tentativas: number; erro: string | null }>(
        "select status, tentativas, erro from public.relatorios where id = $1",
        [id],
      );
      // Mesma chamada: watchdog → ERRO; ERRO recente ainda não volta à fila.
      expect(depois).toMatchObject({ status: "ERRO", erro: "Tempo de processamento esgotado" });
    });
  });
});

describe("PDF do relatório de locação (CA-70)", () => {
  it("contém todas as seções, fotos com legenda, versão, data, gerador e hash", async () => {
    await comoAtor(admin, async (s) => {
      // Foto real (via função de domínio) ligada ao bem, para a seção de fotografias.
      const caminhoFoto = `${EMPRESA_A}/bem/${A.bemEstacao1}/${randomUUID()}.jpg`;
      await s.query(
        `select public.rpc_registrar_evidencia('BEM', $1, 'FOTO', $2, 'image/jpeg', 100, $3)`,
        [A.bemEstacao1, caminhoFoto, "f".repeat(64)],
      );
      const id = await pedir(s, "LOCACAO", A.locacaoAtiva);
      await s.como(serviceRole);
      await s.query("select public.relatorio_reivindicar()");
      const [linha] = await s.query<{ snap: unknown }>(
        "select public.relatorio_snapshot($1) snap",
        [id],
      );
      const snapshot = snapshotSchema.parse(linha?.snap);
      // O banco local pode ter fotos de execuções E2E; a recém-registrada tem de estar lá.
      expect(snapshot.evidencias.map((e) => e.storage_path)).toContain(caminhoFoto);
      const hashDados = sha256Hex(jsonCanonico(linha?.snap));
      const jpeg = await sharp({
        create: { width: 64, height: 48, channels: 3, background: "#c04020" },
      })
        .jpeg()
        .toBuffer();
      const pdf = await renderToBuffer(
        DocumentoRelatorio({
          snapshot,
          hashDados,
          geradoEm: new Date().toISOString(),
          fotos: snapshot.evidencias.map((evidencia) => ({ evidencia, jpeg })),
        }),
      );
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      const { texto, imagens } = await lerPdf(new Uint8Array(pdf));
      for (const trecho of [
        "Relatório da locação LOC-000002",
        "Identificação e estado",
        "Estado operacional",
        "Estado financeiro",
        "Referências Sectra",
        "4500012345",
        "Fornecedor, centro de custo e vigência",
        "TopoLoc",
        "Itens contratados, recebidos, devolvidos e saldo",
        "Fichas dos bens e lotes",
        "TS07-1001",
        "Recebimentos",
        "Checklists e vistorias",
        "Estado geral do equipamento",
        "Movimentações",
        "Ocorrências",
        "Devoluções e comprovantes",
        "Estado financeiro e cobranças",
        "Fotografias",
        "Ficha do bem · Item BEM-000001",
        "Por: [DEMO] Ana Admin (A)",
        VERSAO_TEMPLATE,
        "[DEMO] Ana Admin (A)",
      ]) {
        expect(texto, trecho).toContain(trecho);
      }
      // Hash longo pode quebrar de linha: compara sem espaços.
      expect(texto.replace(/\s/g, "")).toContain(hashDados);
      expect(imagens).toBeGreaterThanOrEqual(1);
    });
  });

  it("hash dos dados é estável para o mesmo snapshot e muda quando os dados mudam", async () => {
    await comoAtor(admin, async (s) => {
      const id = await pedir(s, "LOCACAO", A.locacaoAtiva);
      await s.como(serviceRole);
      const snap = async () =>
        (await s.query<{ snap: unknown }>("select public.relatorio_snapshot($1) snap", [id]))[0]
          ?.snap;
      const h1 = sha256Hex(jsonCanonico(await snap()));
      expect(sha256Hex(jsonCanonico(await snap()))).toBe(h1);
      await s.como(superusuario);
      await s.query("update public.locacoes set observacoes = 'alterada' where id = $1", [
        A.locacaoAtiva,
      ]);
      await s.como(serviceRole);
      expect(sha256Hex(jsonCanonico(await snap()))).not.toBe(h1);
    });
  });
});
