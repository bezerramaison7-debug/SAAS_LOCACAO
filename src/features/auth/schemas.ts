import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe o e-mail")
  .max(254, "E-mail muito longo")
  .pipe(z.email({ message: "Informe um e-mail válido" }));

/** Mesma política configurada no Supabase Auth (config.toml): ≥ 10, maiúscula, minúscula, dígito. */
export const novaSenhaSchema = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres")
  .max(72, "A senha deve ter no máximo 72 caracteres")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula")
  .regex(/[0-9]/, "Inclua ao menos um número");

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, "Informe a senha").max(72, "Senha inválida"),
  next: z.string().max(500).optional(),
});

export const recuperarSenhaSchema = z.object({ email: emailSchema });

export const redefinirSenhaSchema = z
  .object({ senha: novaSenhaSchema, confirmacao: z.string() })
  .refine((d) => d.senha === d.confirmacao, {
    message: "As senhas não conferem",
    path: ["confirmacao"],
  });

export const escolherEmpresaSchema = z.object({
  empresaId: z.uuid({ message: "Empresa inválida" }),
});

/** Mensagens específicas por código de erro do Supabase Auth (sem revelar se o e-mail existe). */
export function mensagemErroLogin(codigo: string | undefined): string {
  switch (codigo) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "E-mail ainda não confirmado. Use o link enviado para a sua caixa de entrada.";
    case "user_banned":
      return "Acesso bloqueado. Procure o administrador da sua empresa.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    default:
      return "Não foi possível entrar agora. Tente novamente em instantes.";
  }
}
