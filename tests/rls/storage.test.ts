/**
 * Storage privado (RN-90..RN-95, D-07): leitura só de objetos vinculados a
 * evidências/relatórios visíveis ao usuário; escrita nunca por usuário.
 */
import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import {
  comoAtor,
  encerrarPool,
  SQLSTATE,
  superusuario,
  usuario,
  type Sessao,
} from "../support/db";
import { A, B, EMPRESA_A, EMPRESA_B, USUARIOS } from "../support/fixtures";

afterAll(encerrarPool);

const HASH = "a".repeat(64);

/** Cria (como superusuário, simulando o servidor) objeto + linha de evidência. */
async function criarEvidencia(
  s: Sessao,
  empresa: string,
  entidade: "BEM" | "LOCACAO",
  entidadeId: string,
  enviadaPor: string,
): Promise<string> {
  const caminho = `${empresa}/${entidade.toLowerCase()}/${entidadeId}/${randomUUID()}.jpg`;
  await s.query("insert into storage.objects (bucket_id, name) values ('evidencias', $1)", [
    caminho,
  ]);
  await s.query(
    `insert into public.evidencias (empresa_id, entidade_tipo, entidade_id, tipo, bucket, storage_path,
       mime_type, tamanho_bytes, hash_arquivo, enviada_por)
     values ($1, $2, $3, 'FOTO', 'evidencias', $4, 'image/jpeg', 1024, $5, $6)`,
    [empresa, entidade, entidadeId, caminho, HASH, enviadaPor],
  );
  return caminho;
}

async function objetosVisiveis(s: Sessao): Promise<string[]> {
  const linhas = await s.query<{ name: string }>("select name from storage.objects order by name");
  return linhas.map((l) => l.name);
}

