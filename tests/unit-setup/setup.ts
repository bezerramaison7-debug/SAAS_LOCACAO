import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  // Desmonta componentes renderizados em testes com ambiente jsdom.
  if (typeof document !== "undefined") cleanup();
});
