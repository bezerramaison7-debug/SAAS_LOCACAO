/**
 * Tradução de erros do PostgREST/Postgres para mensagens operacionais.
 * Mensagens das funções de domínio (P0002, 22023, 23505) já vêm em português e
 * são seguras para exibir; demais erros viram mensagem genérica (o detalhe vai
 * só para o log, com request_id).
 */
export type CodigoErroDominio =
  | "SEM_PERMISSAO"
  | "NAO_ENCONTRADO"
  | "DUPLICADO"
  | "INVALIDO"
  | "TRANSICAO_INVALIDA"
  | "INDISPONIVEL"
  | "DESCONHECIDO";

export type ErroDominio = { codigo: CodigoErroDominio; mensagem: string };

type ErroBanco = { code?: string | null; message?: string | null };

const MENSAGENS_PADRAO: Record<CodigoErroDominio, string> = {
  SEM_PERMISSAO: "Você não tem permissão para esta operação.",
  NAO_ENCONTRADO: "Registro não encontrado.",
  DUPLICADO: "Já existe um registro com estes dados.",
  INVALIDO: "Dados inválidos. Revise os campos e tente novamente.",
  TRANSICAO_INVALIDA: "Esta operação não é permitida na situação atual do registro.",
  INDISPONIVEL: "Serviço temporariamente indisponível. Tente novamente em instantes.",
  DESCONHECIDO: "Não foi possível concluir a operação. Tente novamente.",
};

export function traduzirErroBanco(erro: ErroBanco | null | undefined): ErroDominio {
  const code = erro?.code ?? "";
  const mensagemDominio = erro?.message?.trim();
  switch (code) {
    case "42501":
      return { codigo: "SEM_PERMISSAO", mensagem: MENSAGENS_PADRAO.SEM_PERMISSAO };
    case "P0002":
      return {
        codigo: "NAO_ENCONTRADO",
        mensagem: mensagemDominio || MENSAGENS_PADRAO.NAO_ENCONTRADO,
      };
    case "23505":
      return {
        codigo: "DUPLICADO",
        mensagem: mensagemDominio?.startsWith("duplicate key")
          ? MENSAGENS_PADRAO.DUPLICADO
          : mensagemDominio || MENSAGENS_PADRAO.DUPLICADO,
      };
    case "22023":
      return { codigo: "INVALIDO", mensagem: mensagemDominio || MENSAGENS_PADRAO.INVALIDO };
    case "23514":
      return mensagemDominio?.startsWith("Transição")
        ? { codigo: "TRANSICAO_INVALIDA", mensagem: MENSAGENS_PADRAO.TRANSICAO_INVALIDA }
        : { codigo: "INVALIDO", mensagem: regraNegocio(mensagemDominio) };
    case "23502":
    case "23503":
    case "22P02":
      return { codigo: "INVALIDO", mensagem: MENSAGENS_PADRAO.INVALIDO };
    case "PGRST301":
    case "PGRST302":
      return { codigo: "SEM_PERMISSAO", mensagem: "Sua sessão expirou. Entre novamente." };
    case "PGRST116":
      return { codigo: "NAO_ENCONTRADO", mensagem: MENSAGENS_PADRAO.NAO_ENCONTRADO };
    default:
      if (/fetch failed|ECONNREFUSED|network/i.test(erro?.message ?? "")) {
        return { codigo: "INDISPONIVEL", mensagem: MENSAGENS_PADRAO.INDISPONIVEL };
      }
      return { codigo: "DESCONHECIDO", mensagem: MENSAGENS_PADRAO.DESCONHECIDO };
  }
}

/** Mensagens de triggers de negócio (em português) podem ser exibidas; checks crus não. */
function regraNegocio(mensagem: string | undefined): string {
  if (mensagem && !/violates check constraint|new row for relation/i.test(mensagem))
    return mensagem;
  return MENSAGENS_PADRAO.INVALIDO;
}
