import { describe, expect, it } from "vitest";

import { agendamentoSchema, lerRetirada, lerSolicitacao } from "./schemas";

const BEM = "11111111-1111-4111-8111-111111111111";
const LOTE = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const FUSO = "America/Sao_Paulo";
const AGORA = () => Date.parse("2026-10-09T15:00:00Z");

describe("lerSolicitacao", () => {
  it("lê bens marcados e quantidades de lote em pt-BR", () => {
    const r = lerSolicitacao(
      { [`bem_${BEM}`]: "on", [`lote_${LOTE}`]: "12,5" },
      new Map([[LOTE, "20"]]),
    );
    expect(r.erros).toEqual({});
    expect(r.itens).toEqual([{ bem: BEM }, { lote: LOTE, quantidade: "12.5" }]);
  });

  it("recusa quantidade acima do disponível e seleção vazia", () => {
    expect(lerSolicitacao({ [`lote_${LOTE}`]: "21" }, new Map([[LOTE, "20"]])).erros).toEqual({
      [`lote_${LOTE}`]: "Acima do disponível para devolução",
    });
    expect(lerSolicitacao({ [`lote_${LOTE}`]: "" }, new Map()).erros._).toContain("Selecione");
  });
});

describe("agendamentoSchema", () => {
  it("converte o horário local da empresa para UTC (pode ser futuro)", () => {
    const r = agendamentoSchema(FUSO).safeParse({ agendadaPara: "2026-12-01T09:00" });
    expect(r.success && r.data.agendadaPara).toBe("2026-12-01T12:00:00.000Z");
  });
});

describe("lerRetirada", () => {
  const solicitadas = new Map([[ITEM, "30"]]);
  it("exige recebedor, data não futura, quantidade ≤ solicitada e condição quando retirado", () => {
    const r = lerRetirada(
      { retiradaEm: "2026-10-10T09:00", recebedor: "", [`qtd_${ITEM}`]: "31" },
      FUSO,
      solicitadas,
      AGORA,
    );
    expect(r.dados).toBeNull();
    expect(r.erros).toMatchObject({
      retiradaEm: "A data não pode estar no futuro",
      recebedor: "Informe quem recebeu pelo fornecedor",
      [`qtd_${ITEM}`]: "Maior que a quantidade solicitada",
    });
    expect(
      lerRetirada(
        { retiradaEm: "2026-10-09T10:00", recebedor: "João", [`qtd_${ITEM}`]: "5" },
        FUSO,
        solicitadas,
        AGORA,
      ).erros,
    ).toEqual({ [`cond_${ITEM}`]: "Informe a condição de saída" });
  });

  it("aceita retirada parcial e recusa tudo zero", () => {
    const ok = lerRetirada(
      {
        retiradaEm: "2026-10-09T10:00",
        recebedor: "João",
        [`qtd_${ITEM}`]: "20",
        [`cond_${ITEM}`]: "BOM",
      },
      FUSO,
      solicitadas,
      AGORA,
    );
    expect(ok.dados).toEqual({
      retiradaEm: "2026-10-09T13:00:00.000Z",
      recebedor: "João",
      itens: [{ id: ITEM, quantidade: "20", condicao: "BOM" }],
    });
    const zero = lerRetirada(
      { retiradaEm: "2026-10-09T10:00", recebedor: "João", [`qtd_${ITEM}`]: "0" },
      FUSO,
      solicitadas,
      AGORA,
    );
    expect(zero.erros._).toContain("Nenhum item retirado");
  });
});
