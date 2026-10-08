export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Falha cedo, com mensagem compreensível, se faltar variável obrigatória.
    const { validarAmbienteNaInicializacao } = await import("@/lib/env/startup");
    validarAmbienteNaInicializacao();
  }
}
