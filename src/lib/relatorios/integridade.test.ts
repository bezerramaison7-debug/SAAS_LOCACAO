import { describe, expect, it } from "vitest";

import { assinarRelatorio, autorizacaoWorkerValida, jsonCanonico, sha256Hex } from "./integridade";

describe("integridade de relatórios", () => {
  it("JSON canônico independe da ordem das chaves e ignora undefined", () => {
    const a = jsonCanonico({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null }, z: undefined });
    const b = jsonCanonico({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":null,"d":[1,{"x":1,"y":2}]},"b":1}');
  });

  it("hash e assinatura são determinísticos e mudam com qualquer parte", () => {
    const h = sha256Hex("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const base = { id: "1", hashDados: h, hashArquivo: h };
    const s = assinarRelatorio("s".repeat(32), base);
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(assinarRelatorio("s".repeat(32), base)).toBe(s);
    expect(assinarRelatorio("s".repeat(32), { ...base, id: "2" })).not.toBe(s);
    expect(assinarRelatorio("t".repeat(32), base)).not.toBe(s);
  });

  it("autoriza o worker só com o segredo exato", () => {
    const segredo = "x".repeat(40);
    expect(autorizacaoWorkerValida(`Bearer ${segredo}`, segredo)).toBe(true);
    expect(autorizacaoWorkerValida(`Bearer ${segredo}a`, segredo)).toBe(false);
    expect(autorizacaoWorkerValida(segredo, segredo)).toBe(false);
    expect(autorizacaoWorkerValida(null, segredo)).toBe(false);
    expect(autorizacaoWorkerValida("Bearer ", segredo)).toBe(false);
  });
});

describe("textoPdf", async () => {
  const { textoPdf } = await import("./snapshot");
  it("mantém acentos do português e troca o que a fonte não desenha", () => {
    expect(textoPdf("Locação — ação · ç ã õ é")).toBe("Locação — ação · ç ã õ é");
    expect(textoPdf("A → B ✓ 🙂")).toBe("A -> B ? ?");
    expect(textoPdf(null)).toBe("");
  });
});
