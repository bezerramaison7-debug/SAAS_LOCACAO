import { afterAll, describe, expect, it } from "vitest";

import { anon, comoAtor, encerrarPool, SQLSTATE, usuario } from "../support/db";
import { A, EMPRESA_A, USUARIOS } from "../support/fixtures";

afterAll(encerrarPool);

const TABELAS = [
  "empresas",
  "perfis_usuario",
  "usuarios_empresa",
  "fornecedores",
  "locais",
  "centros_custo",
  "categorias_bem",
  "modelos_checklist",
  "perguntas_checklist",
  "locacoes",
  "referencias_externas",
  "itens_locacao",
  "recebimentos",
  "itens_recebimento",
  "bens",
  "lotes",
  "vistorias",
  "respostas_vistoria",
  "movimentacoes",
  "ocorrencias",
  "devolucoes",
  "itens_devolucao",
  "cobrancas",
  "evidencias",
  "relatorios",
  "auditoria",
  "v_saldo_item_locacao",
  "v_saldo_locacao",
] as const;

async function contar(ator: string, tabela: string, filtro = "true", params: unknown[] = []) {
  return comoAtor(usuario(ator), async (s) => {
    const [l] = await s.query<{ n: string }>(
      `select count(*) as n from public.${tabela} where ${filtro}`,
      params,
    );
    return Number(l?.n);
  });
}

describe("usuário anônimo", () => {
  it.each(TABELAS)("não acessa %s (permissão negada)", async (tabela) => {
    const r = await comoAtor(anon, (s) => s.tentar(`select 1 from public.${tabela} limit 1`));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
  });

  it("não executa funções públicas nem acessa o esquema privado", async () => {
    await comoAtor(anon, async (s) => {
      const f = await s.tentar("select public.usuario_pertence_empresa($1)", [EMPRESA_A]);
      expect(f.ok).toBe(false);
      const p = await s.tentar("select privado.usuario_tem_permissao($1, 'dados.ler_geral')", [
        EMPRESA_A,
      ]);
      expect(p.ok).toBe(false);
    });
  });
});

describe.each([
  ["usuário com associação inativa", USUARIOS.inativoA],
  ["usuário sem empresa", USUARIOS.semEmpresa],
])("%s", (_, ator) => {
  it.each(TABELAS.filter((t) => t !== "perfis_usuario"))(
    "não vê nenhuma linha de %s",
    async (tabela) => {
      expect(await contar(ator, tabela)).toBe(0);
    },
  );

  it("vê apenas o próprio perfil", async () => {
    const perfis = await comoAtor(usuario(ator), (s) =>
      s.query<{ user_id: string }>("select user_id from public.perfis_usuario"),
    );
    expect(perfis.map((p) => p.user_id)).toEqual([ator]);
  });

  it("não consegue escrever", async () => {
    await comoAtor(usuario(ator), async (s) => {
      const r = await s.tentar(
        "insert into public.fornecedores (empresa_id, razao_social) values ($1, 'X')",
        [EMPRESA_A],
      );
      expect(r.ok).toBe(false);
      const u = await s.tentar("update public.locais set nome = 'X' where empresa_id = $1", [
        EMPRESA_A,
      ]);
      expect(u.ok && u.rowCount === 0).toBe(true);
    });
  });

  it("função usuario_pertence_empresa responde falso", async () => {
    const [r] = await comoAtor(usuario(ator), (s) =>
      s.query<{ ok: boolean }>("select public.usuario_pertence_empresa($1) as ok", [EMPRESA_A]),
    );
    expect(r?.ok).toBe(false);
  });
});

describe("AUDITOR (somente leitura)", () => {
  const auditor = usuario(USUARIOS.auditorA);

  it("lê dados gerais, valores e auditoria da empresa", async () => {
    expect(await contar(USUARIOS.auditorA, "locacoes")).toBeGreaterThan(0);
    expect(await contar(USUARIOS.auditorA, "cobrancas")).toBeGreaterThan(0);
    expect(await contar(USUARIOS.auditorA, "auditoria")).toBeGreaterThan(0);
  });

  it("não insere, não altera e não apaga nada", async () => {
    await comoAtor(auditor, async (s) => {
      const inserts: [string, unknown[]][] = [
        [
          "insert into public.fornecedores (empresa_id, razao_social) values ($1, 'X')",
          [EMPRESA_A],
        ],
        [
          "insert into public.locais (empresa_id, codigo, nome) values ($1, 'AUD-1', 'X')",
          [EMPRESA_A],
        ],
        ["insert into public.locacoes (empresa_id) values ($1)", [EMPRESA_A]],
        [
          "insert into public.referencias_externas (empresa_id, locacao_id, tipo, numero) values ($1, $2, 'PEDIDO', 'AUD')",
          [EMPRESA_A, A.locacaoRascunho],
        ],
        [
          "insert into public.recebimentos (empresa_id, locacao_id) values ($1, $2)",
          [EMPRESA_A, A.locacaoAtiva],
        ],
        [
          "insert into public.devolucoes (empresa_id, locacao_id) values ($1, $2)",
          [EMPRESA_A, A.locacaoAtiva],
        ],
      ];
      for (const [sql, params] of inserts) {
        const r = await s.tentar(sql, params);
        expect(r.ok, sql).toBe(false);
      }
      const updates = [
        "update public.fornecedores set razao_social = 'X'",
        "update public.locacoes set observacoes = 'X'",
        "update public.itens_locacao set descricao = 'X'",
        "update public.empresas set nome = 'X'",
        "update public.bens set observacoes = 'X'",
        "update public.perfis_usuario set nome = 'Outro nome' where user_id <> auth.uid()",
      ];
      for (const sql of updates) {
        const r = await s.tentar(sql);
        expect(r.ok && r.rowCount === 0, sql).toBe(true);
      }
      const del = await s.tentar("delete from public.itens_locacao");
      expect(del.ok && del.rowCount === 0).toBe(true);
    });
  });
});

