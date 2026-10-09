import { AcaoConfirmada } from "@/components/forms/acao-confirmada";
import { Alert } from "@/components/ui/alert";
import {
  StatusFinanceiroBadge,
  StatusLocacaoBadge,
} from "@/features/locacoes/components/status-badge";
import { type Locacao } from "@/features/locacoes/queries";
import { pode } from "@/lib/auth/autorizacao";
import { type Contexto } from "@/lib/auth/contexto";
import { formatarDataCivil, formatarDataHora, hojeNoFuso } from "@/lib/format/datas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { encerrarOperacional, iniciarDesmobilizacao } from "./actions";
import { FormEncerramentoFinanceiro } from "./form-encerramento-financeiro";

/**
 * RN-60..62: os dois encerramentos lado a lado, cada um com o seu estado, as
 * suas pendências e a sua ação — nenhum dispara o outro.
 */
export async function PainelEncerramentos({
  contexto,
  locacao,
}: {
  contexto: Contexto;
  locacao: Locacao;
}) {
  const supabase = await createSupabaseServerClient();
  const fuso = contexto.empresa.timezone;
  const [{ data: pendencias }, { data: cobrancasAbertas }] = await Promise.all([
    locacao.status === "EM_DEVOLUCAO"
      ? supabase.rpc("pendencias_encerramento_operacional", { p_locacao: locacao.id })
      : Promise.resolve({ data: null }),
    locacao.statusFinanceiro === "ENCERRAMENTO_PENDENTE" && pode(contexto, "valores.ver")
      ? supabase
          .from("cobrancas")
          .select("id, codigo")
          .eq("empresa_id", contexto.empresa.id)
          .eq("locacao_id", locacao.id)
          .in("status", ["PENDENTE", "DIVERGENTE"])
      : Promise.resolve({ data: null }),
  ]);
  const listaPendencias = pendencias ?? [];

  return (
    <section aria-labelledby="encerramentos" className="mb-6 grid gap-4 lg:grid-cols-2">
      <h2 id="encerramentos" className="sr-only">
        Encerramentos
      </h2>
      <div
        role="group"
        aria-labelledby="enc-operacional"
        className="space-y-3 rounded-md border border-borda bg-superficie p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="enc-operacional" className="font-semibold">
            Encerramento operacional
          </h3>
          <StatusLocacaoBadge status={locacao.status} />
        </div>
        {locacao.status === "ATIVA" ? (
          <>
            <p className="text-sm text-texto-suave">
              Itens ainda em uso. Ao solicitar a devolução de todo o saldo, a desmobilização começa
              automaticamente.
            </p>
            {pode(contexto, "locacao.iniciar_desmobilizacao") ? (
              <AcaoConfirmada
                acao={iniciarDesmobilizacao}
                campos={{ id: locacao.id }}
                rotulo="Iniciar desmobilização"
                variante="secundaria"
                titulo={`Iniciar a desmobilização de ${locacao.codigo}?`}
                descricao="A locação passa a 'Em devolução'. Os itens continuam no saldo até a retirada."
                rotuloConfirmar="Iniciar desmobilização"
              />
            ) : null}
          </>
        ) : locacao.status === "EM_DEVOLUCAO" ? (
          listaPendencias.length ? (
            <Alert tom="alerta" titulo="Pendências para encerrar a operação">
              <ul className="list-disc pl-5">
                {listaPendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Alert>
          ) : pode(contexto, "locacao.encerrar_operacional") ? (
            <AcaoConfirmada
              acao={encerrarOperacional}
              campos={{ id: locacao.id }}
              rotulo="Encerrar operação"
              titulo={`Encerrar a operação de ${locacao.codigo}?`}
              descricao="Confirma que nenhum item da locação continua com a empresa. Não altera o status financeiro."
              rotuloConfirmar="Encerrar operação"
            />
          ) : (
            <p className="text-sm text-texto-suave">Pronta para o encerramento operacional.</p>
          )
        ) : locacao.status === "ENCERRADA_OPERACIONALMENTE" && locacao.encerradaOperacionalEm ? (
          <p className="text-sm">
            Encerrada em {formatarDataHora(locacao.encerradaOperacionalEm, fuso)}.
          </p>
        ) : null}
      </div>
      <div
        role="group"
        aria-labelledby="enc-financeiro"
        className="space-y-3 rounded-md border border-borda bg-superficie p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="enc-financeiro" className="font-semibold">
            Encerramento financeiro
          </h3>
          <StatusFinanceiroBadge status={locacao.statusFinanceiro} />
        </div>
        {locacao.statusFinanceiro === "ENCERRADO" && locacao.dataEncerramentoFinanceiro ? (
          <p className="text-sm">
            Cobrança encerrada em {formatarDataCivil(locacao.dataEncerramentoFinanceiro)}.
          </p>
        ) : locacao.statusFinanceiro === "ENCERRAMENTO_PENDENTE" ? (
          cobrancasAbertas?.length ? (
            <Alert
              tom="alerta"
              titulo="Cobranças pendentes ou divergentes bloqueiam o encerramento"
            >
              {cobrancasAbertas.map((c) => c.codigo).join(", ")}
            </Alert>
          ) : pode(contexto, "locacao.encerrar_financeiro") ? (
            <FormEncerramentoFinanceiro id={locacao.id} hoje={hojeNoFuso(fuso)} />
          ) : (
            <p className="text-sm text-texto-suave">Saldo zerado: aguardando o financeiro.</p>
          )
        ) : (
          <p className="text-sm text-texto-suave">
            A retirada nunca encerra a cobrança. Quando o saldo zerar, o financeiro confirma o
            encerramento com a data.
          </p>
        )}
      </div>
    </section>
  );
}
