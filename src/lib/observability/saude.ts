export type EstadoDependencia = "ok" | "indisponivel";

export type ResultadoSaude = {
  status: "ok" | "degradado";
  verificado_em: string;
  dependencias?: { supabase: EstadoDependencia };
};

/**
 * Prontidão do Supabase via endpoint público de saúde do Auth. Não expõe
 * URL, versão nem mensagem de erro — apenas ok/indisponível.
 */
export async function verificarSupabase(
  supabaseUrl: string,
  chavePublica: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2000,
): Promise<EstadoDependencia> {
  try {
    const resposta = await fetchImpl(`${supabaseUrl}/auth/v1/health`, {
      headers: { apikey: chavePublica },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    return resposta.ok ? "ok" : "indisponivel";
  } catch {
    return "indisponivel";
  }
}
