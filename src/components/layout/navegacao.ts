import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardCheck,
  FileBarChart,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Package,
  PackageCheck,
  Receipt,
  Settings,
  Undo2,
} from "lucide-react";
import { type Route } from "next";

export type ItemNavegacao = {
  href: Route;
  rotulo: string;
  icone: LucideIcon;
  /** Fase do plano em que o módulo é entregue (docs/backlog.md). */
  fase: number;
  /** Aparece na barra inferior do celular (máx. 4). */
  atalhoMovel?: boolean;
};

/**
 * Itens de navegação. A partir da Fase 3 a lista é filtrada pelas permissões
 * do usuário (o servidor continua sendo a autoridade).
 */
export const NAVEGACAO: readonly ItemNavegacao[] = [
  { href: "/dashboard", rotulo: "Painel", icone: LayoutDashboard, fase: 8, atalhoMovel: true },
  { href: "/locacoes", rotulo: "Locações", icone: FileText, fase: 4, atalhoMovel: true },
  {
    href: "/recebimentos",
    rotulo: "Recebimentos",
    icone: PackageCheck,
    fase: 5,
    atalhoMovel: true,
  },
  { href: "/bens", rotulo: "Bens e lotes", icone: Package, fase: 5 },
  { href: "/movimentacoes", rotulo: "Movimentações", icone: ArrowLeftRight, fase: 6 },
  { href: "/vistorias", rotulo: "Vistorias", icone: ClipboardCheck, fase: 5 },
  { href: "/ocorrencias", rotulo: "Ocorrências", icone: AlertTriangle, fase: 6 },
  { href: "/devolucoes", rotulo: "Devoluções", icone: Undo2, fase: 7 },
  { href: "/cobrancas", rotulo: "Cobranças", icone: Receipt, fase: 7 },
  { href: "/relatorios", rotulo: "Relatórios", icone: FileBarChart, fase: 8 },
  { href: "/configuracoes", rotulo: "Configurações", icone: Settings, fase: 3 },
];

export function itemAtivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
