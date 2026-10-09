import { type TablesInsert } from "@/types/database";

/**
 * Colunas obrigatórias que o BANCO preenche por trigger (o cliente nem tem
 * permissão de inseri-las): `codigo` (sequência por empresa) e `modo_controle`
 * (herdado da categoria — RN-11). O gerador de tipos não sabe disso, então a
 * inserção é tipada sem essas colunas e convertida em um único lugar.
 */
type Gerados = {
  locacoes: "codigo";
  recebimentos: "codigo";
  itens_locacao: "modo_controle";
};

export function insercaoComGerados<T extends keyof Gerados>(
  _tabela: T,
  linha: Omit<TablesInsert<T>, Gerados[T]>,
): TablesInsert<T> {
  return linha as TablesInsert<T>;
}
