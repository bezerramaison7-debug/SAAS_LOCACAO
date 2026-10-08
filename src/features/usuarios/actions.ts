"use server";

import { revalidatePath } from "next/cache";

import { camposTexto, errosDoZod, falha, sucesso, type EstadoAcao } from "@/lib/actions/estado";
import { AcessoNegadoError, exigirPermissao } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { traduzirErroBanco } from "@/lib/db/erros";
import { clientEnv } from "@/lib/env/client";
import { logger } from "@/lib/observability/logger";
import { ROTULO_PAPEL } from "@/lib/permissions/matriz";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { alterarPapelSchema, convidarUsuarioSchema, definirAtivoSchema } from "./schemas";

const SEM_PERMISSAO = falha("Você não tem permissão para gerenciar usuários.");

/**
 * Convida (ou vincula, se já tiver conta) um usuário à empresa ATIVA do contexto.
 * O convite no Auth exige service role (D-06); a associação é feita pela
 * função do banco com o JWT do ADMIN, que revalida a permissão e audita.
 */
export async function convidarUsuario(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  try {
    exigirPermissao(contexto, "usuarios.gerenciar");
  } catch (e) {
    if (e instanceof AcessoNegadoError) return SEM_PERMISSAO;
    throw e;
  }
  const entrada = camposTexto(formData, ["email", "nome", "papel"]);
  const dados = convidarUsuarioSchema.safeParse(entrada);
  if (!dados.success) {
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  }
  const supabase = await createSupabaseServerClient();
  const { data: dentroDoLimite, error: erroLimite } = await supabase.rpc("consumir_limite_taxa", {
    p_acao: "usuarios.convidar",
  });
  if (erroLimite) return falha(traduzirErroBanco(erroLimite).mensagem, { valores: entrada });
  if (!dentroDoLimite)
    return falha("Limite de convites atingido. Tente novamente mais tarde.", { valores: entrada });

  const { email, nome, papel } = dados.data;
  let jaTinhaConta = false;
  const { error: erroConvite } = await createSupabaseAdminClient().auth.admin.inviteUserByEmail(
    email,
    {
      data: { nome },
      redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    },
  );
  if (erroConvite) {
    if (erroConvite.code === "email_exists") {
      jaTinhaConta = true;
    } else {
      logger.error("usuarios.convite.falhou", {
        modulo: "usuarios",
        erro_codigo: erroConvite.code ?? "?",
      });
      return falha("Não foi possível enviar o convite agora. Tente novamente.", {
        valores: entrada,
      });
    }
  }

  const { error } = await supabase.rpc("rpc_vincular_usuario", {
    p_empresa: contexto.empresa.id,
    p_email: email,
    p_nome: nome,
    p_papel: papel,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem, { valores: entrada });
  revalidatePath("/configuracoes/usuarios");
  return sucesso(
    jaTinhaConta
      ? `${email} já possuía conta: acesso concedido como ${ROTULO_PAPEL[papel]}.`
      : `Convite enviado para ${email} (${ROTULO_PAPEL[papel]}).`,
  );
}

export async function alterarPapel(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("usuarios.gerenciar")) return SEM_PERMISSAO;
  const dados = alterarPapelSchema.safeParse(camposTexto(formData, ["associacaoId", "papel"]));
  if (!dados.success) return falha("Dados inválidos.", { errosCampo: errosDoZod(dados.error) });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_alterar_papel", {
    p_associacao: dados.data.associacaoId,
    p_papel: dados.data.papel,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidatePath("/configuracoes/usuarios");
  return sucesso(`Papel alterado para ${ROTULO_PAPEL[dados.data.papel]}.`);
}

export async function definirUsuarioAtivo(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const contexto = await exigirContexto();
  if (!contexto.permissoes.includes("usuarios.gerenciar")) return SEM_PERMISSAO;
  const dados = definirAtivoSchema.safeParse(
    camposTexto(formData, ["associacaoId", "ativo", "motivo"]),
  );
  if (!dados.success)
    return falha("Revise os campos destacados.", { errosCampo: errosDoZod(dados.error) });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("rpc_definir_usuario_ativo", {
    p_associacao: dados.data.associacaoId,
    p_ativo: dados.data.ativo,
    p_motivo: dados.data.motivo,
  });
  if (error) return falha(traduzirErroBanco(error).mensagem);
  revalidatePath("/configuracoes/usuarios");
  return sucesso(dados.data.ativo ? "Acesso reativado." : "Acesso desativado.");
}
