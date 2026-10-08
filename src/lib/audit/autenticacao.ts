import "server-only";

import { headers } from "next/headers";

import { serverEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { pseudonimizar } from "./pseudonimizar";

export type EventoAutenticacao =
  "login.sucesso" | "login.falha" | "logout" | "senha.recuperacao" | "senha.redefinida";

/**
 * Registra evento de autenticação (sem senha, token ou e-mail em claro).
 * Usa service role porque o evento pode não ter usuário/empresa (falha de
 * login). Nunca lança: falha de auditoria de login não bloqueia o usuário, mas
 * é registrada no log.
 */
export async function registrarEventoAutenticacao(evento: {
  tipo: EventoAutenticacao;
  userId?: string | null;
  email?: string | null;
  motivo?: string | null;
}): Promise<void> {
  try {
    const lista = await headers();
    const ip = lista.get("x-forwarded-for")?.split(",")[0]?.trim() ?? lista.get("x-real-ip") ?? "";
    const segredo = serverEnv.REPORT_SIGNING_SECRET;
    const { error } = await createSupabaseAdminClient().rpc("registrar_evento_autenticacao", {
      p_evento: evento.tipo,
      p_request_id: await getRequestId(),
      ...(evento.userId ? { p_user_id: evento.userId } : {}),
      ...(evento.email ? { p_email_hash: pseudonimizar(evento.email, segredo) } : {}),
      ...(ip ? { p_ip_hash: pseudonimizar(ip, segredo) } : {}),
      ...(evento.motivo ? { p_motivo: evento.motivo } : {}),
    });
    if (error) throw error;
  } catch (erro) {
    logger.error("auditoria.autenticacao.falhou", { modulo: "auth", operacao: evento.tipo, erro });
  }
}