describe("storage privado", () => {
  it("usuário autenticado não grava, não altera e não apaga objetos", async () => {
    await comoAtor(superusuario, async (s) => {
      const caminho = await criarEvidencia(s, EMPRESA_A, "BEM", A.bemEstacao1, USUARIOS.operacaoA);
      await s.como(usuario(USUARIOS.adminA));
      const ins = await s.tentar(
        "insert into storage.objects (bucket_id, name) values ('evidencias', $1)",
        [`${EMPRESA_A}/bem/${A.bemEstacao1}/${randomUUID()}.jpg`],
      );
      expect(ins.ok).toBe(false);
      if (!ins.ok) expect(ins.codigo).toBe(SQLSTATE.privilegioInsuficiente);
      const upd = await s.tentar("update storage.objects set name = name || 'x' where name = $1", [
        caminho,
      ]);
      expect(upd.ok && upd.rowCount).toBe(0);
      const del = await s.tentar("delete from storage.objects where name = $1", [caminho]);
      expect(del.ok && del.rowCount).toBe(0);
    });
  });

  it("usuário da mesma empresa lê o objeto; outra empresa e anônimo não", async () => {
    await comoAtor(superusuario, async (s) => {
      const caminho = await criarEvidencia(s, EMPRESA_A, "BEM", A.bemEstacao2, USUARIOS.operacaoA);

      await s.como(usuario(USUARIOS.gestorA));
      expect(await objetosVisiveis(s)).toContain(caminho);

      await s.como(usuario(USUARIOS.adminB));
      expect(await objetosVisiveis(s)).not.toContain(caminho);

      await s.como(usuario(USUARIOS.inativoA));
      expect(await objetosVisiveis(s)).toEqual([]);

      await s.como({ tipo: "anon" });
      expect(await objetosVisiveis(s)).toEqual([]);
    });
  });

  it("objeto sem linha de evidência não é visível para ninguém (upload órfão)", async () => {
    await comoAtor(superusuario, async (s) => {
      const orfao = `${EMPRESA_A}/bem/${A.bemEstacao1}/${randomUUID()}.jpg`;
      await s.query("insert into storage.objects (bucket_id, name) values ('evidencias', $1)", [
        orfao,
      ]);
      await s.como(usuario(USUARIOS.adminA));
      expect(await objetosVisiveis(s)).not.toContain(orfao);
    });
  });

  it("responsável local vê a foto do próprio bem, mas não a de outro bem", async () => {
    await comoAtor(superusuario, async (s) => {
      const doBem1 = await criarEvidencia(s, EMPRESA_A, "BEM", A.bemEstacao1, USUARIOS.operacaoA);
      const doBem2 = await criarEvidencia(s, EMPRESA_A, "BEM", A.bemEstacao2, USUARIOS.operacaoA);
      const daLocacao = await criarEvidencia(
        s,
        EMPRESA_A,
        "LOCACAO",
        A.locacaoAtiva,
        USUARIOS.comprasA,
      );
      await s.como(usuario(USUARIOS.responsavelA));
      const visiveis = await objetosVisiveis(s);
      expect(visiveis).toContain(doBem1);
      expect(visiveis).not.toContain(doBem2);
      expect(visiveis).not.toContain(daLocacao);
      const evidencias = await s.query<{ entidade_id: string }>(
        "select entidade_id from public.evidencias",
      );
      expect(evidencias.map((e) => e.entidade_id)).toEqual([A.bemEstacao1]);
    });
  });

  it("relatório só é legível quando CONCLUIDO e pela empresa dona", async () => {
    await comoAtor(superusuario, async (s) => {
      const caminho = `${EMPRESA_A}/relatorio/${randomUUID()}.pdf`;
      await s.query("insert into storage.objects (bucket_id, name) values ('relatorios', $1)", [
        caminho,
      ]);
      const [rel] = await s.query<{ id: string }>(
        `insert into public.relatorios (empresa_id, tipo, parametros, solicitado_por, versao_template)
         values ($1, 'LOCACAO', '{}', $2, 'v1') returning id`,
        [EMPRESA_A, USUARIOS.gestorA],
      );
      await s.query(
        "update public.relatorios set status = 'PROCESSANDO', iniciado_em = now() where id = $1",
        [rel?.id],
      );
      await s.como(usuario(USUARIOS.gestorA));
      expect(await objetosVisiveis(s)).not.toContain(caminho);

      await s.como(superusuario);
      await s.query(
        `update public.relatorios set status = 'CONCLUIDO', storage_path = $2, hash_arquivo = $3,
           hash_dados = $3, assinatura_hmac = $3, concluido_em = now() where id = $1`,
        [rel?.id, caminho, HASH],
      );
      await s.como(usuario(USUARIOS.gestorA));
      expect(await objetosVisiveis(s)).toContain(caminho);
      await s.como(usuario(USUARIOS.adminB));
      expect(await objetosVisiveis(s)).not.toContain(caminho);
    });
  });

  it("evidência não pode apontar para entidade de outra empresa nem caminho de outra empresa", async () => {
    await comoAtor(superusuario, async (s) => {
      const caminhoB = `${EMPRESA_B}/bem/${B.bemGerador}/${randomUUID()}.jpg`;
      const r1 = await s.tentar(
        `insert into public.evidencias (empresa_id, entidade_tipo, entidade_id, tipo, bucket, storage_path,
           mime_type, tamanho_bytes, hash_arquivo, enviada_por)
         values ($1, 'BEM', $2, 'FOTO', 'evidencias', $3, 'image/jpeg', 10, $4, $5)`,
        [EMPRESA_A, B.bemGerador, caminhoB, HASH, USUARIOS.operacaoA],
      );
      expect(r1.ok).toBe(false);
      const caminhoA = `${EMPRESA_A}/bem/${B.bemGerador}/${randomUUID()}.jpg`;
      const r2 = await s.tentar(
        `insert into public.evidencias (empresa_id, entidade_tipo, entidade_id, tipo, bucket, storage_path,
           mime_type, tamanho_bytes, hash_arquivo, enviada_por)
         values ($1, 'BEM', $2, 'FOTO', 'evidencias', $3, 'image/jpeg', 10, $4, $5)`,
        [EMPRESA_A, B.bemGerador, caminhoA, HASH, USUARIOS.operacaoA],
      );
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.codigo).toBe(SQLSTATE.violacaoFk);
    });
  });

  it("banco não aceita URL (assinada ou não) no lugar do storage_path", async () => {
    await comoAtor(superusuario, async (s) => {
      const r = await s.tentar(
        `insert into public.evidencias (empresa_id, entidade_tipo, entidade_id, tipo, bucket, storage_path,
           mime_type, tamanho_bytes, hash_arquivo, enviada_por)
         values ($1, 'BEM', $2, 'FOTO', 'evidencias',
           'https://x.supabase.co/storage/v1/object/sign/evidencias/a.jpg?token=abc', 'image/jpeg', 10, $3, $4)`,
        [EMPRESA_A, A.bemEstacao1, HASH, USUARIOS.operacaoA],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.violacaoCheck);
    });
  });
});
