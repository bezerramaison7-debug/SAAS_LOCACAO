import "server-only";

import QRCode from "qrcode";

import { clientEnv } from "@/lib/env/client";

/**
 * URL curta impressa na etiqueta. Contém só o id do ativo: abrir o QR exige
 * login e a resolução passa pela RLS da empresa ativa (D-58).
 */
export function urlQr(id: string): string {
  return new URL(`/q/${id}`, clientEnv.NEXT_PUBLIC_APP_URL).toString();
}

/** QR em data URI SVG (permitido por `img-src data:` na CSP; sem HTML injetado). */
export async function qrDataUri(id: string): Promise<string> {
  const svg = await QRCode.toString(urlQr(id), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
