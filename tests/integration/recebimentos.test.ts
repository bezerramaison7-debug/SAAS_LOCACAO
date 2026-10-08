/** Fase 5: recebimento transacional, vistoria de entrada e evidências (funções de domínio). */
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
import { A, EMPRESA_A, USUARIOS } from "../support/fixtures";

afterAll(encerrarPool);

const operacao = usuario(USUARIOS.operacaoA);
const compras = usuario(USUARIOS.comprasA);
const admin = usuario(USUARIOS.adminA);
const HASH = "a".repeat(64);

async function novoRascunho(s: Sessao, completo = true): Promise<string> {
  const [r] = await s.query<{ id: string }>(
    completo
      ? `insert into public.recebimentos (empresa_id, locacao_id, data_evento, local_id, responsavel_id)
         values ($1, $2, now() - interval '1 hour', $3, $4) returning id`
      : "insert into public.recebimentos (empresa_id, locacao_id) values ($1, $2) returning id",
    completo
      ? [EMPRESA_A, A.locacaoAtiva, A.localObra1, USUARIOS.responsavelA]
      : [EMPRESA_A, A.locacaoAtiva],
  );
  return r?.id as string;
}

async function linhaDoBem(s: Sessao, bem: string): Promise<string> {
  const [l] = await s.query<{ id: string }>(
    "select id from public.itens_recebimento where bem_id = $1",
    [bem],
  );
  return l?.id as string;
}

async function linhaDoLote(s: Sessao, recebimento: string): Promise<string> {
  const [l] = await s.query<{ id: string }>(
    "select id from public.itens_recebimento where recebimento_id = $1 and bem_id is null",
    [recebimento],
  );
  return l?.id as string;
}

async function foto(
  s: Sessao,
  entidadeTipo: string,
  entidadeId: string,
  pergunta: string | null = null,
): Promise<string> {
  const pasta = entidadeTipo.toLowerCase();
  const [e] = await s.query<{ id: string }>(
    `select public.rpc_registrar_evidencia($1::public.entidade_evidencia, $2, 'FOTO', $3, 'image/jpeg', 1024, $4,
       p_pergunta => $5) as id`,
    [
      entidadeTipo,
      entidadeId,
      `${EMPRESA_A}/${pasta}/${entidadeId}/${randomUUID()}.jpg`,
      HASH,
      pergunta,
    ],
  );
  return e?.id as string;
}

/** Vistoria de entrada respondida e com a foto obrigatória (pergunta 1: foto SEMPRE). */
async function vistoriaCompleta(s: Sessao, linha: string): Promise<string> {
  const [v] = await s.query<{ id: string }>(
    "select public.rpc_iniciar_vistoria_entrada($1) as id",
    [linha],
  );
  const id = v?.id as string;
  const perguntas = await s.query<{ id: string; ordem: number }>(
    `select p.id, p.ordem from public.perguntas_checklist p join public.vistorias v on v.modelo_id = p.modelo_id
     where v.id = $1 order by p.ordem`,
    [id],
  );
  const respostas = ['"CONFORME"', '"SIM"', '"Completos"'];
  for (const [i, p] of perguntas.entries()) {
    await s.query(
      "insert into public.respostas_vistoria (empresa_id, vistoria_id, pergunta_id, resposta_json) values ($1, $2, $3, $4)",
      [EMPRESA_A, id, p.id, respostas[i]],
    );
  }
  await foto(s, "VISTORIA", id, perguntas[0]?.id ?? null);
  return id;
}

async function semChecklist(s: Sessao) {
  await s.como(superusuario);
  await s.query(
    "update public.categorias_bem set checklist_familia_id = null where empresa_id = $1",
    [EMPRESA_A],
  );
}

