import { redact } from "./redact";

export type NivelLog = "debug" | "info" | "warn" | "error";

export type ContextoLog = {
  request_id?: string;
  modulo?: string;
  operacao?: string;
  empresa_id?: string;
  user_id?: string;
  duracao_ms?: number;
  erro_codigo?: string;
  [chave: string]: unknown;
};

const PRIORIDADE: Record<NivelLog, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function nivelMinimo(): NivelLog {
  const nivel = process.env.LOG_LEVEL;
  if (nivel === "debug" || nivel === "info" || nivel === "warn" || nivel === "error") return nivel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

/**
 * Logger JSON estruturado (uma linha por evento). Todo contexto passa por
 * `redact`, que oculta senhas, tokens, chaves e cookies.
 */
function escrever(nivel: NivelLog, mensagem: string, contexto: ContextoLog = {}): void {
  if (process.env.NODE_ENV === "test" && process.env.LOG_IN_TESTS !== "1") return;
  if (PRIORIDADE[nivel] < PRIORIDADE[nivelMinimo()]) return;
  const linha = JSON.stringify({
    ts: new Date().toISOString(),
    level: nivel,
    msg: mensagem,
    ...(redact(contexto) as Record<string, unknown>),
  });
  if (nivel === "error") console.error(linha);
  else if (nivel === "warn") console.warn(linha);
  else console.log(linha);
}

export const logger = {
  debug: (mensagem: string, contexto?: ContextoLog) => escrever("debug", mensagem, contexto),
  info: (mensagem: string, contexto?: ContextoLog) => escrever("info", mensagem, contexto),
  warn: (mensagem: string, contexto?: ContextoLog) => escrever("warn", mensagem, contexto),
  error: (mensagem: string, contexto?: ContextoLog) => escrever("error", mensagem, contexto),
};

/**
 * Mede a duração de uma operação e registra sucesso/erro com o mesmo contexto.
 * O erro é relançado sem alteração.
 */
export async function medir<T>(
  contexto: ContextoLog & { modulo: string; operacao: string },
  executar: () => Promise<T>,
): Promise<T> {
  const inicio = performance.now();
  try {
    const resultado = await executar();
    logger.info("operacao.concluida", {
      ...contexto,
      duracao_ms: Math.round(performance.now() - inicio),
    });
    return resultado;
  } catch (erro) {
    logger.error("operacao.falhou", {
      ...contexto,
      duracao_ms: Math.round(performance.now() - inicio),
      erro,
    });
    throw erro;
  }
}
