/**
 * GATE DA FASE 2: a Empresa A não consegue consultar nem alterar dados da
 * Empresa B (e vice-versa), em nenhuma tabela, por nenhum caminho direto.
 */
import { afterAll, describe, expect, it } from "vitest";

import { comoAtor, encerrarPool, SQLSTATE, usuario } from "../support/db";
import { A, B, EMPRESA_A, EMPRESA_B, USUARIOS } from "../support/fixtures";

afterAll(encerrarPool);

/** Tabelas com coluna empresa_id. */
const TABELAS_COM_EMPRESA = [
  "usuarios_empresa",
  "fornecedores",
  "locais",
  "centros_custo",
  "modelos_checklist",
  "perguntas_checklist",
  "categorias_bem",
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
] as const;

const VISOES = ["v_saldo_item_locacao", "v_saldo_locacao"] as const;

const cenarios = [
  { nome: "ADMIN da Empresa A", ator: USUARIOS.adminA, propria: EMPRESA_A, outra: EMPRESA_B },
  { nome: "ADMIN da Empresa B", ator: USUARIOS.adminB, propria: EMPRESA_B, outra: EMPRESA_A },
  { nome: "OPERAÇÃO da Empresa B", ator: USUARIOS.operacaoB, propria: EMPRESA_B, outra: EMPRESA_A },
] as const;

describe.each(cenarios)("$nome", ({ ator, propria, outra }) => {
  it.each([...TABELAS_COM_EMPRESA, ...VISOES])(
    "SELECT em %s não retorna nada da outra empresa",
    async (tabela) => {
      const linhas = await comoAtor(usuario(ator), (s) =>
        s.query<{ empresa_id: string }>(`select distinct empresa_id from public.${tabela}`),
      );
      expect(linhas.map((l) => l.empresa_id)).not.toContain(outra);
    },
  );

  it("enxerga os dados da própria empresa (o teste não passa por estar vazio)", async () => {
    await comoAtor(usuario(ator), async (s) => {
      for (const tabela of ["locacoes", "bens", "fornecedores", "itens_locacao", "recebimentos"]) {
        const [linha] = await s.query<{ n: string }>(
          `select count(*) as n from public.${tabela} where empresa_id = $1`,
          [propria],
        );
        expect(Number(linha?.n), tabela).toBeGreaterThan(0);
      }
    });
  });

  it("empresas: vê apenas a própria", async () => {
    const empresas = await comoAtor(usuario(ator), (s) =>
      s.query<{ id: string }>("select id from public.empresas"),
    );
    expect(empresas.map((e) => e.id)).toEqual([propria]);
  });

  it("filtro explícito pela outra empresa retorna zero linhas", async () => {
    await comoAtor(usuario(ator), async (s) => {
      for (const tabela of TABELAS_COM_EMPRESA) {
        const [linha] = await s.query<{ n: string }>(
          `select count(*) as n from public.${tabela} where empresa_id = $1`,
          [outra],
        );
        expect(Number(linha?.n), tabela).toBe(0);
      }
    });
  });
});

