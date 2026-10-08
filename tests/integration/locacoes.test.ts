/** Funções de domínio da locação (Fase 4): pendências, ativar, cancelar, buscar. */
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

const compras = usuario(USUARIOS.comprasA);

/** Cria (como COMPRAS, pela RLS) uma locação rascunho completa e devolve o id. */
async function rascunhoCompleto(s: Sessao, comPedido = true): Promise<string> {
  const [l] = await s.query<{ id: string }>(
    `insert into public.locacoes (empresa_id, fornecedor_id, centro_custo_id, inicio_previsto, termino_previsto)
     values ($1, $2, $3, current_date, current_date + 30) returning id`,
    [EMPRESA_A, A.fornecedor1, A.centroCusto1],
  );
  const id = l?.id as string;
  await s.query(
    `insert into public.itens_locacao (empresa_id, locacao_id, categoria_id, descricao, quantidade_contratada,
       valor_unitario, periodicidade) values ($1, $2, $3, 'Andaime', 50, 1.5, 'DIARIA')`,
    [EMPRESA_A, id, A.categoriaAndaime],
  );
  if (comPedido) {
    await s.query(
      `insert into public.referencias_externas (empresa_id, locacao_id, sistema, tipo, numero)
       values ($1, $2, 'SECTRA', 'PEDIDO', $3)`,
      [EMPRESA_A, id, `PED-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`],
    );
  }
  return id;
}

