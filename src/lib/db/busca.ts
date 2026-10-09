/**
 * Monta o filtro `or` do PostgREST para busca textual (ILIKE) em várias colunas
 * com o termo do usuário. O termo vai entre aspas duplas (sintaxe PostgREST),
 * escapando `\` e `"`; vírgulas, parênteses e pontos não quebram o filtro.
 * Curingas `%`/`_` digitados são tratados como texto literal.
 */
export function filtroBuscaIlike(colunas: readonly string[], termo: string): string | null {
  const limpo = termo.trim().slice(0, 100);
  if (!limpo) return null;
  for (const c of colunas) {
    if (!/^[a-z_][a-z0-9_]*$/.test(c)) throw new Error(`Coluna inválida para busca: ${c}`);
  }
  const literal = limpo.replace(/[\\%_]/g, (m) => `\\${m}`);
  const valor = `"%${literal.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}%"`;
  return colunas.map((c) => `${c}.ilike.${valor}`).join(",");
}
