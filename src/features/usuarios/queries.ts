import "server-only";

import { type Contexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { logger } from "@/lib/observability/logger";
import { type Papel } from "@/lib/permissions/matriz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UsuarioEmpresa = {
  associacaoId: string;
  userId: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  ultimoAcesso: string | null;
};

/** Lista usuários da empresa ativa (função do banco exige usuarios.gerenciar). */
export async function listarUsuariosEmpresa(contexto: Contexto): Promise<UsuarioEmpresa[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rpc_listar_usuarios_empresa", {
    p_empresa: contexto.empresa.id,
  });
  if (error) {
    logger.error("usuarios.listar.falhou", { modulo: "usuarios", erro_codigo: error.code });
    throw new Error(traduzirErroBanco(error).mensagem);
  }
  return (data ?? []).map((u) => ({
    associacaoId: u.associacao_id,
    userId: u.user_id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    ativo: u.ativo,
    ultimoAcesso: u.ultimo_acesso,
  }));
}
