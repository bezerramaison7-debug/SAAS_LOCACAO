import pg from "pg";

import { A, B, EMPRESA_A, EMPRESA_B, USUARIOS } from "../../support/fixtures";

/**
 * Pré-condições de E2E gravadas diretamente no banco LOCAL (o fluxo testado
 * continua todo pela interface). Cada teste usa a sua própria locação ativa,
 * para que quantidades acumuladas entre execuções não mudem o resultado.
 */
const URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(URL) && !process.env.CI) {
  throw new Error("Dados de E2E só podem ser gravados em banco local.");
}

export type LocacaoTeste = { id: string; codigo: string; itemIndividual: string; itemLote: string };

export async function criarLocacaoAtiva(
  rotulo: string,
  qtd = { individual: 2, lote: 20 },
  opcoes: { loteSemChecklist?: boolean } = {},
): Promise<LocacaoTeste> {
  const cliente = new pg.Client({ connectionString: URL });
  await cliente.connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<{ id: string; codigo: string }>(
      `insert into public.locacoes (empresa_id, fornecedor_id, centro_custo_id, status, inicio_previsto,
         termino_previsto, ativada_em, observacoes)
       values ($1, $2, $3, 'ATIVA', current_date, current_date + 60, now(), $4) returning id, codigo`,
      [EMPRESA_A, A.fornecedor1, A.centroCusto1, `[E2E] ${rotulo}`],
    );
    const locacao = rows[0];
    if (!locacao) throw new Error("locação não criada");
    let categoriaLote: string = A.categoriaAndaime;
    if (opcoes.loteSemChecklist) {
      const cat = await cliente.query<{ id: string }>(
        `insert into public.categorias_bem (empresa_id, nome, modo_controle, unidade_padrao)
         values ($1, $2, 'LOTE', 'peça') returning id`,
        [EMPRESA_A, `[E2E] Escora ${rotulo}`],
      );
      categoriaLote = cat.rows[0]?.id ?? categoriaLote;
    }
    const itens = await cliente.query<{ id: string; modo_controle: string }>(
      `insert into public.itens_locacao (empresa_id, locacao_id, categoria_id, descricao, quantidade_contratada,
         unidade, valor_unitario, periodicidade)
       values ($1, $2, $3, 'Estação total E2E', $5, 'un', 100, 'MENSAL'),
              ($1, $2, $4, 'Andaime E2E', $6, 'peça', 1, 'DIARIA')
       returning id, modo_controle`,
      [EMPRESA_A, locacao.id, A.categoriaEstacao, categoriaLote, qtd.individual, qtd.lote],
    );
    await cliente.query("commit");
    return {
      id: locacao.id,
      codigo: locacao.codigo,
      itemIndividual: itens.rows.find((i) => i.modo_controle === "INDIVIDUAL")?.id ?? "",
      itemLote: itens.rows.find((i) => i.modo_controle === "LOTE")?.id ?? "",
    };
  } finally {
    await cliente.end();
  }
}

/** JPEG mínimo válido (assinatura FFD8FF) para fotos de teste. */
export const JPEG_TESTE = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

export type AtivosRecebidos = {
  locacao: string;
  bens: { id: string; codigo: string }[];
  lote: { id: string; codigo: string } | null;
};

const EMPRESAS_E2E = {
  A: {
    empresa: EMPRESA_A,
    local: A.localAlmoxarifado,
    responsavel: USUARIOS.operacaoA,
  },
  B: {
    empresa: EMPRESA_B,
    local: B.local1,
    responsavel: USUARIOS.adminB,
  },
} as const;

/**
 * Bens (e, na empresa A, um lote de 20 peças) já recebidos e confirmados no
 * almoxarifado, prontos para movimentação/ocorrência/troca. Gravado como no
 * seed (o fluxo de recebimento tem a sua própria spec).
 */