describe("recebimento: rascunho e confirmação (RN-20..RN-27)", () => {
  it("rascunho vazio lista pendências e não confirma", async () => {
    await comoAtor(operacao, async (s) => {
      const id = await novoRascunho(s, false);
      const [p] = await s.query<{ p: string[] }>("select public.pendencias_recebimento($1) p", [
        id,
      ]);
      expect(p?.p).toEqual([
        "Informe a data e a hora do recebimento",
        "Informe o local onde os itens ficarão",
        "Informe o responsável pelos itens",
        "Inclua ao menos um item recebido",
      ]);
      const r = await s.tentar("select public.rpc_confirmar_recebimento($1)", [id]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.parametroInvalido);
    });
  });

  it("recebimento parcial completo: bem disponível, lote novo, vistorias concluídas e saldo (CA-20)", async () => {
    await comoAtor(operacao, async (s) => {
      const id = await novoRascunho(s);
      const [b] = await s.query<{ id: string }>(
        "select public.rpc_adicionar_bem_recebimento($1, $2, p_numero_serie => 'TS07-9001') id",
        [id, A.itemEstacao],
      );
      const bem = b?.id as string;
      await s.query("select public.rpc_definir_lote_recebimento($1, $2, 30)", [id, A.itemAndaime]);

      // Checklist obrigatório (categoria com família publicada) e foto exigida.
      const [antes] = await s.query<{ p: string[] }>("select public.pendencias_recebimento($1) p", [
        id,
      ]);
      expect(antes?.p.some((x) => x.includes("faça a vistoria de entrada"))).toBe(true);

      const vBem = await vistoriaCompleta(s, await linhaDoBem(s, bem));
      const vLote = await vistoriaCompleta(s, await linhaDoLote(s, id));
      const [st] = await s.query<{ s: string }>("select public.rpc_confirmar_recebimento($1) s", [
        id,
      ]);
      expect(st?.s).toBe("CONFIRMADO");

      const [bemDepois] = await s.query<Record<string, string>>(
        "select status, local_atual_id, responsavel_atual_id from public.bens where id = $1",
        [bem],
      );
      expect(bemDepois).toEqual({
        status: "DISPONIVEL",
        local_atual_id: A.localObra1,
        responsavel_atual_id: USUARIOS.responsavelA,
      });
      const [lote] = await s.query<{ saldo: string; id: string }>(
        "select l.id, l.saldo::text saldo from public.lotes l where l.recebimento_id = $1",
        [id],
      );
      expect(lote?.saldo).toBe("30.000");
      const vistorias = await s.query<{
        id: string;
        status: string;
        bem_id: string;
        lote_id: string;
      }>(
        "select id, status, bem_id, lote_id from public.vistorias where id = any($1) order by bem_id nulls last",
        [[vBem, vLote]],
      );
      expect(vistorias).toEqual([
        { id: vBem, status: "CONCLUIDA", bem_id: bem, lote_id: null },
        { id: vLote, status: "CONCLUIDA", bem_id: null, lote_id: lote?.id },
      ]);
      const [saldo] = await s.query<{ recebida: string; a_receber: string }>(
        `select quantidade_recebida::text recebida, (quantidade_contratada - quantidade_recebida)::text a_receber
         from public.v_saldo_item_locacao where item_locacao_id = $1`,
        [A.itemAndaime],
      );
      expect(saldo).toEqual({ recebida: "90.000", a_receber: "10.000" });

      // Confirmado: imutável pelas funções do rascunho e com auditoria.
      const depois = await s.tentar("select public.rpc_definir_lote_recebimento($1, $2, 1)", [
        id,
        A.itemAndaime,
      ]);
      expect(depois.ok).toBe(false);
      const respostaNova = await s.tentar(
        "update public.respostas_vistoria set resposta_json = '\"NAO_CONFORME\"' where vistoria_id = $1",
        [vBem],
      );
      expect(respostaNova.ok).toBe(false);
      await s.como(superusuario);
      const aud = await s.query(
        "select 1 from public.auditoria where acao = 'recebimento.confirmar' and entidade_id = $1",
        [id],
      );
      expect(aud).toHaveLength(1);
    });
  });

  it("identificação exigida pela categoria e foto de item avariado (RN-23, RN-27)", async () => {
    await comoAtor(operacao, async (s) => {
      await semChecklist(s);
      await s.como(operacao);
      const id = await novoRascunho(s);
      const [b] = await s.query<{ id: string }>(
        "select public.rpc_adicionar_bem_recebimento($1, $2, p_condicao => 'AVARIADO', p_observacao => 'Visor riscado') id",
        [id, A.itemEstacao],
      );
      const [p] = await s.query<{ p: string[] }>("select public.pendencias_recebimento($1) p", [
        id,
      ]);
      expect(p?.p.some((x) => x.endsWith("informe o número de série"))).toBe(true);
      expect(p?.p.some((x) => x.endsWith("item avariado exige foto"))).toBe(true);

      await s.query("update public.bens set numero_serie = 'TS07-9002' where id = $1", [b?.id]);
      await foto(s, "ITEM_RECEBIMENTO", await linhaDoBem(s, b?.id as string));
      await s.query("select public.rpc_confirmar_recebimento($1)", [id]);
      const [o] = await s.query<{ tipo: string; status: string; descricao: string }>(
        "select tipo, status, descricao from public.ocorrencias where recebimento_id = $1",
        [id],
      );
      expect(o?.tipo).toBe("AVARIA");
      expect(o?.status).toBe("ABERTA");
      expect(o?.descricao).toContain("Visor riscado");
    });
  });

  it("excesso exige autorização de Compras e gera ocorrência DIVERGENCIA_QUANTIDADE (RN-25)", async () => {
    await comoAtor(operacao, async (s) => {
      await semChecklist(s);
      await s.como(operacao);
      const id = await novoRascunho(s);
      for (const serie of ["TS07-9101", "TS07-9102"]) {
        await s.query("select public.rpc_adicionar_bem_recebimento($1, $2, p_numero_serie => $3)", [
          id,
          A.itemEstacao,
          serie,
        ]);
      }
      const excesso = await s.query<{ excesso: string }>(
        "select excesso::numeric::text excesso from public.excesso_recebimento($1)",
        [id],
      );
      expect(excesso).toEqual([{ excesso: "1.000" }]);
      const [st] = await s.query<{ s: string }>("select public.rpc_confirmar_recebimento($1) s", [
        id,
      ]);
      expect(st?.s).toBe("AGUARDANDO_AUTORIZACAO");

      const semPermissao = await s.tentar(
        "select public.rpc_autorizar_excesso($1, 'Recebido a mais por engano')",
        [id],
      );
      expect(semPermissao.ok).toBe(false);
      if (!semPermissao.ok) expect(semPermissao.codigo).toBe(SQLSTATE.privilegioInsuficiente);

      await s.como(compras);
      const curta = await s.tentar("select public.rpc_autorizar_excesso($1, 'ok')", [id]);
      expect(curta.ok).toBe(false);
      await s.query(
        "select public.rpc_autorizar_excesso($1, 'Fornecedor enviou unidade reserva sem custo')",
        [id],
      );
      await s.como(superusuario);
      const [r] = await s.query<{ status: string; excesso_autorizado_por: string }>(
        "select status, excesso_autorizado_por from public.recebimentos where id = $1",
        [id],
      );
      expect(r).toEqual({ status: "CONFIRMADO", excesso_autorizado_por: USUARIOS.comprasA });
      const [o] = await s.query<{ tipo: string; quantidade: string }>(
        "select tipo, quantidade::text from public.ocorrencias where recebimento_id = $1",
        [id],
      );
      expect(o).toEqual({ tipo: "DIVERGENCIA_QUANTIDADE", quantidade: "1.000" });
    });
  });

  it("aguardando autorização pode voltar ao rascunho para correção", async () => {
    await comoAtor(operacao, async (s) => {
      await semChecklist(s);
      await s.como(operacao);
      const id = await novoRascunho(s);
      await s.query("select public.rpc_definir_lote_recebimento($1, $2, 41)", [id, A.itemAndaime]);
      const [st] = await s.query<{ s: string }>("select public.rpc_confirmar_recebimento($1) s", [
        id,
      ]);
      expect(st?.s).toBe("AGUARDANDO_AUTORIZACAO");
      // Bloqueado para edição enquanto aguarda.
      const edicao = await s.tentar("select public.rpc_definir_lote_recebimento($1, $2, 40)", [
        id,
        A.itemAndaime,
      ]);
      expect(edicao.ok).toBe(false);
      await s.query("select public.rpc_reabrir_recebimento($1)", [id]);
      await s.query("select public.rpc_definir_lote_recebimento($1, $2, 40)", [id, A.itemAndaime]);
      const [ok] = await s.query<{ s: string }>("select public.rpc_confirmar_recebimento($1) s", [
        id,
      ]);
      expect(ok?.s).toBe("CONFIRMADO");
    });
  });

  it("remover linha cancela o bem e a vistoria do rascunho", async () => {
    await comoAtor(operacao, async (s) => {
      const id = await novoRascunho(s);
      const [b] = await s.query<{ id: string }>(
        "select public.rpc_adicionar_bem_recebimento($1, $2, p_numero_serie => 'X-1') id",
        [id, A.itemEstacao],
      );
      const linha = await linhaDoBem(s, b?.id as string);
      const [v] = await s.query<{ id: string }>(
        "select public.rpc_iniciar_vistoria_entrada($1) id",
        [linha],
      );
      await s.query("select public.rpc_remover_linha_recebimento($1)", [linha]);
      const [bem] = await s.query<{ status: string }>(
        "select status from public.bens where id = $1",
        [b?.id],
      );
      expect(bem?.status).toBe("CANCELADO");
      const [vist] = await s.query<{ status: string }>(
        "select status from public.vistorias where id = $1",
        [v?.id],
      );
      expect(vist?.status).toBe("CANCELADA");
    });
  });

  it("descarte: só o autor ou ADMIN, com motivo", async () => {
    await comoAtor(operacao, async (s) => {
      const id = await novoRascunho(s);
      await s.como(compras);
      const outro = await s.tentar(
        "select public.rpc_descartar_recebimento($1, 'Lançado em duplicidade')",
        [id],
      );
      expect(outro.ok).toBe(false);
      await s.como(operacao);
      const curto = await s.tentar("select public.rpc_descartar_recebimento($1, 'dup')", [id]);
      expect(curto.ok).toBe(false);
      await s.query("select public.rpc_descartar_recebimento($1, 'Lançado em duplicidade')", [id]);
      const [r] = await s.query<{ status: string }>(
        "select status from public.recebimentos where id = $1",
        [id],
      );
      expect(r?.status).toBe("CANCELADO");
    });
  });

  it("cancelamento de confirmado: só ADMIN e sem eventos posteriores (RN-28)", async () => {
    await comoAtor(operacao, async (s) => {
      await semChecklist(s);
      await s.como(operacao);
      const id = await novoRascunho(s);
      await s.query("select public.rpc_definir_lote_recebimento($1, $2, 10)", [id, A.itemAndaime]);
      await s.query("select public.rpc_confirmar_recebimento($1)", [id]);
      const naoAdmin = await s.tentar(
        "select public.rpc_cancelar_recebimento_confirmado($1, 'Recebimento lançado errado')",
        [id],
      );
      expect(naoAdmin.ok).toBe(false);
      if (!naoAdmin.ok) expect(naoAdmin.codigo).toBe(SQLSTATE.privilegioInsuficiente);

      await s.como(admin);
      await s.query(
        "select public.rpc_cancelar_recebimento_confirmado($1, 'Recebimento lançado errado')",
        [id],
      );
      const [l] = await s.query<{ status: string }>(
        "select status from public.lotes where recebimento_id = $1",
        [id],
      );
      expect(l?.status).toBe("CANCELADO");
      // Recebimento do seed tem movimentação posterior: bloqueado.
      const comEventos = await s.tentar(
        "select public.rpc_cancelar_recebimento_confirmado($1, 'Tentativa de cancelamento')",
        [A.recebimentoAtiva],
      );
      expect(comEventos.ok).toBe(false);
      if (!comEventos.ok) expect(comEventos.mensagem).toContain("eventos posteriores");
    });
  });

  it("outra empresa não enxerga nem altera o recebimento", async () => {
    await comoAtor(operacao, async (s) => {
      const id = await novoRascunho(s);
      await s.como(usuario(USUARIOS.operacaoB));
      for (const sql of [
        "select public.pendencias_recebimento($1)",
        "select public.rpc_confirmar_recebimento($1)",
        "select public.rpc_definir_lote_recebimento($1, gen_random_uuid(), 1)",
      ]) {
        const r = await s.tentar(sql, [id]);
        expect(r.ok, sql).toBe(false);
        if (!r.ok) expect(r.codigo).toBe(SQLSTATE.naoEncontrado);
      }
    });
  });
});