describe("RESPONSAVEL_LOCAL (escopo: itens sob sua responsabilidade)", () => {
  const rl = USUARIOS.responsavelA;

  it("vê o bem sob sua responsabilidade e não vê os demais", async () => {
    const bens = await comoAtor(usuario(rl), (s) =>
      s.query<{ id: string }>("select id from public.bens order by id"),
    );
    expect(bens.map((b) => b.id)).toEqual([A.bemEstacao1]);
  });

  it("vê a locação do item, mas não itens contratados (valores) nem cobranças", async () => {
    const locacoes = await comoAtor(usuario(rl), (s) =>
      s.query<{ id: string }>("select id from public.locacoes"),
    );
    expect(locacoes.map((l) => l.id)).toEqual([A.locacaoAtiva]);
    expect(await contar(rl, "itens_locacao")).toBe(0);
    expect(await contar(rl, "cobrancas")).toBe(0);
    expect(await contar(rl, "recebimentos")).toBe(0);
    expect(await contar(rl, "devolucoes")).toBe(0);
    expect(await contar(rl, "auditoria")).toBe(0);
  });

  it("vê a movimentação que o tornou responsável e a vistoria do bem", async () => {
    expect(await contar(rl, "movimentacoes", "id = $1", [A.movimentacaoBem1])).toBe(1);
    expect(await contar(rl, "vistorias", "id = $1", [A.vistoriaBem1])).toBe(1);
    expect(await contar(rl, "ocorrencias", "id = $1", [A.ocorrenciaBem2])).toBe(0);
    expect(await contar(rl, "lotes")).toBe(0);
  });

  it("não altera local nem responsável do próprio bem diretamente", async () => {
    const r = await comoAtor(usuario(rl), (s) =>
      s.tentar("update public.bens set local_atual_id = $1 where id = $2", [
        A.localAlmoxarifado,
        A.bemEstacao1,
      ]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
  });
});

describe("escrita conforme a matriz de permissões", () => {
  const novaLocacao = "insert into public.locacoes (empresa_id, observacoes) values ($1, 'teste')";
  const novoFornecedor =
    "insert into public.fornecedores (empresa_id, razao_social) values ($1, 'Novo')";
  const novoLocal =
    "insert into public.locais (empresa_id, codigo, nome) values ($1, 'T-1', 'Teste')";

  it.each([
    ["COMPRAS", USUARIOS.comprasA, novaLocacao, true],
    ["ADMIN", USUARIOS.adminA, novaLocacao, true],
    ["OPERACAO", USUARIOS.operacaoA, novaLocacao, false],
    ["FINANCEIRO", USUARIOS.financeiroA, novaLocacao, false],
    ["GESTOR", USUARIOS.gestorA, novaLocacao, false],
    ["RESPONSAVEL_LOCAL", USUARIOS.responsavelA, novaLocacao, false],
    ["COMPRAS", USUARIOS.comprasA, novoFornecedor, true],
    ["OPERACAO", USUARIOS.operacaoA, novoFornecedor, false],
    ["FINANCEIRO", USUARIOS.financeiroA, novoFornecedor, false],
    ["OPERACAO", USUARIOS.operacaoA, novoLocal, true],
    ["GESTOR", USUARIOS.gestorA, novoLocal, false],
  ] as const)("%s → %s permitido=%s", async (_, ator, sql, permitido) => {
    const r = await comoAtor(usuario(ator), (s) => s.tentar(sql, [EMPRESA_A]));
    expect(r.ok).toBe(permitido);
    if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
  });

  it("locação recém-criada recebe código e status padrão; usuário não informa status", async () => {
    await comoAtor(usuario(USUARIOS.comprasA), async (s) => {
      const [l] = await s.query<{ codigo: string; status: string; created_by: string }>(
        `${novaLocacao} returning codigo, status, created_by`,
        [EMPRESA_A],
      );
      expect(l?.codigo).toMatch(/^LOC-\d{6}$/);
      expect(l?.status).toBe("RASCUNHO");
      expect(l?.created_by).toBe(USUARIOS.comprasA);
      const r = await s.tentar(
        "insert into public.locacoes (empresa_id, status) values ($1, 'ATIVA')",
        [EMPRESA_A],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
    });
  });

  it("COMPRAS edita locação em RASCUNHO, mas não locação ATIVA", async () => {
    await comoAtor(usuario(USUARIOS.comprasA), async (s) => {
      const r1 = await s.tentar("update public.locacoes set observacoes = 'ok' where id = $1", [
        A.locacaoRascunho,
      ]);
      expect(r1.ok && r1.rowCount).toBe(1);
      const r2 = await s.tentar("update public.locacoes set observacoes = 'x' where id = $1", [
        A.locacaoAtiva,
      ]);
      expect(r2.ok && r2.rowCount).toBe(0);
    });
  });

  it("COMPRAS remove referência e item apenas de locação em RASCUNHO", async () => {
    await comoAtor(usuario(USUARIOS.comprasA), async (s) => {
      const d1 = await s.tentar("delete from public.referencias_externas where locacao_id = $1", [
        A.locacaoRascunho,
      ]);
      expect(d1.ok && d1.rowCount).toBe(1);
      const d2 = await s.tentar("delete from public.referencias_externas where locacao_id = $1", [
        A.locacaoAtiva,
      ]);
      expect(d2.ok && d2.rowCount).toBe(0);
      const d3 = await s.tentar("delete from public.itens_locacao where locacao_id = $1", [
        A.locacaoAtiva,
      ]);
      expect(d3.ok && d3.rowCount).toBe(0);
    });
  });
});

describe("operações de estado/cancelamento são impossíveis por acesso direto", () => {
  it.each([
    [
      "ativar locação",
      "update public.locacoes set status = 'ATIVA' where id = $1",
      A.locacaoRascunho,
    ],
    [
      "cancelar locação",
      "update public.locacoes set status = 'CANCELADA' where id = $1",
      A.locacaoRascunho,
    ],
    [
      "encerrar financeiro",
      "update public.locacoes set status_financeiro = 'ENCERRADO' where id = $1",
      A.locacaoAtiva,
    ],
    [
      "cancelar recebimento",
      "update public.recebimentos set status = 'CANCELADO' where id = $1",
      A.recebimentoAtiva,
    ],
    [
      "cancelar devolução",
      "update public.devolucoes set status = 'CANCELADA' where id = $1",
      A.devolucao,
    ],
    ["devolver bem", "update public.bens set status = 'DEVOLVIDO' where id = $1", A.bemNotebook],
    [
      "zerar lote",
      "update public.lotes set quantidade_devolvida = 60 where id = $1",
      A.loteAndaime,
    ],
    [
      "resolver ocorrência",
      "update public.ocorrencias set status = 'RESOLVIDA' where id = $1",
      A.ocorrenciaBem2,
    ],
    [
      "conferir cobrança",
      "update public.cobrancas set status = 'CONFERIDA' where id = $1",
      A.cobranca,
    ],
    [
      "trocar empresa",
      "update public.locacoes set empresa_id = gen_random_uuid() where id = $1",
      A.locacaoRascunho,
    ],
  ])("%s → negado mesmo para ADMIN", async (_, sql, id) => {
    const r = await comoAtor(usuario(USUARIOS.adminA), (s) => s.tentar(sql, [id]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
  });

  it.each([
    "movimentacoes",
    "ocorrencias",
    "cobrancas",
    "evidencias",
    "relatorios",
    "auditoria",
    "lotes",
  ])("INSERT direto em %s é negado (somente funções de domínio)", async (tabela) => {
    const r = await comoAtor(usuario(USUARIOS.adminA), (s) =>
      s.tentar(`insert into public.${tabela} (empresa_id) values ($1)`, [EMPRESA_A]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
  });

  it("DELETE de locação, bem e associação é negado", async () => {
    await comoAtor(usuario(USUARIOS.adminA), async (s) => {
      for (const [tabela, id] of [
        ["locacoes", A.locacaoRascunho],
        ["bens", A.bemEstacao1],
        ["usuarios_empresa", USUARIOS.inativoA],
      ] as const) {
        const r = await s.tentar(`delete from public.${tabela} where id = $1`, [id]);
        expect(r.ok, tabela).toBe(false);
      }
    });
  });

  it("ADMIN não altera papel nem ativa associação diretamente (função administrativa na Fase 3)", async () => {
    const r = await comoAtor(usuario(USUARIOS.adminA), (s) =>
      s.tentar("update public.usuarios_empresa set ativo = true where user_id = $1", [
        USUARIOS.inativoA,
      ]),
    );
    expect(r.ok).toBe(false);
  });
});
