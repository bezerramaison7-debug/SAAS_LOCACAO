import { type NextRequest, NextResponse } from "next/server";

import { clientEnv } from "@/lib/env/client";
import { TAMANHO_MAXIMO_BYTES } from "@/lib/evidencias/arquivo";
import { enviarEvidencia, metadadosEnvioSchema } from "@/lib/evidencias/servidor";
import { REQUEST_ID_HEADER, resolverRequestId } from "@/lib/observability/request-id";

const SEM_CACHE = { "Cache-Control": "no-store" };

function resposta(corpo: object, status: number, requestId: string) {
  return NextResponse.json(corpo, {
    status,
    headers: { ...SEM_CACHE, [REQUEST_ID_HEADER]: requestId },
  });
}

/**
 * POST /api/files — envio de evidência (multipart). Sessão exigida pelo proxy;
 * autorização sobre a entidade no banco. Rotas de API não têm a proteção de
 * origem das Server Actions, então a origem é conferida aqui (CSRF).
 */
export async function POST(request: NextRequest) {
  const requestId = resolverRequestId(request.headers.get(REQUEST_ID_HEADER));
  const origem = request.headers.get("origin");
  if (!origem || origem !== new URL(clientEnv.NEXT_PUBLIC_APP_URL).origin) {
    return resposta({ erro: "Origem não permitida." }, 403, requestId);
  }
  const tamanho = Number(request.headers.get("content-length") ?? "0");
  if (!tamanho || tamanho > TAMANHO_MAXIMO_BYTES + 64 * 1024) {
    return resposta({ erro: "Arquivo muito grande (máx. 20 MB)." }, 413, requestId);
  }
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return resposta({ erro: "Envio inválido." }, 400, requestId);
  }
  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File))
    return resposta({ erro: "Selecione um arquivo." }, 400, requestId);
  const campos = Object.fromEntries(
    [...formulario.entries()].filter(([, v]) => typeof v === "string") as [string, string][],
  );
  const meta = metadadosEnvioSchema.safeParse(campos);
  if (!meta.success) return resposta({ erro: "Dados do envio inválidos." }, 400, requestId);

  const resultado = await enviarEvidencia(meta.data, arquivo, requestId);
  return resultado.ok
    ? resposta({ id: resultado.id }, 201, requestId)
    : resposta({ erro: resultado.erro }, resultado.status, requestId);
}