describe("vistoria: respostas e checklist versionado (RN-81..RN-83)", () => {
  it("respostas são validadas pelo tipo da pergunta", async () => {
    await comoAtor(operacao, async (s) => {
      const id = await novoRascunho(s);
      await s.query("select public.rpc_definir_lote_recebimento($1, $2, 5)", [id, A.itemAndaime]);
      const [v] = await s.query<{ id: string }>(
        "select public.rpc_iniciar_vistoria_entrada($1) id",
        [await linhaDoLote(s, id)],
      );
      const [mesma] = await s.query<{ id: string }>(
        "select public.rpc_iniciar_vistoria_entrada($1) id",
        [await linhaDoLote(s, id)],
      );
      expect(mesma?.id).toBe(v?.id);
      for (const resposta of ['"TALVEZ"', "1", '"Inexistente"']) {
        const r = await s.tentar(
          `insert into public.respostas_vistoria (empresa_id, vistoria_id, pergunta_id, resposta_json)
           select $1, $2, p.id, $3 from public.perguntas_checklist p
           join public.vistorias v on v.modelo_id = p.modelo_id where v.id = $2 and p.ordem = 1`,
          [EMPRESA_A, v?.id, resposta],
        );
        expect(r.ok, resposta).toBe(false);
      }
      const [pend] = await s.query<{ p: string[] }>("select public.pendencias_recebimento($1) p", [
        id,
      ]);
      expect(pend?.p.some((x) => x.includes("vistoria incompleta"))).toBe(true);
    });
  });

  it("vistoria usa a versão publicada vigente no momento em que é iniciada", async () => {
    await comoAtor(operacao, async (s) => {
      const [nova] = await s.query<{ id: string }>(
        "select public.rpc_nova_versao_checklist($1) id",
        [A.modelo],
      );
      await s.query("select public.rpc_publicar_checklist($1)", [nova?.id]);
      const id = await novoRascunho(s);
      await s.query("select public.rpc_definir_lote_recebimento($1, $2, 5)", [id, A.itemAndaime]);
      const [criada] = await s.query<{ id: string }>(
        "select public.rpc_iniciar_vistoria_entrada($1) id",
        [await linhaDoLote(s, id)],
      );
      const [v] = await s.query<{ modelo_id: string }>(
        "select modelo_id from public.vistorias where id = $1",
        [criada?.id],
      );
      expect(v?.modelo_id).toBe(nova?.id);
    });
  });

  it("criação direta de vistoria pelo cliente é negada (só pela função de domínio)", async () => {
    await comoAtor(operacao, async (s) => {
      const r = await s.tentar(
        `insert into public.vistorias (empresa_id, tipo, modelo_id, bem_id, data_evento)
         values ($1, 'PERIODICA', $2, $3, now())`,
        [EMPRESA_A, A.modelo, A.bemEstacao1],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
    });
  });
});

describe("evidências (RN-90..RN-95)", () => {
  it("registra evidência com caminho da empresa e audita; outra empresa não registra", async () => {
    await comoAtor(operacao, async (s) => {
      const id = await foto(s, "BEM", A.bemEstacao1);
      const [e] = await s.query<{ bucket: string; status: string }>(
        "select bucket, status from public.evidencias where id = $1",
        [id],
      );
      expect(e).toEqual({ bucket: "evidencias", status: "ATIVA" });

      const caminhoErrado = await s.tentar(
        `select public.rpc_registrar_evidencia('BEM', $1, 'FOTO', $2, 'image/jpeg', 10, $3)`,
        [
          A.bemEstacao1,
          `b0000000-0000-4000-8000-000000000001/bem/${A.bemEstacao1}/${randomUUID()}.jpg`,
          HASH,
        ],
      );
      expect(caminhoErrado.ok).toBe(false);

      await s.como(usuario(USUARIOS.adminB));
      const r = await s.tentar("select * from public.rpc_preparar_evidencia('BEM', $1, 'FOTO')", [
        A.bemEstacao1,
      ]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.naoEncontrado);
    });
  });

  it("limite de tamanho da empresa e contrato só na locação", async () => {
    await comoAtor(compras, async (s) => {
      const [lim] = await s.query<{ limite_imagem_bytes: string }>(
        "select limite_imagem_bytes::text from public.rpc_preparar_evidencia('LOCACAO', $1, 'CONTRATO')",
        [A.locacaoAtiva],
      );
      expect(lim?.limite_imagem_bytes).toBe(String(15 * 1048576));
      const grande = await s.tentar(
        `select public.rpc_registrar_evidencia('BEM', $1, 'FOTO', $2, 'image/jpeg', $3, $4)`,
        [
          A.bemEstacao1,
          `${EMPRESA_A}/bem/${A.bemEstacao1}/${randomUUID()}.jpg`,
          16 * 1048576,
          HASH,
        ],
      );
      expect(grande.ok).toBe(false);
      const contratoNoBem = await s.tentar(
        "select * from public.rpc_preparar_evidencia('BEM', $1, 'CONTRATO')",
        [A.bemEstacao1],
      );
      expect(contratoNoBem.ok).toBe(false);
    });
  });

  it("vistoria concluída não recebe fotos novas", async () => {
    await comoAtor(operacao, async (s) => {
      const r = await s.tentar(
        "select * from public.rpc_preparar_evidencia('VISTORIA', $1, 'FOTO')",
        [A.vistoriaBem1],
      );
      expect(r.ok).toBe(false);
    });
  });

  it("substituição e remoção lógica com permissão e motivo", async () => {
    await comoAtor(operacao, async (s) => {
      const id = await foto(s, "BEM", A.bemEstacao1);
      const [n] = await s.query<{ id: string }>(
        `select public.rpc_substituir_evidencia($1, $2, 'image/jpeg', 2048, $3) id`,
        [id, `${EMPRESA_A}/bem/${A.bemEstacao1}/${randomUUID()}.jpg`, "b".repeat(64)],
      );
      const [antiga] = await s.query<{ status: string; substituida_por_id: string }>(
        "select status, substituida_por_id from public.evidencias where id = $1",
        [id],
      );
      expect(antiga).toEqual({ status: "SUBSTITUIDA", substituida_por_id: n?.id });

      const semMotivo = await s.tentar("select public.rpc_remover_evidencia($1, 'curto')", [n?.id]);
      expect(semMotivo.ok).toBe(false);
      await s.como(compras);
      const semPermissao = await s.tentar(
        "select public.rpc_remover_evidencia($1, 'Foto do item errado')",
        [n?.id],
      );
      expect(semPermissao.ok).toBe(false);
      if (!semPermissao.ok) expect(semPermissao.codigo).toBe(SQLSTATE.privilegioInsuficiente);
      await s.como(operacao);
      await s.query("select public.rpc_remover_evidencia($1, 'Foto do item errado')", [n?.id]);
      const [removida] = await s.query<{ status: string }>(
        "select status from public.evidencias where id = $1",
        [n?.id],
      );
      expect(removida?.status).toBe("REMOVIDA");
    });
  });

  it("cliente não insere evidência diretamente (só a função valida e registra)", async () => {
    await comoAtor(operacao, async (s) => {
      const r = await s.tentar(
        `insert into public.evidencias (empresa_id, entidade_tipo, entidade_id, tipo, bucket, storage_path,
           mime_type, tamanho_bytes, hash_arquivo)
         values ($1, 'BEM', $2, 'FOTO', 'evidencias', $3, 'image/jpeg', 10, $4)`,
        [EMPRESA_A, A.bemEstacao1, `${EMPRESA_A}/bem/${A.bemEstacao1}/${randomUUID()}.jpg`, HASH],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
    });
  });
});
