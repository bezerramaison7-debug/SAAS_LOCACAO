import { FileText } from "lucide-react";

import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { formatarDataHora } from "@/lib/format/datas";

import { removerEvidencia } from "../actions";
import { type Evidencia } from "../queries";
import { EnviarArquivo } from "./enviar-arquivo";

/**
 * Miniaturas servidas por `/api/files/{id}` (URL assinada de 5 min, gerada a
 * cada exibição — nunca persistida).
 */
export function GaleriaEvidencias({
  evidencias,
  fuso,
  podeGerenciar,
  caminho,
  entidadeTipo,
}: {
  evidencias: Evidencia[];
  fuso: string;
  podeGerenciar: boolean;
  /** Página a revalidar após remover. */
  caminho: string;
  entidadeTipo: Parameters<typeof EnviarArquivo>[0]["entidadeTipo"];
}) {
  if (!evidencias.length) return <p className="text-texto-suave">Nenhum arquivo anexado.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {evidencias.map((e) => {
        const imagem = e.mime.startsWith("image/");
        const titulo = e.nome ?? (imagem ? "Foto" : "Documento");
        return (
          <li
            key={e.id}
            className="flex min-w-0 flex-col gap-2 rounded-md border border-borda bg-superficie p-2"
          >
            <a
              href={`/api/files/${e.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {imagem ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL assinada de curta duração (next/image cachearia)
                <img
                  src={`/api/files/${e.id}`}
                  alt={e.legenda ?? `Foto enviada em ${formatarDataHora(e.enviadaEm, fuso)}`}
                  className="aspect-square w-full rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center rounded bg-superficie-2">
                  <FileText aria-hidden className="size-10 text-texto-suave" />
                  <span className="sr-only">Abrir {titulo}</span>
                </span>
              )}
            </a>
            <p className="truncate text-sm" title={titulo}>
              {titulo}
            </p>
            <p className="text-xs text-texto-suave">
              Enviado {formatarDataHora(e.enviadaEm, fuso)}
            </p>
            {e.capturadaEm ? (
              <p className="text-xs text-texto-suave">
                Captura (informada pelo aparelho): {formatarDataHora(e.capturadaEm, fuso)}
              </p>
            ) : null}
            {podeGerenciar ? (
              <div className="flex flex-col gap-2">
                <EnviarArquivo
                  entidadeTipo={entidadeTipo}
                  entidadeId={e.entidadeId}
                  tipo={e.tipo}
                  rotulo="Substituir"
                  substitui={e.id}
                />
                <AcaoConfirmada
                  acao={removerEvidencia}
                  campos={{ id: e.id, caminho }}
                  rotulo="Remover"
                  variante="secundaria"
                  perigoso
                  titulo="Remover este arquivo?"
                  descricao="A remoção é lógica: o arquivo e o registro são preservados para auditoria, mas deixam de valer como evidência."
                  rotuloConfirmar="Remover"
                  motivo={{ rotulo: "Motivo da remoção" }}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
