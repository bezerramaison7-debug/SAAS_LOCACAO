import { maquinaBem, maquinaLote } from "@/features/ativos/rules/maquina-estado";
import { maquinaChecklist } from "@/features/checklists/rules/maquina-estado";
import { maquinaCobranca } from "@/features/cobrancas/rules/maquina-estado";
import { maquinaDevolucao } from "@/features/devolucoes/rules/maquina-estado";
import { maquinaFinanceiro, maquinaLocacao } from "@/features/locacoes/rules/maquina-estado";
import { maquinaMovimentacao } from "@/features/movimentacoes/rules/maquina-estado";
import { maquinaOcorrencia } from "@/features/ocorrencias/rules/maquina-estado";
import { maquinaRecebimento } from "@/features/recebimentos/rules/maquina-estado";
import { maquinaRelatorio } from "@/features/relatorios/rules/maquina-estado";
import { maquinaVistoria } from "@/features/vistorias/rules/maquina-estado";

import { listarTransicoes } from "./maquina-estado";

/** Todas as máquinas de estado do domínio (usado no teste de paridade com o banco). */
export const MAQUINAS = [
  maquinaLocacao,
  maquinaFinanceiro,
  maquinaBem,
  maquinaLote,
  maquinaRecebimento,
  maquinaVistoria,
  maquinaMovimentacao,
  maquinaOcorrencia,
  maquinaDevolucao,
  maquinaCobranca,
  maquinaRelatorio,
  maquinaChecklist,
] as const;

export function todasTransicoes(): { maquina: string; de: string; para: string }[] {
  return MAQUINAS.flatMap((m) => listarTransicoes(m as Parameters<typeof listarTransicoes>[0]));
}
