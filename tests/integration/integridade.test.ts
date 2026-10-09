/** Restrições de integridade que não dependem de JavaScript (constraints/triggers). */
import { afterAll, describe, expect, it } from "vitest";

import { comoAtor, encerrarPool, SQLSTATE, superusuario, type Sessao } from "../support/db";
import { A, B, EMPRESA_A, USUARIOS } from "../support/fixtures";

afterAll(encerrarPool);

async function esperarErro(s: Sessao, sql: string, params: unknown[], codigo: string) {
  const r = await s.tentar(sql, params);
  expect(r.ok, sql).toBe(false);
  if (!r.ok) expect(r.codigo, `${sql}\n${r.mensagem}`).toBe(codigo);
}

describe("integridade", () => {
  it("código único por empresa (locais, centros de custo)", async () => {
    await comoAtor(superusuario, async (s) => {
      await esperarErro(
        s,
        "insert into public.locais (empresa_id, codigo, nome) values ($1, 'OBRA-001', 'Duplicado')",
        [EMPRESA_A],
        SQLSTATE.violacaoUnique,
      );
      await esperarErro(
        s,
        "insert into public.centros_custo (empresa_id, codigo, nome) values ($1, 'CC-1001', 'Duplicado')",
        [EMPRESA_A],
        SQLSTATE.violacaoUnique,
      );
    });
  });

  it("mesmo pedido Sectra não pode estar em duas locações da mesma empresa", async () => {
    await comoAtor(superusuario, (s) =>
      esperarErro(
        s,
        `insert into public.referencias_externas (empresa_id, locacao_id, sistema, tipo, numero)
         values ($1, $2, 'SECTRA', 'PEDIDO', '4500012345')`,
        [EMPRESA_A, A.locacaoRascunho],
        SQLSTATE.violacaoUnique,
      ),
    );
  });

  it("quantidades nunca negativas e devolvido nunca maior que recebido", async () => {
    await comoAtor(superusuario, async (s) => {
      await esperarErro(
        s,
        "update public.lotes set quantidade_devolvida = -1 where id = $1",
        [A.loteAndaime],
        SQLSTATE.violacaoCheck,
      );
      await esperarErro(
        s,
        "update public.lotes set quantidade_devolvida = 61 where id = $1",
        [A.loteAndaime],
        SQLSTATE.violacaoCheck,
      );
      await esperarErro(
        s,
        "update public.lotes set quantidade_devolvida = 30, quantidade_dividida = 31 where id = $1",
        [A.loteAndaime],
        SQLSTATE.violacaoCheck,
      );
      await esperarErro(
        s,
        "update public.itens_locacao set quantidade_contratada = 0 where id = $1",
        [A.itemEstacao],
        SQLSTATE.violacaoCheck,
      );
    });
  });

  it("lote sem saldo não pode continuar ATIVO; com saldo zero fica ENCERRADO", async () => {
    await comoAtor(superusuario, async (s) => {
      await esperarErro(
        s,
        "update public.lotes set quantidade_devolvida = 60 where id = $1",
        [A.loteAndaime],
        SQLSTATE.violacaoCheck,
      );
      const ok = await s.tentar(
        "update public.lotes set quantidade_devolvida = 60, status = 'ENCERRADO' where id = $1",
        [A.loteAndaime],
      );
      expect(ok.ok).toBe(true);
    });
  });

  it("um bem não pode estar em duas devoluções ativas (RN-57)", async () => {
    await comoAtor(superusuario, async (s) => {
      const [dev] = await s.query<{ id: string }>(
        "insert into public.devolucoes (empresa_id, locacao_id) values ($1, $2) returning id",
        [EMPRESA_A, A.locacaoEmDevolucao],
      );
      await esperarErro(
        s,
        `insert into public.itens_devolucao (empresa_id, devolucao_id, item_locacao_id, bem_id, quantidade_solicitada)
         values ($1, $2, $3, $4, 1)`,
        [EMPRESA_A, dev?.id, A.itemNotebook, A.bemNotebook],
        SQLSTATE.violacaoUnique,
      );
      // Após desativar o item da primeira devolução (cancelada), passa a ser permitido.
      await s.query("update public.itens_devolucao set ativo = false where bem_id = $1", [
        A.bemNotebook,
      ]);
      const ok = await s.tentar(
        `insert into public.itens_devolucao (empresa_id, devolucao_id, item_locacao_id, bem_id, quantidade_solicitada)
         values ($1, $2, $3, $4, 1)`,
        [EMPRESA_A, dev?.id, A.itemNotebook, A.bemNotebook],
      );
      expect(ok.ok).toBe(true);
    });
  });

  it("bem individual só em item INDIVIDUAL; lote só em item LOTE", async () => {
    await comoAtor(superusuario, async (s) => {
      await esperarErro(
        s,
        "insert into public.bens (empresa_id, item_locacao_id, recebimento_id) values ($1, $2, $3)",
        [EMPRESA_A, A.itemAndaime, A.recebimentoAtiva],
        SQLSTATE.violacaoCheck,
      );
      await esperarErro(
        s,
        `insert into public.lotes (empresa_id, item_locacao_id, recebimento_id, quantidade_recebida,
           local_atual_id, responsavel_atual_id) values ($1, $2, $3, 5, $4, $5)`,
        [EMPRESA_A, A.itemEstacao, A.recebimentoAtiva, A.localAlmoxarifado, USUARIOS.operacaoA],
        SQLSTATE.violacaoCheck,
      );
    });
  });

  it("modo de controle do item é herdado da categoria (não informado pelo usuário)", async () => {
    await comoAtor(superusuario, async (s) => {
      const [item] = await s.query<{ modo_controle: string }>(
        `insert into public.itens_locacao (empresa_id, locacao_id, categoria_id, descricao, modo_controle,
           quantidade_contratada, valor_unitario, periodicidade)
         values ($1, $2, $3, 'Teste', 'INDIVIDUAL', 10, 1, 'DIARIA') returning modo_controle`,
        [EMPRESA_A, A.locacaoRascunho, A.categoriaAndaime],
      );
      expect(item?.modo_controle).toBe("LOTE");
    });
  });

  it("item INDIVIDUAL exige quantidade inteira", async () => {
    await comoAtor(superusuario, (s) =>
      esperarErro(
        s,
        `insert into public.itens_locacao (empresa_id, locacao_id, categoria_id, descricao,
           quantidade_contratada, valor_unitario, periodicidade)
         values ($1, $2, $3, 'Meia estação', 1.5, 1, 'MENSAL')`,
        [EMPRESA_A, A.locacaoRascunho, A.categoriaEstacao],
        SQLSTATE.violacaoCheck,
      ),
    );
  });

  it("item de recebimento precisa ser da mesma locação do recebimento", async () => {
    await comoAtor(superusuario, (s) =>
      esperarErro(
        s,
        `insert into public.itens_recebimento (empresa_id, recebimento_id, item_locacao_id, quantidade)
         values ($1, $2, $3, 1)`,
        [EMPRESA_A, A.recebimentoAtiva, A.itemNotebook],
        SQLSTATE.violacaoCheck,
      ),
    );
  });

  it("bem em poder da empresa sempre tem local e responsável", async () => {
    await comoAtor(superusuario, (s) =>
      esperarErro(
        s,
        "update public.bens set local_atual_id = null where id = $1",
        [A.bemEstacao1],
        SQLSTATE.violacaoCheck,
      ),
    );
  });

  it("responsável precisa ser membro da mesma empresa", async () => {
    await comoAtor(superusuario, (s) =>
      esperarErro(
        s,
        "update public.bens set responsavel_atual_id = $1 where id = $2",
        [USUARIOS.adminB, A.bemEstacao1],
        SQLSTATE.violacaoFk,
      ),
    );
  });

  it("locação fora do rascunho precisa estar completa; cancelamento exige motivo", async () => {
    await comoAtor(superusuario, async (s) => {
      await esperarErro(
        s,
        "insert into public.locacoes (empresa_id, status, ativada_em) values ($1, 'ATIVA', now())",
        [EMPRESA_A],
        SQLSTATE.violacaoCheck,
      );
      await esperarErro(
        s,
        "update public.locacoes set status = 'CANCELADA', cancelada_em = now(), motivo_cancelamento = 'curto' where id = $1",
        [A.locacaoRascunho],
        SQLSTATE.violacaoCheck,
      );
    });
  });

  it("encerramento financeiro exige data informada (RN-61)", async () => {
    await comoAtor(superusuario, async (s) => {
      await s.query(
        "update public.locacoes set status_financeiro = 'ENCERRAMENTO_PENDENTE' where id = $1",
        [A.locacaoAtiva],
      );
      await esperarErro(
        s,
        "update public.locacoes set status_financeiro = 'ENCERRADO', encerrada_financeiro_em = now() where id = $1",
        [A.locacaoAtiva],
        SQLSTATE.violacaoCheck,
      );
    });
  });

  it("retirada confirmada exige data e nome de quem recebeu pelo fornecedor (RN-54)", async () => {
    await comoAtor(superusuario, async (s) => {
      await s.query(
        "update public.devolucoes set status = 'AGENDADA', agendada_para = now() where id = $1",
        [A.devolucao],
      );
      await esperarErro(
        s,
        "update public.devolucoes set status = 'RETIRADA_CONFIRMADA', retirada_confirmada_em = now() where id = $1",
        [A.devolucao],
        SQLSTATE.violacaoCheck,
      );
    });
  });

  it("valores monetários são numeric (sem float) com 2 casas", async () => {
    const colunas = await comoAtor(superusuario, (s) =>
      s.query<{ tabela: string; coluna: string; tipo: string; escala: number }>(
        `select table_name as tabela, column_name as coluna, data_type as tipo, numeric_scale as escala
         from information_schema.columns
         where table_schema = 'public' and column_name in ('valor_unitario', 'valor_cobrado')`,
      ),
    );
    expect(colunas.length).toBe(2);
    for (const c of colunas) {
      expect(c.tipo).toBe("numeric");
      expect(c.escala).toBe(2);
    }
    const floats = await comoAtor(superusuario, (s) =>
      s.query(
        `select table_name, column_name from information_schema.columns
         where table_schema = 'public' and data_type in ('real', 'double precision')`,
      ),
    );
    expect(floats).toEqual([]);
  });

  it("FK composta impede vínculo com cadastro de outra empresa mesmo para o superusuário", async () => {
    await comoAtor(superusuario, (s) =>
      esperarErro(
        s,
        "update public.locacoes set centro_custo_id = $1 where id = $2",
        [B.centroCusto1, A.locacaoRascunho],
        SQLSTATE.violacaoFk,
      ),
    );
  });
});
