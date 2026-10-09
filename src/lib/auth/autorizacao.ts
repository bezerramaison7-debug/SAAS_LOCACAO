import { notFound } from "next/navigation";

import { type Permissao } from "@/lib/permissions/matriz";

import { type Contexto } from "./contexto";

export class AcessoNegadoError extends Error {
  readonly permissao: Permissao;
  constructor(permissao: Permissao) {
    super(`Permissão necessária: ${permissao}`);
    this.name = "AcessoNegadoError";
    this.permissao = permissao;
  }
}

export function pode(contexto: Pick<Contexto, "permissoes">, permissao: Permissao): boolean {
  return contexto.permissoes.includes(permissao);
}

/** Server Actions/Route Handlers: lança AcessoNegadoError (o banco revalida — RLS). */
export function exigirPermissao(
  contexto: Pick<Contexto, "permissoes">,
  permissao: Permissao,
): void {
  if (!pode(contexto, permissao)) throw new AcessoNegadoError(permissao);
}

/** Páginas: sem permissão responde 404, indistinguível de inexistente (D-37). */
export function exigirPermissaoPagina(
  contexto: Pick<Contexto, "permissoes">,
  permissao: Permissao,
): void {
  if (!pode(contexto, permissao)) notFound();
}