describe("pendências e ativação (RN-13)", () => {
  it("rascunho vazio lista todas as pendências", async () => {
    await comoAtor(compras, async (s) => {
      const [l] = await s.query<{ id: string }>(
        "insert into public.locacoes (empresa_id) values ($1) returning id",
        [EMPRESA_A],
      );
      const [r] = await s.query<{ p: string[] }>(
        "select public.pendencias_ativacao_locacao($1) as p",
        [l?.id],
      );
      expect(r?.p).toEqual([
        "Informe o fornecedor",
        "Informe o centro de custo",
        "Informe o início e o término previstos",
        "Inclua ao menos um item contratado",
        "Vincule o pedido do Sectra",
      ]);
      const ativar = await s.tentar("select public.rpc_ativar_locacao($1)", [l?.id]);
      expect(ativar.ok).toBe(false);
      if (!ativar.ok) {
        expect(ativar.codigo).toBe("22023");
        expect(ativar.mensagem).toContain("Vincule o pedido do Sectra");
      }
    });
  });

  it("sem pedido Sectra não ativa; com pedido ativa, registra autor e auditoria", async () => {
    await comoAtor(compras, async (s) => {
      const semPedido = await rascunhoCompleto(s, false);
      const r = await s.tentar("select public.rpc_ativar_locacao($1)", [semPedido]);
      expect(r.ok).toBe(false);

      const id = await rascunhoCompleto(s);
      await s.query("select public.rpc_ativar_locacao($1)", [id]);
      const [l] = await s.query<{ status: string; ativada_por: string }>(
        "select status, ativada_por from public.locacoes where id = $1",
        [id],
      );
      expect(l).toEqual({ status: "ATIVA", ativada_por: USUARIOS.comprasA });
      await s.como(superusuario);
      const [aud] = await s.query<{ n: string }>(
        "select count(*) n from public.auditoria where entidade_id = $1 and acao = 'locacao.ativar'",
        [id],
      );
      expect(Number(aud?.n)).toBe(1);
    });
  });

  it("fornecedor inativo bloqueia a ativação", async () => {
    await comoAtor(compras, async (s) => {
      const id = await rascunhoCompleto(s);
      await s.query("update public.fornecedores set ativo = false where id = $1", [A.fornecedor1]);
      const [r] = await s.query<{ p: string[] }>(
        "select public.pendencias_ativacao_locacao($1) as p",
        [id],
      );
      expect(r?.p).toEqual(["O fornecedor está inativo"]);
    });
  });

  it.each([
    ["OPERACAO", USUARIOS.operacaoA],
    ["AUDITOR", USUARIOS.auditorA],
    ["FINANCEIRO", USUARIOS.financeiroA],
  ])("%s não ativa", async (_, ator) => {
    await comoAtor(compras, async (s) => {
      const id = await rascunhoCompleto(s);
      await s.como(usuario(ator));
      const r = await s.tentar("select public.rpc_ativar_locacao($1)", [id]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
    });
  });

  it("ADMIN da Empresa B não enxerga nem ativa locação da A", async () => {
    await comoAtor(compras, async (s) => {
      const id = await rascunhoCompleto(s);
      await s.como(usuario(USUARIOS.adminB));
      const r = await s.tentar("select public.rpc_ativar_locacao($1)", [id]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe("P0002");
      const p = await s.tentar("select public.pendencias_ativacao_locacao($1)", [id]);
      expect(p.ok).toBe(false);
    });
  });

  it("locação já ativa não é reativada", async () => {
    const r = await comoAtor(compras, (s) =>
      s.tentar("select public.rpc_ativar_locacao($1)", [A.locacaoAtiva]),
    );
    expect(r.ok).toBe(false);
  });
});

describe("cancelamento (RN-14)", () => {
  it("cancela rascunho com motivo; motivo curto é rejeitado", async () => {
    await comoAtor(compras, async (s) => {
      const curto = await s.tentar("select public.rpc_cancelar_locacao($1, 'curto')", [
        A.locacaoRascunho,
      ]);
      expect(curto.ok).toBe(false);
      await s.query("select public.rpc_cancelar_locacao($1, 'Pedido cancelado no Sectra')", [
        A.locacaoRascunho,
      ]);
      const [l] = await s.query<{ status: string; motivo_cancelamento: string }>(
        "select status, motivo_cancelamento from public.locacoes where id = $1",
        [A.locacaoRascunho],
      );
      expect(l).toEqual({ status: "CANCELADA", motivo_cancelamento: "Pedido cancelado no Sectra" });
    });
  });

  it("ativa sem recebimento confirmado pode ser cancelada; com recebimento não", async () => {
    await comoAtor(compras, async (s) => {
      const id = await rascunhoCompleto(s);
      await s.query("select public.rpc_ativar_locacao($1)", [id]);
      await s.query("select public.rpc_cancelar_locacao($1, 'Fornecedor desistiu da entrega')", [
        id,
      ]);
      const r = await s.tentar(
        "select public.rpc_cancelar_locacao($1, 'Tentativa indevida de cancelar')",
        [A.locacaoAtiva],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.mensagem).toContain("recebimento confirmado");
    });
  });

  it("OPERACAO não cancela", async () => {
    const r = await comoAtor(usuario(USUARIOS.operacaoA), (s) =>
      s.tentar("select public.rpc_cancelar_locacao($1, 'Sem permissão para isto')", [
        A.locacaoRascunho,
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
  });
});

describe("buscar_locacoes", () => {
  // Os E2E gravam locações reais no mesmo banco: as asserções usam os dados do
  // seed por inclusão e verificam a propriedade do filtro em todas as linhas.
  type Linha = {
    codigo: string;
    id: string;
    total: string;
    status: string;
    centro_custo: string | null;
    pedidos_sectra: string | null;
  };
  const buscar = (ator: string, args: string, params: unknown[]) =>
    comoAtor(usuario(ator), (s) =>
      s.query<Linha>(`select * from public.buscar_locacoes(${args})`, params),
    );
  /** Percorre todas as páginas (a função limita a 100 por chamada). */
  const buscarTodas = async (ator: string, args: string, params: unknown[]) => {
    const todas: Linha[] = [];
    for (let offset = 0; ; offset += 100) {
      const pagina = await buscar(ator, `${args}, p_limite => 100, p_offset => ${offset}`, params);
      todas.push(...pagina);
      if (pagina.length < 100) return todas;
    }
  };
  const totalEmpresaA = () =>
    comoAtor(superusuario, async (s) => {
      const [r] = await s.query<{ n: string }>(
        "select count(*) n from public.locacoes where empresa_id = $1",
        [EMPRESA_A],
      );
      return Number(r?.n);
    });

  it("lista as locações da empresa ativa com total para paginação", async () => {
    const total = await totalEmpresaA();
    const r = await buscarTodas(USUARIOS.gestorA, "$1", [EMPRESA_A]);
    expect(r.map((l) => l.id)).toEqual(
      expect.arrayContaining([A.locacaoAtiva, A.locacaoEmDevolucao, A.locacaoRascunho]),
    );
    expect(r.every((l) => Number(l.total) === total)).toBe(true);
  });

  it.each([
    ["pedido Sectra", "4500012345", [A.locacaoAtiva]],
    ["número de série do bem", "TS07-1002", [A.locacaoAtiva]],
    ["código da locação", "LOC-000003", [A.locacaoEmDevolucao]],
    ["lote", "LOT-000001", [A.locacaoAtiva]],
  ])("busca por %s", async (_, q, esperado) => {
    const r = await buscar(USUARIOS.gestorA, "$1, p_q => $2", [EMPRESA_A, q]);
    expect(r.map((l) => l.id)).toEqual(esperado);
  });

  it("busca por fornecedor", async () => {
    const r = await buscarTodas(USUARIOS.gestorA, "$1, p_q => $2", [EMPRESA_A, "Andaimes Forte"]);
    expect(r.map((l) => l.id)).toContain(A.locacaoEmDevolucao);
    expect(r.map((l) => l.id)).not.toContain(A.locacaoAtiva);
  });

  it("filtra por status, centro de custo, local e término", async () => {
    const porStatus = await buscarTodas(
      USUARIOS.gestorA,
      "$1, p_status => $2::public.status_locacao[]",
      [EMPRESA_A, "{ATIVA,EM_DEVOLUCAO}"],
    );
    expect(porStatus.map((l) => l.id)).toEqual(
      expect.arrayContaining([A.locacaoAtiva, A.locacaoEmDevolucao]),
    );
    expect(porStatus.every((l) => ["ATIVA", "EM_DEVOLUCAO"].includes(l.status))).toBe(true);

    const porLocal = await buscar(USUARIOS.gestorA, "$1, p_local => $2", [EMPRESA_A, A.localObra1]);
    expect(porLocal.map((l) => l.id)).toEqual([A.locacaoAtiva]);

    const [hoje] = await comoAtor(superusuario, (s) =>
      s.query<{ limite: string }>("select (current_date + 7)::text limite"),
    );
    const porTermino = await buscarTodas(
      USUARIOS.gestorA,
      "$1, p_termino_ate => current_date + 7",
      [EMPRESA_A],
    );
    expect(porTermino.map((l) => l.id)).toContain(A.locacaoAtiva);
    expect(porTermino.map((l) => l.id)).not.toContain(A.locacaoEmDevolucao);
    // `date` vem do driver como Date local: compara como texto ISO no próprio banco.
    const terminos = await comoAtor(usuario(USUARIOS.gestorA), (s) =>
      s.query<{ termino: string | null }>(
        "select termino_previsto::text termino from public.buscar_locacoes($1, p_termino_ate => current_date + 7, p_limite => 100)",
        [EMPRESA_A],
      ),
    );
    const limite = hoje?.limite ?? "";
    expect(limite).not.toBe("");
    expect(terminos.every((l) => l.termino !== null && l.termino <= limite)).toBe(true);

    const porCentro = await buscarTodas(USUARIOS.gestorA, "$1, p_centro_custo => $2", [
      EMPRESA_A,
      A.centroCusto1,
    ]);
    expect(porCentro.map((l) => l.id)).toEqual(
      expect.arrayContaining([A.locacaoAtiva, A.locacaoRascunho]),
    );
    expect(porCentro.map((l) => l.id)).not.toContain(A.locacaoEmDevolucao);
    expect(porCentro.every((l) => l.centro_custo?.startsWith("CC-1001"))).toBe(true);
  });

  it("paginação limita e mantém o total", async () => {
    const total = await totalEmpresaA();
    const r = await buscar(USUARIOS.gestorA, "$1, p_limite => 2, p_offset => $2", [
      EMPRESA_A,
      total - 1,
    ]);
    expect(r).toHaveLength(1);
    expect(Number(r[0]?.total)).toBe(total);
    const limitado = await buscar(USUARIOS.gestorA, "$1, p_limite => 1000", [EMPRESA_A]);
    expect(limitado.length).toBeLessThanOrEqual(100);
  });

  it("usuário da B que passa o ID da Empresa A recebe zero linhas (RLS)", async () => {
    expect(await buscar(USUARIOS.adminB, "$1", [EMPRESA_A])).toEqual([]);
    expect((await buscar(USUARIOS.adminB, "$1", [EMPRESA_B])).map((l) => l.id)).toEqual([
      B.locacaoAtiva,
    ]);
  });
});

describe("checklists versionados", () => {
  it("publicar exige perguntas; nova versão copia perguntas e arquiva a anterior ao publicar", async () => {
    await comoAtor(usuario(USUARIOS.operacaoA), async (s) => {
      const [m] = await s.query<{ id: string }>(
        "insert into public.modelos_checklist (empresa_id, nome) values ($1, 'Teste') returning id",
        [EMPRESA_A],
      );
      const vazio = await s.tentar("select public.rpc_publicar_checklist($1)", [m?.id]);
      expect(vazio.ok).toBe(false);

      const [nova] = await s.query<{ id: string }>(
        "select public.rpc_nova_versao_checklist($1) as id",
        [A.modelo],
      );
      const perguntas = await s.query(
        "select 1 from public.perguntas_checklist where modelo_id = $1",
        [nova?.id],
      );
      expect(perguntas).toHaveLength(3);
      const dup = await s.tentar("select public.rpc_nova_versao_checklist($1)", [A.modelo]);
      expect(dup.ok).toBe(false);

      await s.query(
        "update public.perguntas_checklist set texto = 'Estado geral (revisado)' where modelo_id = $1 and ordem = 1",
        [nova?.id],
      );
      await s.query("select public.rpc_publicar_checklist($1)", [nova?.id]);
      const versoes = await s.query<{ versao: number; status: string }>(
        "select versao, status from public.modelos_checklist where familia_id = (select familia_id from public.modelos_checklist where id = $1) order by versao",
        [A.modelo],
      );
      expect(versoes).toEqual([
        { versao: 1, status: "ARQUIVADO" },
        { versao: 2, status: "PUBLICADO" },
      ]);
      // Vistorias antigas continuam apontando para a v1, com o texto original.
      const [v] = await s.query<{ texto: string }>(
        `select p.texto from public.respostas_vistoria r join public.perguntas_checklist p on p.id = r.pergunta_id
         where r.vistoria_id = $1 and p.ordem = 1`,
        [A.vistoriaBem1],
      );
      expect(v?.texto).toBe("Estado geral do equipamento");
    });
  });

  it("COMPRAS não gerencia checklists", async () => {
    const r = await comoAtor(compras, (s) =>
      s.tentar("select public.rpc_nova_versao_checklist($1)", [A.modelo]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
  });
});
