import { Building, ChevronRight, ClipboardList, Landmark, MapPin, Shapes } from "lucide-react";
import type { Metadata } from "next";
import { type Route } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Cadastros" };

const ITENS: { href: Route; titulo: string; descricao: string; icone: typeof Building }[] = [
  {
    href: "/cadastros/fornecedores",
    titulo: "Fornecedores",
    descricao: "Locadoras e prestadores",
    icone: Building,
  },
  {
    href: "/cadastros/locais",
    titulo: "Locais",
    descricao: "Obras, almoxarifados e escritórios",
    icone: MapPin,
  },
  {
    href: "/cadastros/centros-custo",
    titulo: "Centros de custo",
    descricao: "Apropriação das locações",
    icone: Landmark,
  },
  {
    href: "/cadastros/categorias",
    titulo: "Categorias de bem",
    descricao: "Controle individual ou por lote",
    icone: Shapes,
  },
  {
    href: "/cadastros/checklists",
    titulo: "Checklists",
    descricao: "Modelos versionados de vistoria",
    icone: ClipboardList,
  },
];

export default async function CadastrosPage() {
  exigirPermissaoPagina(await exigirContexto(), "dados.ler_geral");
  return (
    <>
      <PageHeader
        titulo="Cadastros"
        descricao="Dados de apoio usados nas locações, recebimentos e vistorias."
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITENS.map(({ href, titulo, descricao, icone: Icone }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-16 items-center justify-between gap-3 rounded-md border border-borda bg-superficie p-4 hover:bg-superficie-2"
            >
              <span className="flex items-center gap-3">
                <Icone aria-hidden className="size-6 text-primaria" />
                <span>
                  <span className="block font-semibold">{titulo}</span>
                  <span className="block text-texto-suave">{descricao}</span>
                </span>
              </span>
              <ChevronRight aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
