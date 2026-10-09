import Decimal from "decimal.js";
import { Calculator } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ROTULO_PERIODICIDADE } from "@/features/locacoes/rotulos";
import { type Contexto } from "@/lib/auth/contexto";
import { formatarDataCivil, hojeNoFuso } from "@/lib/format/datas";
import { formatarMoeda, formatarQuantidade } from "@/lib/format/moeda";

import { estimativa } from "../queries";
import { AVISO_ESTIMATIVA } from "../schemas";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * RN-72/73: estimativa do período (calculada no banco, em numeric). Sempre
 * rotulada como estimativa — não é valor a pagar.
 */
export async function EstimativaLocacao({
  contexto,
  locacaoId,
  inicioPadrao,
  de,
  ate,
}: {
  contexto: Contexto;
  locacaoId: string;
  inicioPadrao: string | null;
  de: string | undefined;
  ate: string | undefined;
}) {
  const hoje = hojeNoFuso(contexto.empresa.timezone);
  const fim = ate && DATA.test(ate) ? ate : hoje;
  const inicio = de && DATA.test(de) ? de : (inicioPadrao ?? hoje);
  const { erro, linhas } = await estimativa(locacaoId, inicio, fim);
  const total = linhas.reduce((t, l) => t.plus(l.valor), new Decimal(0));
  return (
    <section aria-labelledby="estimativa" className="mt-6 space-y-3">
      <h2 id="estimativa" className="flex items-center gap-2 text-xl font-semibold">
        <Calculator aria-hidden className="size-5" /> Estimativa do período
      </h2>
      <p className="rounded-md border border-alerta bg-superficie p-3 font-medium">
        {AVISO_ESTIMATIVA}
      </p>
      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="aba" value="cobrancas" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="est-de">De</Label>
          <Input id="est-de" name="est_de" type="date" defaultValue={inicio} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="est-ate">Até</Label>
          <Input id="est-ate" name="est_ate" type="date" defaultValue={fim} />
        </div>
        <Button type="submit" variante="secundaria">
          Calcular
        </Button>
      </form>
      {erro ? (
        <Alert tom="perigo" titulo="Não foi possível calcular a estimativa para este período." />
      ) : (
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Tabela da estimativa (role para os lados no celular)"
          tabIndex={0}
        >
          <table className="w-full min-w-[32rem] text-left">
            <caption className="sr-only">
              Estimativa de {formatarDataCivil(inicio)} a {formatarDataCivil(fim)}
            </caption>
            <thead className="text-sm text-texto-suave">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Item
                </th>
                <th scope="col" className="py-2 pr-3">
                  Valor contratado
                </th>
                <th scope="col" className="py-2 pr-3">
                  Unidades × dias
                </th>
                <th scope="col" className="py-2 text-right">
                  Estimativa
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.itemId} className="border-t border-borda">
                  <td className="py-2 pr-3">{l.descricao}</td>
                  <td className="py-2 pr-3">
                    {formatarMoeda(l.valorUnitario)} (
                    {ROTULO_PERIODICIDADE[l.periodicidade].toLowerCase()})
                  </td>
                  <td className="py-2 pr-3">{formatarQuantidade(l.unidadesDia)}</td>
                  <td className="py-2 text-right">{formatarMoeda(l.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-borda font-semibold">
                <td className="py-2 pr-3" colSpan={3}>
                  Total estimado ({formatarDataCivil(inicio)} a {formatarDataCivil(fim)})
                </td>
                <td className="py-2 text-right">{formatarMoeda(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-sm text-texto-suave">
        Regra: dias de posse no período (conta o dia de chegada, não o dia da retirada) × valor ÷ 1
        (diária), 7 (semanal), 15 (quinzenal) ou 30 (mensal).
      </p>
    </section>
  );
}
