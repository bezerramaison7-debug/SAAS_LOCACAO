"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { camposTexto, errosDoZod, falha, sucesso, type EstadoAcao } from "@/lib/actions/estado";
import { registrarEventoAutenticacao } from "@/lib/audit/autenticacao";
import { getEstadoAcesso } from "@/lib/auth/contexto";
import { COOKIE_EMPRESA_ATIVA } from "@/lib/auth/empresa-ativa";
import { destinoSeguro } from "@/lib/auth/redirecionamento";
import { getUsuarioAutenticado } from "@/lib/auth/sessao";
import { clientEnv } from "@/lib/env/client";
import { logger } from "@/lib/observability/logger";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  escolherEmpresaSchema,
  loginSchema,
  mensagemErroLogin,
  recuperarSenhaSchema,
  redefinirSenhaSchema,
} from "./schemas";

const MENSAGEM_RECUPERACAO =
  "Se o e-mail estiver cadastrado, você receberá em instantes um link para redefinir a senha.";

export async function entrar(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const entrada = camposTexto(formData, ["email", "senha", "next"]);
  const dados = loginSchema.safeParse(entrada);
  if (!dados.success) {
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: { email: entrada.email ?? "" },
    });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });
  if (error || !data.user) {
    await registrarEventoAutenticacao({
      tipo: "login.falha",
      email: dados.data.email,
      motivo: error?.code ?? "desconhecido",
    });
    return falha(mensagemErroLogin(error?.code), { valores: { email: dados.data.email } });
  }
  await registrarEventoAutenticacao({ tipo: "login.sucesso", userId: data.user.id });
  redirect(destinoSeguro(dados.data.next));
}

export async function sair(): Promise<void> {
  const usuario = await getUsuarioAutenticado();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(COOKIE_EMPRESA_ATIVA);
  if (usuario) await registrarEventoAutenticacao({ tipo: "logout", userId: usuario.id });
  redirect("/login?saiu=1");
}

export async function solicitarRecuperacao(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const entrada = camposTexto(formData, ["email"]);
  const dados = recuperarSenhaSchema.safeParse(entrada);
  if (!dados.success) {
    return falha("Revise os campos destacados.", {
      errosCampo: errosDoZod(dados.error),
      valores: entrada,
    });
  }
  const { error } = await createSupabaseAnonClient().auth.resetPasswordForEmail(dados.data.email, {
    redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/confirm`,
  });
  // Resposta sempre neutra: não revela se o e-mail existe (exceto limite de taxa).
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return falha(mensagemErroLogin(error.code), { valores: entrada });
  }
  if (error)
    logger.warn("auth.recuperacao.erro", { modulo: "auth", erro_codigo: error.code ?? "?" });
  await registrarEventoAutenticacao({
    tipo: "senha.recuperacao",
    email: dados.data.email,
    motivo: error?.code ?? null,
  });
  return sucesso(MENSAGEM_RECUPERACAO);
}

export async function redefinirSenha(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  const usuario = await getUsuarioAutenticado();
  if (!usuario) return falha("O link expirou. Solicite uma nova recuperação de senha.");
  const dados = redefinirSenhaSchema.safeParse(camposTexto(formData, ["senha", "confirmacao"]));
  if (!dados.success)
    return falha("Revise os campos destacados.", { errosCampo: errosDoZod(dados.error) });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: dados.data.senha });
  if (error) {
    const mensagem =
      error.code === "same_password"
        ? "A nova senha deve ser diferente da anterior."
        : error.code === "weak_password"
          ? "Senha fraca. Use ao menos 10 caracteres com maiúsculas, minúsculas e números."
          : "Não foi possível alterar a senha. Solicite um novo link.";
    return falha(mensagem);
  }
  await registrarEventoAutenticacao({ tipo: "senha.redefinida", userId: usuario.id });
  redirect("/dashboard");
}

/** Define a empresa ativa: só aceita empresas em que o usuário tem associação ativa. */
export async function escolherEmpresa(formData: FormData): Promise<void> {
  const dados = escolherEmpresaSchema.safeParse(camposTexto(formData, ["empresaId"]));
  const acesso = await getEstadoAcesso();
  if (acesso.estado === "anonimo") redirect("/login");
  const associacoes =
    acesso.estado === "ok"
      ? acesso.contexto.associacoes
      : acesso.estado === "escolher_empresa"
        ? acesso.associacoes
        : [];
  if (!dados.success || !associacoes.some((a) => a.empresaId === dados.data.empresaId)) {
    redirect("/selecionar-empresa?erro=1");
  }
  (await cookies()).set(COOKIE_EMPRESA_ATIVA, dados.data.empresaId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