export async function criarAtivosRecebidos(
  empresa: keyof typeof EMPRESAS_E2E,
  rotulo: string,
  quantidadeBens = 1,
): Promise<AtivosRecebidos> {
  const cfg = EMPRESAS_E2E[empresa];
  const locacao =
    empresa === "A"
      ? await criarLocacaoAtiva(rotulo, { individual: quantidadeBens, lote: 20 })
      : null;
  const cliente = new pg.Client({ connectionString: URL });
  await cliente.connect();
  try {
    await cliente.query("begin");
    let locacaoId = locacao?.id;
    let locacaoCodigo = locacao?.codigo ?? "";
    let itemIndividual = locacao?.itemIndividual ?? "";
    if (!locacaoId) {
      const { rows } = await cliente.query<{ id: string; codigo: string }>(
        `insert into public.locacoes (empresa_id, fornecedor_id, centro_custo_id, status, inicio_previsto,
           termino_previsto, ativada_em, observacoes)
         values ($1, $2, $3, 'ATIVA', current_date, current_date + 60, now(), $4) returning id, codigo`,
        [cfg.empresa, B.fornecedor1, B.centroCusto1, `[E2E] ${rotulo}`],
      );
      locacaoId = rows[0]?.id ?? "";
      locacaoCodigo = rows[0]?.codigo ?? "";
      const item = await cliente.query<{ id: string }>(
        `insert into public.itens_locacao (empresa_id, locacao_id, categoria_id, descricao, quantidade_contratada,
           unidade, valor_unitario, periodicidade)
         values ($1, $2, $3, 'Gerador E2E', $4, 'un', 10, 'MENSAL') returning id`,
        [cfg.empresa, locacaoId, B.categoriaGerador, quantidadeBens],
      );
      itemIndividual = item.rows[0]?.id ?? "";
    }
    const rec = await cliente.query<{ id: string }>(
      `insert into public.recebimentos (empresa_id, locacao_id, status, data_evento, recebido_por, local_id,
         responsavel_id, confirmado_em, confirmado_por)
       values ($1, $2, 'CONFIRMADO', now() - interval '1 day', $4, $3, $4, now() - interval '1 day', $4)
       returning id`,
      [cfg.empresa, locacaoId, cfg.local, cfg.responsavel],
    );
    const recebimento = rec.rows[0]?.id ?? "";
    const bens: AtivosRecebidos["bens"] = [];
    for (let i = 0; i < quantidadeBens; i++) {
      const b = await cliente.query<{ id: string; codigo: string }>(
        `insert into public.bens (empresa_id, item_locacao_id, recebimento_id, numero_serie, status,
           local_atual_id, responsavel_atual_id)
         values ($1, $2, $3, $4, 'DISPONIVEL', $5, $6) returning id, codigo`,
        [
          cfg.empresa,
          itemIndividual,
          recebimento,
          `E2E-${rotulo}-${i}`,
          cfg.local,
          cfg.responsavel,
        ],
      );
      const bem = b.rows[0];
      if (!bem) throw new Error("bem não criado");
      bens.push(bem);
      await cliente.query(
        `insert into public.itens_recebimento (empresa_id, recebimento_id, item_locacao_id, bem_id, quantidade, condicao)
         values ($1, $2, $3, $4, 1, 'BOM')`,
        [cfg.empresa, recebimento, itemIndividual, bem.id],
      );
    }
    let lote: AtivosRecebidos["lote"] = null;
    if (locacao) {
      const l = await cliente.query<{ id: string; codigo: string }>(
        `insert into public.lotes (empresa_id, item_locacao_id, recebimento_id, quantidade_recebida,
           local_atual_id, responsavel_atual_id)
         values ($1, $2, $3, 20, $4, $5) returning id, codigo`,
        [cfg.empresa, locacao.itemLote, recebimento, cfg.local, cfg.responsavel],
      );
      lote = l.rows[0] ?? null;
      await cliente.query(
        `insert into public.itens_recebimento (empresa_id, recebimento_id, item_locacao_id, lote_id, quantidade, condicao)
         values ($1, $2, $3, $4, 20, 'BOM')`,
        [cfg.empresa, recebimento, locacao.itemLote, lote?.id],
      );
    }
    await cliente.query("commit");
    return { locacao: locacaoCodigo, bens, lote };
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  } finally {
    await cliente.end();
  }
}
