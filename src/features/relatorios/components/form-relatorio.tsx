"use client";

import { useActionState, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { CampoSelecao, CampoTexto } from "@/features/cadastros/components/campos";
import { Select } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/actions/estado";
import { useHidratado } from "@/lib/hooks/hidratado";

import { solicitarRelatorio } from "../actions";
import { ROTULO_TIPO_RELATORIO, TIPOS_RELATORIO, type TipoRelatorio } from "../rotulos";

type Opcao = { id: string; rotulo: string };

export function FormRelatorio({
  locacoes,
  locais,
  hoje,
  inicioMes,
}: {
  locacoes: Opcao[];
  locais: Opcao[];
  hoje: string;
  inicioMes: string;
}) {
  const [estado, acao] = useActionState(solicitarRelatorio, ESTADO_INICIAL);
  const hidratado = useHidratado();
  const [tipo, setTipo] = useState<TipoRelatorio>(
    (estado.valores?.tipo as TipoRelatorio | undefined) ?? "LOCACAO",
  );
  const opcoes = (l: Opcao[]) => l.map((o) => ({ valor: o.id, rotulo: o.rotulo }));
  return (
    <form action={acao} className="max-w-3xl space-y-4" noValidate>
      <FormAlert estado={estado} />
      <FormField nome="tipo" rotulo="Tipo de relatório" obrigatorio>
        {(a) => (
          <Select
            {...a}
            disabled={!hidratado}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoRelatorio)}
          >
            {TIPOS_RELATORIO.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_RELATORIO[t]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {tipo === "LOCACAO" ? (
        <CampoSelecao
          estado={estado}
          nome="alvo"
          rotulo="Locação"
          vazio="Selecione…"
          opcoes={opcoes(locacoes)}
          obrigatorio
        />
      ) : tipo === "LOCAL" ? (
        <CampoSelecao
          estado={estado}
          nome="alvo"
          rotulo="Local"
          vazio="Selecione…"
          opcoes={opcoes(locais)}
          obrigatorio
          descricao="Bens e lotes que estão hoje no local, com o histórico de cada um."
        />
      ) : tipo === "BEM" ? (
        <CampoTexto
          estado={estado}
          nome="codigoBem"
          rotulo="Código do bem"
          obrigatorio
          descricao="Ex.: BEM-000123 (está na etiqueta e na ficha do bem)."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            estado={estado}
            nome="inicio"
            rotulo="De"
            tipo="date"
            inicial={inicioMes}
            obrigatorio
          />
          <CampoTexto
            estado={estado}
            nome="fim"
            rotulo="Até"
            tipo="date"
            inicial={hoje}
            obrigatorio
          />
        </div>
      )}
      <p className="text-sm text-texto-suave">
        O PDF é gerado no servidor com os dados do momento, fotos com legenda e hash de integridade.
        Você pode sair da página: ele fica disponível nesta lista.
      </p>
      <SubmitButton pendente="Pedindo…">Gerar relatório</SubmitButton>
    </form>
  );
}
