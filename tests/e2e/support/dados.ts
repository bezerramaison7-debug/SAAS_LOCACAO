import pg from "pg";

import { A, EMPRESA_A } from "../../support/fixtures";

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
