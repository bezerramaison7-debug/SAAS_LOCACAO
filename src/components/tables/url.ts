export type ParametrosBusca = Record<string, string | string[] | undefined>;

/**
 * Monta a URL de uma listagem preservando os filtros atuais e aplicando
 * alterações. `null` remove o parâmetro. Mudar filtros/tamanho volta à página 1.
 */
export function montarUrlListagem(
  caminho: string,
  atuais: ParametrosBusca,
  alteracoes: Record<string, string | number | null>,
): string {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(atuais)) {
    if (valor === undefined) continue;
    for (const item of Array.isArray(valor) ? valor : [valor]) params.append(chave, item);
  }
  for (const [chave, valor] of Object.entries(alteracoes)) {
    params.delete(chave);
    if (valor !== null) params.set(chave, String(valor));
  }
  if (!("pagina" in alteracoes)) params.delete("pagina");
  if (params.get("pagina") === "1") params.delete("pagina");
  params.sort();
  const query = params.toString();
  return query ? `${caminho}?${query}` : caminho;
}
