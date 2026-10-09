import {
  AlertTriangle,
  ArrowLeftRight,
  CircleCheck,
  ClipboardCheck,
  PackageCheck,
  Split,
  Truck,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { type Route } from "next";

import { type Contexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ICONE = {
  RECEBIMENTO: PackageCheck,
  DIVISAO: Split,
  MOVIMENTACAO: ArrowLeftRight,
  VISTORIA: ClipboardCheck,
  OCORRENCIA: AlertTriangle,
  OCORRENCIA_FIM: CircleCheck,
  DEVOLUCAO: Undo2,
  DEVOLUCAO_FIM: Truck,
} as const;

const ROTA: Record<string, (id: string) => string> = {
  recebimento: (id) => `/recebimentos/${id}`,
  lote: (id) => `/bens/lotes/${id}`,
  movimentacao: (id) => `/movimentacoes/${id}`,
  vistoria: (id) => `/vistorias/${id}`,
  ocorrencia: (id) => `/ocorrencias/${id}`,
  devolucao: (id) => `/devolucoes/${id}`,
};

/** F6.3: linha do tempo imutável (eventos registrados; nada é editado). */
export async function LinhaDoTempo({
  contexto,
  alvo,
}: {
  contexto: Contexto;
  alvo: { bem?: string; lote?: string };
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("linha_do_tempo", {
    ...(alvo.bem ? { p_bem: alvo.bem } : {}),
    ...(alvo.lote ? { p_lote: alvo.lote } : {}),
  });
  if (error) throw new Error("Falha ao carregar a linha do tempo");
  const eventos = data ?? [];
  if (!eventos.length) return <p className="text-texto-suave">Nenhum evento visível.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-borda pl-6">
      {eventos.map((e, i) => {
        const Icone = ICONE[e.tipo as keyof typeof ICONE] ?? CircleCheck;
        const href = ROTA[e.ref_tipo]?.(e.ref_id);
        return (
          <li key={`${e.ref_id}-${e.tipo}-${i}`} className="relative">
            <span className="absolute top-1 -left-[2.1rem] flex size-7 items-center justify-center rounded-full border border-borda bg-superficie">
              <Icone aria-hidden className="size-4 text-primaria" />
            </span>
            <p className="text-sm text-texto-suave">
              <time dateTime={e.em}>{formatarDataHora(e.em, contexto.empresa.timezone)}</time>
            </p>
            <p className="font-medium">
              {href ? (
                <Link href={href as Route} className="text-primaria hover:underline">
                  {e.titulo}
                </Link>
              ) : (
                e.titulo
              )}
            </p>
            {e.detalhe ? <p className="text-sm break-words text-texto-suave">{e.detalhe}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
