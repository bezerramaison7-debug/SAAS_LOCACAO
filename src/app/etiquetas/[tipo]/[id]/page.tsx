import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { obterBem, obterLote } from "@/features/bens/queries";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarQuantidade } from "@/lib/format/moeda";
import { qrDataUri, urlQr } from "@/lib/qr/qr";
import { uuidSchema } from "@/lib/validation/comum";

import { BotaoImprimir } from "./imprimir";

export const metadata: Metadata = { title: "Etiqueta" };

/**
 * Etiqueta imprimível (fora do layout do app: só a etiqueta vai para o papel).
 * Mostra apenas dados operacionais — sem valores de contrato.
 */
export default async function EtiquetaPage({ params }: PageProps<"/etiquetas/[tipo]/[id]">) {
  const contexto = await exigirContexto();
  const { tipo, id: bruto } = await params;
  const id = uuidSchema.safeParse(bruto);
  if (!id.success || (tipo !== "bem" && tipo !== "lote")) notFound();
  const ativo =
    tipo === "bem" ? await obterBem(contexto, id.data) : await obterLote(contexto, id.data);
  if (!ativo) notFound();
  const linhas: [string, string][] = [
    ["Item", ativo.item || "—"],
    ["Locação", ativo.locacao?.codigo ?? "—"],
  ];
  if ("numeroSerie" in ativo) {
    if (ativo.numeroSerie) linhas.push(["Série", ativo.numeroSerie]);
    if (ativo.placa) linhas.push(["Placa", ativo.placa]);
  } else {
    linhas.push(["Saldo", `${formatarQuantidade(ativo.saldo)} ${ativo.unidade}`.trim()]);
  }
  const qr = await qrDataUri(ativo.id);
  const ficha = tipo === "bem" ? `/bens/${ativo.id}` : `/bens/lotes/${ativo.id}`;
  return (
    <main id="conteudo" className="mx-auto max-w-md space-y-6 p-4 print:p-0">
      <div className="flex flex-wrap gap-3 print:hidden">
        <BotaoImprimir />
        <Link
          href={ficha}
          className="inline-flex min-h-11 items-center text-primaria hover:underline"
        >
          Voltar à ficha
        </Link>
      </div>
      <article
        aria-label={`Etiqueta ${ativo.codigo}`}
        className="flex items-center gap-4 rounded-md border-2 border-black bg-white p-4 text-black print:break-inside-avoid"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI gerada no servidor */}
        <img
          src={qr}
          alt={`QR Code de ${ativo.codigo}`}
          width={128}
          height={128}
          className="size-32 shrink-0"
        />
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase">{contexto.empresa.nome}</p>
          <p className="font-mono text-2xl font-bold break-all">{ativo.codigo}</p>
          <dl className="text-sm">
            {linhas.map(([rotulo, valor]) => (
              <div key={rotulo} className="flex gap-1">
                <dt className="font-semibold">{rotulo}:</dt>
                <dd className="break-words">{valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </article>
      <p className="text-sm break-all text-texto-suave print:hidden">
        O QR Code abre {urlQr(ativo.id)} — exige login na empresa.
      </p>
    </main>
  );
}
