import { expect } from "@playwright/test";

/** Leitura de e-mails capturados pelo Mailpit (local_smtp do Supabase / stack local). */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Resumo = { ID: string; Created: string; To: { Address: string }[]; Subject: string };

export async function ultimoEmailPara(
  destinatario: string,
  depoisDe: Date,
  assunto?: RegExp,
): Promise<{ html: string; assunto: string }> {
  let encontrado: Resumo | undefined;
  await expect
    .poll(
      async () => {
        const r = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${destinatario}"`)}`,
        );
        const { messages } = (await r.json()) as { messages: Resumo[] };
        encontrado = messages.find(
          (m) => new Date(m.Created) >= depoisDe && (!assunto || assunto.test(m.Subject)),
        );
        return Boolean(encontrado);
      },
      { timeout: 20_000, message: `e-mail para ${destinatario}` },
    )
    .toBe(true);
  const id = (encontrado as Resumo).ID;
  const corpo = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
    HTML: string;
    Subject: string;
  };
  return { html: corpo.HTML, assunto: corpo.Subject };
}

/** Extrai o link de confirmação (/auth/confirm?token_hash=…) do e-mail. */
export function linkConfirmacao(html: string): string {
  const match = /href="([^"]*\/auth\/confirm\?token_hash=[^"]+)"/.exec(html);
  if (!match?.[1]) throw new Error("Link de confirmação não encontrado no e-mail");
  return match[1].replace(/&amp;/g, "&");
}
