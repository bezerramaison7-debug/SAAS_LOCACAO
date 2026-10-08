/** Rótulos das situações exibidas nas abas do detalhe da locação. */
export const ROTULO_STATUS_RECEBIMENTO: Record<string, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_AUTORIZACAO: "Aguardando autorização",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
};

export const ROTULO_STATUS_BEM: Record<string, string> = {
  AGUARDANDO_RECEBIMENTO: "Aguardando recebimento",
  DISPONIVEL: "Disponível",
  EM_USO: "Em uso",
  EM_TRANSFERENCIA: "Em transferência",
  EM_MANUTENCAO: "Em manutenção",
  DEVOLUCAO_SOLICITADA: "Devolução solicitada",
  DEVOLVIDO: "Devolvido",
  EXTRAVIADO: "Extraviado",
  SUBSTITUIDO: "Substituído",
  BAIXADO: "Baixado",
  CANCELADO: "Cancelado",
};

export const ROTULO_STATUS_LOTE: Record<string, string> = {
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
  CANCELADO: "Cancelado",
};

export const ROTULO_STATUS_MOVIMENTACAO: Record<string, string> = {
  PENDENTE_ACEITE: "Pendente de aceite",
  CONFIRMADA: "Confirmada",
  RECUSADA: "Recusada",
  CANCELADA: "Cancelada",
};

export const ROTULO_STATUS_DEVOLUCAO: Record<string, string> = {
  RASCUNHO: "Rascunho",
  SOLICITADA: "Solicitada",
  AGENDADA: "Agendada",
  RETIRADA_CONFIRMADA: "Retirada confirmada",
  CONFERIDA: "Conferida",
  CANCELADA: "Cancelada",
};

export const ROTULO_STATUS_COBRANCA: Record<string, string> = {
  PENDENTE: "Pendente",
  CONFERIDA: "Conferida",
  DIVERGENTE: "Divergente",
  RESOLVIDA: "Resolvida",
};

export const ROTULO_TIPO_EVIDENCIA: Record<string, string> = {
  FOTO: "Foto",
  DOCUMENTO: "Documento",
  COMPROVANTE: "Comprovante",
  CONTRATO: "Contrato",
};

export const ROTULO_STATUS_EVIDENCIA: Record<string, string> = {
  ATIVA: "Ativa",
  SUBSTITUIDA: "Substituída",
  REMOVIDA: "Removida",
};

/** Ações de auditoria em linguagem operacional; desconhecidas aparecem como o código técnico. */
const ROTULO_ACAO: Record<string, string> = {
  "locacoes.insert": "Locação criada (rascunho)",
  "locacoes.update": "Dados da locação alterados",
  "locacao.ativar": "Locação ativada",
  "locacao.cancelar": "Locação cancelada",
  "itens_locacao.insert": "Item incluído",
  "itens_locacao.update": "Item alterado",
  "itens_locacao.delete": "Item excluído",
  "referencias_externas.insert": "Documento Sectra vinculado",
  "referencias_externas.update": "Documento Sectra alterado",
  "referencias_externas.delete": "Documento Sectra desvinculado",
};

export function rotuloAcaoAuditoria(acao: string): string {
  return ROTULO_ACAO[acao] ?? acao;
}

export function rotulo(mapa: Record<string, string>, valor: string): string {
  return mapa[valor] ?? valor;
}
