import { describe, expect, it } from "vitest";

import {
  bemEstaAtivo,
  maquinaBem,
  STATUS_BEM_ATIVOS,
} from "@/features/ativos/rules/maquina-estado";
import { maquinaDevolucao } from "@/features/devolucoes/rules/maquina-estado";
import { maquinaFinanceiro, maquinaLocacao } from "@/features/locacoes/rules/maquina-estado";
import { maquinaMovimentacao } from "@/features/movimentacoes/rules/maquina-estado";

import {
  definirMaquina,
  destinosPossiveis,
  ehFinal,
  exigirTransicao,
  podeTransitar,
  TransicaoInvalidaError,
  type MaquinaEstado,
} from "./maquina-estado";
import { MAQUINAS, todasTransicoes } from "./maquinas";

function alcancaveis<E extends string>(m: MaquinaEstado<E>): Set<E> {
  const vistos = new Set<E>([m.inicial]);
  const fila: E[] = [m.inicial];
  while (fila.length > 0) {
    const atual = fila.shift() as E;
    for (const prox of m.transicoes[atual]) {
      if (!vistos.has(prox)) {
        vistos.add(prox);
        fila.push(prox);
      }
    }
  }
  return vistos;
}

describe.each(MAQUINAS.map((m) => [m.nome, m] as const))("máquina %s", (_, maquina) => {
  const m = maquina as MaquinaEstado<string>;

  it("todo estado tem entrada na tabela e é alcançável a partir do inicial", () => {
    expect(Object.keys(m.transicoes).sort()).toEqual([...m.estados].sort());
    expect([...alcancaveis(m)].sort()).toEqual([...m.estados].sort());
  });

  it("tem ao menos um estado final", () => {
    expect(m.estados.some((e) => ehFinal(m, e))).toBe(true);
  });
});

describe("locação e financeiro (RN-60..RN-62)", () => {
  it("cancelamento só a partir de RASCUNHO ou ATIVA", () => {
    const origens = maquinaLocacao.estados.filter((e) =>
      podeTransitar(maquinaLocacao, e, "CANCELADA"),
    );
    expect(origens.sort()).toEqual(["ATIVA", "RASCUNHO"]);
  });

  it("encerramento operacional só a partir de EM_DEVOLUCAO", () => {
    expect(
      maquinaLocacao.estados.filter((e) =>
        podeTransitar(maquinaLocacao, e, "ENCERRADA_OPERACIONALMENTE"),
      ),
    ).toEqual(["EM_DEVOLUCAO"]);
  });

  it("encerramento financeiro só a partir de ENCERRAMENTO_PENDENTE (nunca direto)", () => {
    expect(
      maquinaFinanceiro.estados.filter((e) => podeTransitar(maquinaFinanceiro, e, "ENCERRADO")),
    ).toEqual(["ENCERRAMENTO_PENDENTE"]);
  });

  it("máquinas operacional e financeira não compartilham estados", () => {
    const comuns = maquinaLocacao.estados.filter((e) =>
      (maquinaFinanceiro.estados as readonly string[]).includes(e),
    );
    expect(comuns).toEqual([]);
  });
});

describe("bem", () => {
  it("SUBSTITUIDO, DEVOLVIDO, BAIXADO e CANCELADO são finais", () => {
    for (const e of ["SUBSTITUIDO", "DEVOLVIDO", "BAIXADO", "CANCELADO"] as const) {
      expect(ehFinal(maquinaBem, e)).toBe(true);
    }
  });

  it("EXTRAVIADO só é alcançado a partir de estados operacionais", () => {
    const origens = maquinaBem.estados.filter((e) => podeTransitar(maquinaBem, e, "EXTRAVIADO"));
    expect(origens).not.toContain("AGUARDANDO_RECEBIMENTO");
    expect(origens.every((e) => bemEstaAtivo(e))).toBe(true);
  });

  it("EXTRAVIADO continua contando no saldo; estados finais não", () => {
    expect(bemEstaAtivo("EXTRAVIADO")).toBe(true);
    expect(bemEstaAtivo("DEVOLVIDO")).toBe(false);
    expect(bemEstaAtivo("AGUARDANDO_RECEBIMENTO")).toBe(false);
    expect(STATUS_BEM_ATIVOS).toHaveLength(6);
  });

  it("devolução só é concluída a partir de DEVOLUCAO_SOLICITADA", () => {
    expect(maquinaBem.estados.filter((e) => podeTransitar(maquinaBem, e, "DEVOLVIDO"))).toEqual([
      "DEVOLUCAO_SOLICITADA",
    ]);
  });
});

describe("devolução e movimentação", () => {
  it("retirada exige agendamento antes (etapas independentes)", () => {
    expect(podeTransitar(maquinaDevolucao, "SOLICITADA", "RETIRADA_CONFIRMADA")).toBe(false);
    expect(podeTransitar(maquinaDevolucao, "AGENDADA", "RETIRADA_CONFIRMADA")).toBe(true);
    expect(podeTransitar(maquinaDevolucao, "RETIRADA_CONFIRMADA", "CANCELADA")).toBe(false);
  });

  it("movimentação confirmada é final (histórico imutável)", () => {
    expect(destinosPossiveis(maquinaMovimentacao, "CONFIRMADA")).toEqual([]);
  });
});

describe("utilitários", () => {
  it("exigirTransicao lança erro tipado", () => {
    expect(() => exigirTransicao(maquinaLocacao, "RASCUNHO", "ENCERRADA_OPERACIONALMENTE")).toThrow(
      TransicaoInvalidaError,
    );
    expect(() => exigirTransicao(maquinaLocacao, "RASCUNHO", "ATIVA")).not.toThrow();
  });

  it("definirMaquina rejeita destino desconhecido e auto-transição", () => {
    expect(() =>
      definirMaquina({
        nome: "x",
        estados: ["A", "B"],
        inicial: "A",
        transicoes: { A: ["C" as "B"], B: [] },
      }),
    ).toThrow(/destino desconhecido/);
    expect(() =>
      definirMaquina({ nome: "y", estados: ["A"], inicial: "A", transicoes: { A: ["A"] } }),
    ).toThrow(/auto-transição/);
  });

  it("lista plana sem duplicatas", () => {
    const chaves = todasTransicoes().map((t) => `${t.maquina}:${t.de}>${t.para}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});
