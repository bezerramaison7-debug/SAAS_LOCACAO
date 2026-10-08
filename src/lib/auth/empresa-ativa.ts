import { type Papel } from "@/lib/permissions/matriz";

export const COOKIE_EMPRESA_ATIVA = "empresa_ativa";

export type Associacao = {
  empresaId: string;
  empresaNome: string;
  timezone: string;
  papel: Papel;
};

export type ResolucaoEmpresa =
  | { tipo: "sem_empresa" }
  | { tipo: "escolher"; associacoes: Associacao[] }
  | { tipo: "ok"; associacao: Associacao };

/**
 * O cookie de empresa ativa é só PREFERÊNCIA (nunca prova de autorização):
 * vale apenas se corresponder a uma associação ativa lida do banco.
 */
export function resolverEmpresaAtiva(
  associacoes: readonly Associacao[],
  preferida: string | undefined,
): ResolucaoEmpresa {
  if (associacoes.length === 0) return { tipo: "sem_empresa" };
  const escolhida = associacoes.find((a) => a.empresaId === preferida);
  if (escolhida) return { tipo: "ok", associacao: escolhida };
  if (associacoes.length === 1) return { tipo: "ok", associacao: associacoes[0] as Associacao };
  return { tipo: "escolher", associacoes: [...associacoes] };
}
