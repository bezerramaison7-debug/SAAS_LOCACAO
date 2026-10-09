"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * CA-71: enquanto o relatório está na fila ou sendo gerado, consulta a
 * situação a cada 3 s (até 10 min) e atualiza a página quando mudar.
 */
export function AcompanharRelatorio({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  useEffect(() => {
    if (status !== "PENDENTE" && status !== "PROCESSANDO") return;
    const inicio = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - inicio > 10 * 60_000) return clearInterval(timer);
      try {
        const r = await fetch(`/api/reports/${id}`, { cache: "no-store" });
        const corpo = (await r.json()) as { status?: string };
        if (corpo.status && corpo.status !== status) {
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // Sem conexão: tenta de novo no próximo ciclo.
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [id, status, router]);
  return (
    <p role="status" className="text-sm text-texto-suave">
      {status === "PENDENTE" || status === "PROCESSANDO"
        ? "Acompanhando a geração… esta página atualiza sozinha."
        : null}
    </p>
  );
}
