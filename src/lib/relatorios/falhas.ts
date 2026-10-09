/**
 * Classifica erros do Storage no worker de relatórios. Falha transitória
 * (rede, 5xx, 429) não pode virar conteúdo do relatório: o job falha e é
 * tentado de novo. Só uma resposta definitiva (ex.: objeto inexistente)
 * vira "imagem indisponível" no PDF.
 */
export function falhaTransitoria(erro: unknown): boolean {
  const status =
    typeof erro === "object" && erro !== null && "status" in erro ? erro.status : undefined;
  if (typeof status !== "number") return true;
  return status === 429 || status >= 500;
}
