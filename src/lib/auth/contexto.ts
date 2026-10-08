import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { logger } from "@/lib/observability/logger";
import { PAPEIS, permissoesDoPapel, type Papel, type Permissao } from "@/lib/permissions/matriz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { COOKIE_EMPRESA_ATIVA, resolverEmpresaAtiva, type Associacao } from "./empresa-ativa";
import { getUsuarioAutenticado, type UsuarioAutenticado } from "./sessao";

export type Contexto = {
  usuario: UsuarioAutenticado & { nome: string };
  empresa: { id: string; nome: string; timezone: string };
  papel: Papel;
  permissoes: readonly Permissao[];
  associacoes: readonly Associacao[];
};

export type EstadoAcesso =
  | { estado: "anonimo" }
  | { estado: "sem_empresa"; usuario: UsuarioAutenticado }
  | { estado: "escolher_empresa"; usuario: UsuarioAutenticado; associacoes: Associacao[] }
  | { estado: "ok"; contexto: Contexto };

function ehPapel(valor: string): valor is Papel {
  return (PAPEIS as readonly string[]).includes(valor);
}

/** Associações ATIVAS do usuário (RLS só devolve empresas/associações ativas). */
const carregarAssociacoes = cache(async (userId: string): Promise<Associacao[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("usuarios_empresa")
    .select("empresa_id, papel, empresas!inner(nome, timezone)")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("created_at");
  if (error) {
    logger.error("auth.associacoes.falhou", { modulo: "auth", erro_codigo: error.code });
    throw new Error("Falha ao carregar associações do usuário");
  }
  return (data ?? [])
    .filter((l) => ehPapel(l.papel))
    .map((l) => ({
      empresaId: l.empresa_id,
      empresaNome: l.empresas.nome,
      timezone: l.empresas.timezone,
      papel: l.papel as Papel,
    }));
});

const carregarNome = cache(async (userId: string): Promise<string> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("perfis_usuario")
    .select("nome")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.nome ?? "";
});

/**
 * Estado de acesso da requisição atual, derivado SOMENTE de: JWT verificado +
 * associações lidas do banco (RLS). O cookie de empresa é apenas preferência.
 */
export const getEstadoAcesso = cache(async (): Promise<EstadoAcesso> => {
  const usuario = await getUsuarioAutenticado();
  if (!usuario) return { estado: "anonimo" };
  const associacoes = await carregarAssociacoes(usuario.id);
  const preferida = (await cookies()).get(COOKIE_EMPRESA_ATIVA)?.value;
  const resolucao = resolverEmpresaAtiva(associacoes, preferida);
  if (resolucao.tipo === "sem_empresa") return { estado: "sem_empresa", usuario };
  if (resolucao.tipo === "escolher") {
    return { estado: "escolher_empresa", usuario, associacoes: resolucao.associacoes };
  }
  const { associacao } = resolucao;
  return {
    estado: "ok",
    contexto: {
      usuario: { ...usuario, nome: await carregarNome(usuario.id) },
      empresa: {
        id: associacao.empresaId,
        nome: associacao.empresaNome,
        timezone: associacao.timezone,
      },
      papel: associacao.papel,
      permissoes: permissoesDoPapel(associacao.papel),
      associacoes,
    },
  };
});

/** Para páginas e actions autenticadas: redireciona se não houver contexto válido. */
export async function exigirContexto(): Promise<Contexto> {
  const acesso = await getEstadoAcesso();
  switch (acesso.estado) {
    case "anonimo":
      redirect("/login");
    case "sem_empresa":
      redirect("/sem-acesso");
    case "escolher_empresa":
      redirect("/selecionar-empresa");
    case "ok":
      return acesso.contexto;
  }
}