describe("escrita cruzada é bloqueada", () => {
  const admA = usuario(USUARIOS.adminA);

  it("INSERT com empresa_id da outra empresa é rejeitado por RLS", async () => {
    await comoAtor(admA, async (s) => {
      const casos: [string, unknown[]][] = [
        [
          "insert into public.fornecedores (empresa_id, razao_social) values ($1, 'Intruso')",
          [EMPRESA_B],
        ],
        [
          "insert into public.locais (empresa_id, codigo, nome) values ($1, 'X-1', 'Intruso')",
          [EMPRESA_B],
        ],
        [
          "insert into public.centros_custo (empresa_id, codigo, nome) values ($1, 'X-1', 'Intruso')",
          [EMPRESA_B],
        ],
        [
          "insert into public.locacoes (empresa_id, observacoes) values ($1, 'Intrusa')",
          [EMPRESA_B],
        ],
        [
          "insert into public.categorias_bem (empresa_id, nome, modo_controle) values ($1, 'Intrusa', 'LOTE')",
          [EMPRESA_B],
        ],
      ];
      for (const [sql, params] of casos) {
        const r = await s.tentar(sql, params);
        expect(r.ok, sql).toBe(false);
        if (!r.ok) expect(r.codigo, sql).toBe(SQLSTATE.privilegioInsuficiente);
      }
    });
  });

  it("INSERT na própria empresa apontando para registro da outra falha (FK composta)", async () => {
    await comoAtor(admA, async (s) => {
      // locação da A com fornecedor da B
      const r1 = await s.tentar(
        "insert into public.locacoes (empresa_id, fornecedor_id) values ($1, $2)",
        [EMPRESA_A, B.fornecedor1],
      );
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.codigo).toBe(SQLSTATE.violacaoFk);
      // referência Sectra da A em locação da B
      const r2 = await s.tentar(
        `insert into public.referencias_externas (empresa_id, locacao_id, tipo, numero)
         values ($1, $2, 'PEDIDO', '999')`,
        [EMPRESA_A, B.locacaoAtiva],
      );
      expect(r2.ok).toBe(false);
      // item na locação rascunho da A com categoria da B
      const r3 = await s.tentar(
        `insert into public.itens_locacao (empresa_id, locacao_id, categoria_id, descricao,
           quantidade_contratada, valor_unitario, periodicidade)
         values ($1, $2, $3, 'Item', 1, 1, 'MENSAL')`,
        [EMPRESA_A, A.locacaoRascunho, B.categoriaGerador],
      );
      expect(r3.ok).toBe(false);
    });
  });

  it("UPDATE em registros da outra empresa afeta zero linhas", async () => {
    await comoAtor(admA, async (s) => {
      const casos: [string, string][] = [
        ["update public.fornecedores set razao_social = 'Hackeado' where id = $1", B.fornecedor1],
        ["update public.locais set nome = 'Hackeado' where id = $1", B.local1],
        ["update public.centros_custo set nome = 'Hackeado' where id = $1", B.centroCusto1],
        ["update public.categorias_bem set nome = 'Hackeado' where id = $1", B.categoriaGerador],
        ["update public.empresas set nome = 'Hackeada' where id = $1", EMPRESA_B],
        ["update public.locacoes set observacoes = 'Hackeada' where id = $1", B.locacaoAtiva],
        ["update public.bens set observacoes = 'Hackeado' where id = $1", B.bemGerador],
      ];
      for (const [sql, id] of casos) {
        const r = await s.tentar(sql, [id]);
        expect(r.ok, sql).toBe(true);
        if (r.ok) expect(r.rowCount, sql).toBe(0);
      }
    });
  });

  it("DELETE em registros da outra empresa afeta zero linhas ou é negado", async () => {
    await comoAtor(usuario(USUARIOS.adminB), async (s) => {
      const r = await s.tentar("delete from public.itens_locacao where locacao_id = $1", [
        A.locacaoRascunho,
      ]);
      expect(r.ok && r.rowCount === 0).toBe(true);
      const r2 = await s.tentar("delete from public.locacoes where id = $1", [A.locacaoRascunho]);
      expect(r2.ok).toBe(false);
    });
  });

  it("dados da Empresa B continuam intactos após as tentativas", async () => {
    await comoAtor(usuario(USUARIOS.adminB), async (s) => {
      const [forn] = await s.query<{ razao_social: string }>(
        "select razao_social from public.fornecedores where id = $1",
        [B.fornecedor1],
      );
      expect(forn?.razao_social).toContain("Geradores Brasil");
    });
  });

  it("mesmo número de pedido Sectra existe nas duas empresas, cada uma vê só o seu", async () => {
    for (const [ator, locacao] of [
      [USUARIOS.adminA, A.locacaoAtiva],
      [USUARIOS.adminB, B.locacaoAtiva],
    ] as const) {
      const refs = await comoAtor(usuario(ator), (s) =>
        s.query<{ locacao_id: string }>(
          "select locacao_id from public.referencias_externas where numero = '4500012345'",
        ),
      );
      expect(refs.map((r) => r.locacao_id)).toEqual([locacao]);
    }
  });
});
