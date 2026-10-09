import { describe, expect, it } from "vitest";

import {
  MATRIZ,
  PAPEIS,
  PERMISSOES,
  PERMISSOES_LEITURA,
  permissoesDoPapel,
  temPermissao,
} from "./matriz";

describe("matriz de permissões", () => {
  it("ADMIN tem todas as permissões", () => {
    expect(permissoesDoPapel("ADMIN")).toEqual(PERMISSOES);
  });

  it("AUDITOR é somente leitura (nenhuma mutação operacional)", () => {
    const doAuditor = permissoesDoPapel("AUDITOR");
    expect(doAuditor.length).toBeGreaterThan(0);
    expect(doAuditor.every((p) => PERMISSOES_LEITURA.includes(p))).toBe(true);
  });

  it("RESPONSAVEL_LOCAL não tem leitura geral nem valores", () => {
    expect(temPermissao("RESPONSAVEL_LOCAL", "dados.ler_geral")).toBe(false);
    expect(temPermissao("RESPONSAVEL_LOCAL", "valores.ver")).toBe(false);
    expect(temPermissao("RESPONSAVEL_LOCAL", "movimentacao.aceitar")).toBe(true);
  });

  it("encerramento financeiro exige FINANCEIRO ou ADMIN (RN-61)", () => {
    expect(PAPEIS.filter((p) => temPermissao(p, "locacao.encerrar_financeiro"))).toEqual([
      "ADMIN",
      "FINANCEIRO",
    ]);
  });

  it("operação não encerra o financeiro e o financeiro não encerra a operação (RN-62)", () => {
    expect(temPermissao("OPERACAO", "locacao.encerrar_financeiro")).toBe(false);
    expect(temPermissao("FINANCEIRO", "locacao.encerrar_operacional")).toBe(false);
  });

  it("quem registra recebimento não autoriza o próprio excesso (RN-25)", () => {
    expect(temPermissao("OPERACAO", "recebimento.registrar")).toBe(true);
    expect(temPermissao("OPERACAO", "recebimento.autorizar_excesso")).toBe(false);
  });

  it("GESTOR consulta e gera relatórios, sem mutação operacional", () => {
    expect(temPermissao("GESTOR", "relatorio.gerar")).toBe(true);
    expect(temPermissao("GESTOR", "locacao.criar")).toBe(false);
    expect(temPermissao("GESTOR", "recebimento.registrar")).toBe(false);
  });

  it("todo papel tem ao menos uma permissão e nomes seguem o padrão do banco", () => {
    for (const papel of PAPEIS) expect(permissoesDoPapel(papel).length).toBeGreaterThan(0);
    for (const p of PERMISSOES) expect(p).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
  });

  it("sem papéis duplicados por permissão", () => {
    for (const [permissao, papeis] of Object.entries(MATRIZ)) {
      expect(new Set(papeis).size, permissao).toBe(papeis.length);
    }
  });
});
