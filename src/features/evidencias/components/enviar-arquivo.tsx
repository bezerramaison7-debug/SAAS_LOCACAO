"use client";

import { Camera, FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/alert";
import { cn } from "@/components/ui/cn";
import { buttonVariants } from "@/components/ui/button";
import { type EntidadeEvidencia, type TipoEvidencia } from "@/lib/evidencias/arquivo";

type Props = {
  entidadeTipo: EntidadeEvidencia;
  entidadeId: string;
  tipo: TipoEvidencia;
  rotulo: string;
  perguntaId?: string;
  /** Substitui esta evidência (RN-95) em vez de criar uma nova. */
  substitui?: string;
  variante?: "primaria" | "secundaria";
};

/**
 * Envio de arquivo ao `/api/files`. Em fotos, `capture` abre a câmera traseira
 * no celular (CA-25). A data informada pelo dispositivo segue como
 * `capturadaEm` (rotulada como não confiável — RN-93).
 */
export function EnviarArquivo({
  entidadeTipo,
  entidadeId,
  tipo,
  rotulo,
  perguntaId,
  substitui,
  variante = "secundaria",
}: Props) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const foto = tipo === "FOTO";
  // Só habilita depois da hidratação: um arquivo escolhido antes disso seria
  // ignorado em silêncio (o onChange do React ainda não existe).
  const hidratado = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  async function enviar(arquivo: File) {
    setEnviando(true);
    setErro(null);
    setSucesso(false);
    const dados = new FormData();
    dados.set("arquivo", arquivo);
    dados.set("entidadeTipo", entidadeTipo);
    dados.set("entidadeId", entidadeId);
    dados.set("tipo", tipo);
    if (perguntaId) dados.set("perguntaId", perguntaId);
    if (substitui) dados.set("substitui", substitui);
    if (arquivo.lastModified)
      dados.set("capturadaEm", new Date(arquivo.lastModified).toISOString());
    try {
      const resposta = await fetch("/api/files", { method: "POST", body: dados });
      const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string };
      if (!resposta.ok) {
        setErro(corpo.erro ?? "Não foi possível enviar o arquivo.");
        return;
      }
      setSucesso(true);
      router.refresh();
    } catch {
      setErro("Sem conexão. Verifique a internet e tente novamente.");
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  const Icone = enviando ? LoaderCircle : foto ? Camera : FileUp;
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          buttonVariants({ variante }),
          "cursor-pointer has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--foco)] has-[:focus-visible]:outline-solid",
          enviando && "pointer-events-none opacity-60",
        )}
      >
        <Icone aria-hidden className={cn(enviando && "animate-spin")} />
        {enviando ? "Enviando…" : rotulo}
        <input
          ref={input}
          id={id}
          type="file"
          className="sr-only"
          accept={
            foto
              ? "image/jpeg,image/png,image/webp"
              : "image/jpeg,image/png,image/webp,application/pdf"
          }
          {...(foto ? { capture: "environment" as const } : {})}
          disabled={enviando || !hidratado}
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void enviar(arquivo);
          }}
        />
      </label>
      <div aria-live="polite">
        {erro ? <Alert tom="perigo" titulo={erro} /> : null}
        {sucesso ? <p className="text-sm text-sucesso">Arquivo enviado.</p> : null}
      </div>
    </div>
  );
}
