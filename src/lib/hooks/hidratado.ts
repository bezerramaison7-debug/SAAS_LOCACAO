"use client";

import { useSyncExternalStore } from "react";

const semAssinatura = () => () => undefined;

/**
 * `false` no HTML do servidor e até a hidratação; `true` depois (D-70).
 * Campos controlados pelo React ficam desabilitados até lá: um valor escolhido
 * antes da hidratação seria descartado (ou o evento, ignorado) sem aviso.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );
}
