import { describe, expect, it } from "vitest";

import { caminhoEvidencia, detectarMime, nomeSeguro, validarArquivo } from "./arquivo";

const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const PDF = new TextEncoder().encode("%PDF-1.7\n");
const LIMITES = { imagemBytes: 15 * 1048576, pdfBytes: 20 * 1048576 };

describe("detectarMime", () => {
  it.each([
    [JPG, "image/jpeg"],
    [PNG, "image/png"],
    [WEBP, "image/webp"],
    [PDF, "application/pdf"],
  ])("reconhece pelos primeiros bytes (%#)", (bytes, mime) =>
    expect(detectarMime(bytes)).toBe(mime),
  );

  it("ignora extensão/Content-Type: HTML disfarçado não passa", () => {
    expect(detectarMime(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(detectarMime(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});

describe("validarArquivo", () => {
  it("foto aceita só imagem; documento aceita PDF", () => {
    expect(validarArquivo(PDF, "FOTO", LIMITES)).toMatchObject({ ok: false });
    expect(validarArquivo(PDF, "CONTRATO", LIMITES)).toEqual({
      ok: true,
      mime: "application/pdf",
      extensao: "pdf",
    });
    expect(validarArquivo(WEBP, "FOTO", LIMITES)).toEqual({
      ok: true,
      mime: "image/webp",
      extensao: "webp",
    });
  });

  it("respeita o limite da empresa e o teto do bucket", () => {
    const grande = new Uint8Array(2 * 1048576 + 1);
    grande.set(JPG);
    expect(
      validarArquivo(grande, "FOTO", { imagemBytes: 2 * 1048576, pdfBytes: LIMITES.pdfBytes }),
    ).toEqual({
      ok: false,
      erro: "Arquivo acima do limite de 2 MB.",
    });
    const enorme = new Uint8Array(21 * 1048576);
    enorme.set(PDF);
    expect(
      validarArquivo(enorme, "DOCUMENTO", { imagemBytes: 50 * 1048576, pdfBytes: 50 * 1048576 }).ok,
    ).toBe(false);
  });

  it("rejeita PDF com JavaScript ou ação de execução", () => {
    for (const ativo of [
      "/JavaScript (app.alert(1))",
      "/JS (x)",
      "/Launch <<>>",
      "/EmbeddedFile 3 0 R",
    ]) {
      const pdf = new TextEncoder().encode(
        `%PDF-1.7\n1 0 obj<< /OpenAction << ${ativo} >> >>endobj`,
      );
      expect(validarArquivo(pdf, "DOCUMENTO", LIMITES), ativo).toMatchObject({ ok: false });
    }
    const comum = new TextEncoder().encode("%PDF-1.7\n1 0 obj<< /Type /Catalog /JSON 1 >>endobj");
    expect(validarArquivo(comum, "DOCUMENTO", LIMITES).ok).toBe(true);
  });

  it("rejeita arquivo vazio", () => {
    expect(validarArquivo(new Uint8Array(), "FOTO", LIMITES)).toEqual({
      ok: false,
      erro: "Arquivo vazio.",
    });
  });
});

describe("caminho e nome", () => {
  it("monta o caminho RN-91 sem usar o nome original", () => {
    expect(caminhoEvidencia("e", "ITEM_RECEBIMENTO", "x", "u", "jpg")).toBe(
      "e/item_recebimento/x/u.jpg",
    );
  });
  it("nomeSeguro remove diretórios e caracteres de controle", () => {
    expect(nomeSeguro("../../etc/passwd")).toBe("passwd");
    expect(nomeSeguro('C:\\fotos\\a"b<c>.jpg')).toBe("abc.jpg");
    expect(nomeSeguro("   ")).toBeNull();
  });
});
