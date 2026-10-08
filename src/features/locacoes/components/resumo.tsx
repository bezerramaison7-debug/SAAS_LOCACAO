import { type ReactNode } from "react";

import { formatarDataCivil, formatarDataHora } from "@/lib/format/datas";

import { type Locacao } from "../queries";

function Linha({ termo, children }: { termo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-borda py-2 sm:flex-row sm:gap-4">
      <dt className="text-texto-suave sm:w-48 sm:shrink-0">{termo}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function ResumoLocacao({ locacao, fuso }: { locacao: Locacao; fuso: string }) {
  return (
    <dl className="max-w-3xl">
      <Linha termo="Fornecedor">{locacao.fornecedor ?? "Não informado"}</Linha>
      <Linha termo="Centro de custo">{locacao.centroCusto ?? "Não informado"}</Linha>
      <Linha termo="Início previsto">
        {locacao.inicioPrevisto ? formatarDataCivil(locacao.inicioPrevisto) : "Não informado"}
      </Linha>
      <Linha termo="Término previsto">
        {locacao.terminoPrevisto ? formatarDataCivil(locacao.terminoPrevisto) : "Não informado"}
      </Linha>
      {locacao.ativadaEm ? (
        <Linha termo="Ativada em">{formatarDataHora(locacao.ativadaEm, fuso)}</Linha>
      ) : null}
      {locacao.canceladaEm ? (
        <>
          <Linha termo="Cancelada em">{formatarDataHora(locacao.canceladaEm, fuso)}</Linha>
          <Linha termo="Motivo do cancelamento">{locacao.motivoCancelamento}</Linha>
        </>
      ) : null}
      <Linha termo="Observações">{locacao.observacoes ?? "—"}</Linha>
      <Linha termo="Criada em">{formatarDataHora(locacao.criadaEm, fuso)}</Linha>
    </dl>
  );
}
