/**
 * A interface usa cópias TypeScript das regras que o banco impõe. Estes testes
 * garantem que as duas fontes nunca divergem (D-04, docs/permissions.md).
 */
import { afterAll, describe, expect, it } from "vitest";

import { MAQUINAS, todasTransicoes } from "@/lib/domain/maquinas";
import { paresPapelPermissao, PAPEIS } from "@/lib/permissions/matriz";

import { comoAtor, encerrarPool, superusuario } from "../support/db";

afterAll(encerrarPool);

const chave = (t: { maquina: string; de: string; para: string }) =>
  `${t.maquina}:${t.de}>${t.para}`;

/** Enum do Postgres que corresponde a cada máquina de estado. */
const ENUM_DA_MAQUINA: Record<string, string> = {
  locacao: "status_locacao",
  financeiro: "status_financeiro",
  bem: "status_bem",
  lote: "status_lote",
  recebimento: "status_recebimento",
  vistoria: "status_vistoria",
  movimentacao: "status_movimentacao",
  ocorrencia: "status_ocorrencia",
  devolucao: "status_devolucao",
  cobranca: "status_cobranca",
  relatorio: "status_relatorio",
  checklist: "status_checklist",
};

describe("paridade TypeScript × banco", () => {
  it("tabela de transições idêntica", async () => {
    const doBanco = await comoAtor(superusuario, (s) =>
      s.query<{ maquina: string; de: string; para: string }>(
        "select maquina, de, para from privado.transicoes",
      ),
    );
    expect(doBanco.map(chave).sort()).toEqual(todasTransicoes().map(chave).sort());
  });

  it.each(MAQUINAS.map((m) => [m.nome, m] as const))(
    "estados da máquina %s = valores do enum no banco (mesma ordem)",
    async (nome, maquina) => {
      const valores = await comoAtor(superusuario, (s) =>
        s.query<{ v: string }>(
          `select e.enumlabel as v from pg_enum e join pg_type t on t.oid = e.enumtypid
           where t.typname = $1 order by e.enumsortorder`,
          [ENUM_DA_MAQUINA[nome]],
        ),
      );
      expect(valores.map((v) => v.v)).toEqual([...maquina.estados]);
    },
  );

  it("matriz de permissões idêntica", async () => {
    const doBanco = await comoAtor(superusuario, (s) =>
      s.query<{ papel: string; permissao: string }>(
        "select papel::text as papel, permissao from privado.papel_permissoes",
      ),
    );
    const k = (p: { papel: string; permissao: string }) => `${p.papel}:${p.permissao}`;
    expect(doBanco.map(k).sort()).toEqual(paresPapelPermissao().map(k).sort());
  });

  it("papéis idênticos ao enum papel_usuario", async () => {
    const valores = await comoAtor(superusuario, (s) =>
      s.query<{ v: string }>(
        `select e.enumlabel as v from pg_enum e join pg_type t on t.oid = e.enumtypid
         where t.typname = 'papel_usuario' order by e.enumsortorder`,
      ),
    );
    expect(valores.map((v) => v.v)).toEqual([...PAPEIS]);
  });

  it("estados ativos de bem iguais em TS e SQL", async () => {
    const { STATUS_BEM_ATIVOS } = await import("@/features/ativos/rules/maquina-estado");
    const ativos = await comoAtor(superusuario, (s) =>
      s.query<{ v: string }>(
        `select e.enumlabel as v from pg_enum e join pg_type t on t.oid = e.enumtypid
         where t.typname = 'status_bem' and public.status_bem_ativo(e.enumlabel::public.status_bem)
         order by e.enumsortorder`,
      ),
    );
    expect(ativos.map((a) => a.v)).toEqual([...STATUS_BEM_ATIVOS]);
  });
});
