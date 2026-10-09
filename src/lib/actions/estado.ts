import { type ZodError } from "zod";

/** Estado retornado por Server Actions de formulário (useActionState). */
export type EstadoAcao = {
  status: "ocioso" | "sucesso" | "erro";
  mensagem?: string;
  errosCampo?: Record<string, string>;
  /** Valores enviados, para repreencher o formulário após erro (nunca senhas). */
  valores?: Record<string, string>;
};

export const ESTADO_INICIAL: EstadoAcao = { status: "ocioso" };

/** Primeiro erro de cada campo, para exibir junto ao campo. */
export function errosDoZod(erro: ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of erro.issues) {
    const campo = issue.path.join(".") || "_";
    campos[campo] ??= issue.message;
  }
  return campos;
}

export function falha(
  mensagem: string,
  extras: Omit<EstadoAcao, "status" | "mensagem"> = {},
): EstadoAcao {
  return { status: "erro", mensagem, ...extras };
}

export function sucesso(mensagem: string): EstadoAcao {
  return { status: "sucesso", mensagem };
}

/** Lê campos de texto de um FormData (ignora arquivos). */
export function camposTexto(formData: FormData, nomes: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    nomes.map((n) => {
      const v = formData.get(n);
      return [n, typeof v === "string" ? v : ""];
    }),
  );
}
