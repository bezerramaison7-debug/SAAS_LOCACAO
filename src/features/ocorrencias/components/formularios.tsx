"use client";

import { useActionState, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Select } from "@/components/ui/input";
import {
  CampoAreaTexto,
  CampoCheckbox,
  CampoSelecao,
  CampoTexto,
} from "@/features/cadastros/components/campos";
import { ESTADO_INICIAL } from "@/lib/actions/estado";

import { registrarOcorrencia, resolverOcorrencia, tratarOcorrencia } from "../actions";
import {
  PRIORIDADES,
  resultadosPara,
  ROTULO_PRIORIDADE,
  ROTULO_RESULTADO,
  ROTULO_TIPO_OCORRENCIA,
  TIPOS_REGISTRAVEIS,
  type TipoOcorrencia,
} from "../rotulos";

type Alvo = { bemId?: string; loteId?: string; locacaoId?: string; unidade?: string | null };

export function FormOcorrencia({
  alvo,
  agoraLocal,
  tiposPermitidos,
}: {
  alvo: Alvo;
  agoraLocal: string;
  tiposPermitidos: readonly TipoOcorrencia[];
}) {
  const [estado, acao] = useActionState(registrarOcorrencia, ESTADO_INICIAL);
  const permitidos = TIPOS_REGISTRAVEIS.filter((t) => tiposPermitidos.includes(t));
  const [tipo, setTipo] = useState<TipoOcorrencia>(
    (estado.valores?.tipo as TipoOcorrencia | undefined) ?? permitidos[0] ?? "OUTRO",
  );
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      {alvo.bemId ? <input type="hidden" name="bemId" value={alvo.bemId} /> : null}
      {alvo.loteId ? <input type="hidden" name="loteId" value={alvo.loteId} /> : null}
      {alvo.locacaoId ? <input type="hidden" name="locacaoId" value={alvo.locacaoId} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField nome="tipo" rotulo="Tipo" erro={estado.errosCampo?.tipo} obrigatorio>
          {(a) => (
            <Select {...a} value={tipo} onChange={(e) => setTipo(e.target.value as TipoOcorrencia)}>
              {permitidos.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_OCORRENCIA[t]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <CampoSelecao
          estado={estado}
          nome="prioridade"
          rotulo="Prioridade"
          inicial="MEDIA"
          opcoes={PRIORIDADES.map((p) => ({ valor: p, rotulo: ROTULO_PRIORIDADE[p] }))}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="dataEvento"
          rotulo="Quando aconteceu"
          tipo="datetime-local"
          inicial={agoraLocal}
          obrigatorio
        />
        <CampoTexto
          estado={estado}
          nome="prazo"
          rotulo="Prazo para tratar"
          tipo="datetime-local"
          descricao="Opcional. Passado o prazo, a ocorrência aparece como vencida."
        />
        {alvo.loteId && tipo === "EXTRAVIO" ? (
          <CampoTexto
            estado={estado}
            nome="quantidade"
            rotulo={`Quantidade extraviada (${alvo.unidade ?? "un"})`}
            inputMode="decimal"
            obrigatorio
          />
        ) : null}
      </div>
      <CampoAreaTexto estado={estado} nome="descricao" rotulo="Descrição" obrigatorio />
      {alvo.bemId && (tipo === "DEFEITO" || tipo === "AVARIA") ? (
        <CampoCheckbox
          estado={estado}
          nome="manutencao"
          rotulo="Enviar para manutenção"
          inicial={false}
          descricao="O bem fica em manutenção (sem movimentações) até a ocorrência ser resolvida."
        />
      ) : null}
      {tipo === "EXTRAVIO" && alvo.bemId ? (
        <p className="text-texto-suave">
          O bem passa a constar como extraviado e continua sob responsabilidade da empresa até a
          resolução.
        </p>
      ) : null}
      <SubmitButton pendente="Registrando…">Registrar ocorrência</SubmitButton>
    </form>
  );
}

export function FormTratar({
  id,
  responsaveis,
  inicial,
}: {
  id: string;
  responsaveis: { id: string; rotulo: string }[];
  inicial: { responsavelId: string | null; prazoLocal: string | null };
}) {
  const [estado, acao] = useActionState(tratarOcorrencia, ESTADO_INICIAL);
  return (
    <form action={acao} className="space-y-3" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 md:grid-cols-2">
        <CampoSelecao
          estado={estado}
          nome="responsavelId"
          rotulo="Responsável pelo tratamento"
          inicial={inicial.responsavelId}
          vazio="Sem responsável"
          opcoes={responsaveis.map((r) => ({ valor: r.id, rotulo: r.rotulo }))}
        />
        <CampoTexto
          estado={estado}
          nome="prazo"
          rotulo="Prazo"
          tipo="datetime-local"
          inicial={inicial.prazoLocal}
        />
      </div>
      <SubmitButton pendente="Salvando…" variante="secundaria">
        Colocar em tratamento
      </SubmitButton>
    </form>
  );
}

export function FormResolver({ id, tipo }: { id: string; tipo: TipoOcorrencia }) {
  const [estado, acao] = useActionState(resolverOcorrencia, ESTADO_INICIAL);
  const opcoes = resultadosPara(tipo).map((r) => ({ valor: r, rotulo: ROTULO_RESULTADO[r] }));
  return (
    <form action={acao} className="space-y-3" noValidate>
      <FormAlert estado={estado} />
      <input type="hidden" name="id" value={id} />
      <CampoSelecao
        estado={estado}
        nome="resultado"
        rotulo="Resultado"
        vazio="Selecione…"
        opcoes={opcoes}
        obrigatorio
      />
      <CampoAreaTexto estado={estado} nome="resolucao" rotulo="Como foi resolvida" obrigatorio />
      {tipo === "EXTRAVIO" ? (
        <p className="text-sm text-texto-suave">
          Encontrado: o bem volta à situação anterior. Indenizado: o bem é baixado (sai do saldo).
        </p>
      ) : null}
      <SubmitButton pendente="Resolvendo…">Resolver ocorrência</SubmitButton>
    </form>
  );
}
