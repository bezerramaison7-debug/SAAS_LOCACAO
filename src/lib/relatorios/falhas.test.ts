import { StorageApiError, StorageUnknownError } from "@supabase/storage-js";
import { describe, expect, it } from "vitest";

import { falhaTransitoria } from "./falhas";

describe("falhas do Storage no worker de relatórios", () => {
  it("rede caída, 5xx e 429 são transitórias (o job é tentado de novo)", () => {
    expect(falhaTransitoria(new StorageUnknownError("fetch failed", new TypeError()))).toBe(true);
    expect(falhaTransitoria(new StorageApiError("bad gateway", 502, "502"))).toBe(true);
    expect(falhaTransitoria(new StorageApiError("slow down", 429, "429"))).toBe(true);
    expect(falhaTransitoria(new TypeError("fetch failed"))).toBe(true);
  });

  it("objeto inexistente ou recusado é definitivo (vira imagem indisponível)", () => {
    expect(falhaTransitoria(new StorageApiError("Object not found", 404, "404"))).toBe(false);
    expect(falhaTransitoria(new StorageApiError("Object not found", 400, "404"))).toBe(false);
  });
});
