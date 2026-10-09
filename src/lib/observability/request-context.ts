import "server-only";

import { headers } from "next/headers";

import { REQUEST_ID_HEADER, resolverRequestId } from "./request-id";

/** Request id da requisição atual (definido pelo proxy). */
export async function getRequestId(): Promise<string> {
  const lista = await headers();
  return resolverRequestId(lista.get(REQUEST_ID_HEADER));
}
