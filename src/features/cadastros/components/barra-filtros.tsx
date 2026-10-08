import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

import { type FiltrosCadastro } from "../comum";

/** Filtros por GET: tudo fica na URL (compartilhável, funciona sem JS). */
export function BarraFiltros({
  filtros,
  rotuloBusca,
}: {
  filtros: FiltrosCadastro;
  rotuloBusca: string;
}) {
  return (
    <form method="get" role="search" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor="filtro-q">{rotuloBusca}</Label>
        <Input id="filtro-q" name="q" type="search" defaultValue={filtros.q} />
      </div>
      <div className="flex flex-col gap-1.5 sm:w-44">
        <Label htmlFor="filtro-situacao">Situação</Label>
        <Select id="filtro-situacao" name="situacao" defaultValue={filtros.situacao}>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </Select>
      </div>
      <Button type="submit" variante="secundaria">
        <Search aria-hidden /> Filtrar
      </Button>
    </form>
  );
}
