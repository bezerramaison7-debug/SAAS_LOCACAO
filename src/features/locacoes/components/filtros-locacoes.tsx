import { Search, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

import { PRAZOS_TERMINO, temFiltroAtivo, type FiltrosLocacao } from "../filtros";
import { ROTULO_STATUS_LOCACAO } from "../rotulos";
import { maquinaLocacao } from "../rules/maquina-estado";

type Opcao = { id: string; rotulo: string };

/** Filtros por GET: tudo fica na URL (link compartilhável, funciona sem JS). */
export function FiltrosLocacoes({
  filtros,
  fornecedores,
  centros,
  locais,
}: {
  filtros: FiltrosLocacao;
  fornecedores: Opcao[];
  centros: Opcao[];
  locais: Opcao[];
}) {
  const avancados = Boolean(
    filtros.status.length ||
    filtros.fornecedor ||
    filtros.centro ||
    filtros.local ||
    filtros.de ||
    filtros.ate ||
    filtros.termino,
  );
  return (
    <form method="get" role="search" aria-label="Filtrar locações" className="mb-4 space-y-3">
      <input type="hidden" name="tamanho" value={filtros.paginacao.tamanho} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="filtro-q">
            Buscar por código, pedido Sectra, fornecedor, bem ou lote
          </Label>
          <Input id="filtro-q" name="q" type="search" defaultValue={filtros.q} />
        </div>
        <Button type="submit" variante="secundaria">
          <Search aria-hidden /> Filtrar
        </Button>
        {temFiltroAtivo(filtros) ? (
          <Button asChild variante="fantasma">
            <Link href="/locacoes">
              <X aria-hidden /> Limpar
            </Link>
          </Button>
        ) : null}
      </div>
      <details open={avancados} className="rounded-md border border-borda bg-superficie p-3">
        <summary className="min-h-11 cursor-pointer content-center font-medium">
          Mais filtros
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <fieldset className="sm:col-span-2 lg:col-span-3">
            <legend className="mb-1 font-medium">Situação</legend>
            <div className="flex flex-wrap gap-x-4">
              {maquinaLocacao.estados.map((s) => (
                <label key={s} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    name="status"
                    value={s}
                    defaultChecked={filtros.status.includes(s)}
                    className="size-5 accent-[var(--primaria)]"
                  />
                  {ROTULO_STATUS_LOCACAO[s]}
                </label>
              ))}
            </div>
          </fieldset>
          <Seletor
            id="filtro-fornecedor"
            nome="fornecedor"
            rotulo="Fornecedor"
            valor={filtros.fornecedor}
            opcoes={fornecedores}
          />
          <Seletor
            id="filtro-centro"
            nome="centro"
            rotulo="Centro de custo"
            valor={filtros.centro}
            opcoes={centros}
          />
          <Seletor
            id="filtro-local"
            nome="local"
            rotulo="Local atual dos bens"
            valor={filtros.local}
            opcoes={locais}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-de">Vigência a partir de</Label>
            <Input id="filtro-de" name="de" type="date" defaultValue={filtros.de ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-ate">Vigência até</Label>
            <Input id="filtro-ate" name="ate" type="date" defaultValue={filtros.ate ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-termino">Término previsto</Label>
            <Select id="filtro-termino" name="termino" defaultValue={filtros.termino ?? ""}>
              <option value="">Qualquer data</option>
              {PRAZOS_TERMINO.map((d) => (
                <option key={d} value={d}>
                  Vence em até {d} dias (inclui vencidas)
                </option>
              ))}
            </Select>
          </div>
        </div>
      </details>
    </form>
  );
}

function Seletor({
  id,
  nome,
  rotulo,
  valor,
  opcoes,
}: {
  id: string;
  nome: string;
  rotulo: string;
  valor: string | null;
  opcoes: Opcao[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Select id={id} name={nome} defaultValue={valor ?? ""}>
        <option value="">Todos</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </Select>
    </div>
  );
}
