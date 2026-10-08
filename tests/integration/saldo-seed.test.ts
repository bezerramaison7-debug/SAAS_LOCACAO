import { readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { comoAtor, encerrarPool, superusuario, usuario } from "../support/db";
import { A, B, EMPRESA_A, USUARIOS } from "../support/fixtures";

afterAll(encerrarPool);

const SEED = readFileSync(path.join(import.meta.dirname, "../../supabase/seed.sql"), "utf8");

type SaldoItem = {
  item_locacao_id: string;
  quantidade_recebida: string;
  quantidade_devolvida: string;
  saldo: string;
};

describe("saldo (visões)", () => {
  it("recebimento parcial: 2 de 3 estações e 60 de 100 andaimes", async () => {
    const itens = await comoAtor(usuario(USUARIOS.gestorA), (s) =>
      s.query<SaldoItem>("select * from public.v_saldo_item_locacao where locacao_id = $1", [
        A.locacaoAtiva,
      ]),
    );
    const estacao = itens.find((i) => i.item_locacao_id === A.itemEstacao);
    const andaime = itens.find((i) => i.item_locacao_id === A.itemAndaime);
    expect(estacao).toMatchObject({ quantidade_recebida: "2.000", saldo: "2.000" });
    expect(andaime).toMatchObject({ quantidade_recebida: "60.000", saldo: "60.000" });
    const [loc] = await comoAtor(usuario(USUARIOS.gestorA), (s) =>
      s.query<{ saldo_total: string; a_receber: string; bens_ativos: string; saldo_lotes: string }>(
        "select * from public.v_saldo_locacao where locacao_id = $1",
        [A.locacaoAtiva],
      ),
    );
    expect(loc).toMatchObject({
      bens_ativos: "2.000",
      saldo_lotes: "60.000",
      saldo_total: "62.000",
      a_receber: "41.000",
    });
  });

  it("devolução parcial de lote reduz o saldo; extraviado continua no saldo", async () => {
    await comoAtor(superusuario, async (s) => {
      await s.query("update public.lotes set quantidade_devolvida = 25 where id = $1", [
        A.loteAndaime,
      ]);
      await s.query("update public.bens set status = 'EXTRAVIADO' where id = $1", [A.bemEstacao2]);
      const [loc] = await s.query<{ saldo_lotes: string; bens_ativos: string }>(
        "select * from public.v_saldo_locacao where locacao_id = $1",
        [A.locacaoAtiva],
      );
      expect(loc).toMatchObject({ saldo_lotes: "35.000", bens_ativos: "2.000" });
      const [item] = await s.query<SaldoItem>(
        "select * from public.v_saldo_item_locacao where item_locacao_id = $1",
        [A.itemAndaime],
      );
      expect(item).toMatchObject({ quantidade_devolvida: "25.000", saldo: "35.000" });
    });
  });

  it("visões respeitam a RLS de quem consulta", async () => {
    const daB = await comoAtor(usuario(USUARIOS.adminB), (s) =>
      s.query<{ locacao_id: string }>("select locacao_id from public.v_saldo_locacao"),
    );
    expect(daB.map((l) => l.locacao_id)).toEqual([B.locacaoAtiva]);
  });
});

describe("seed de demonstração", () => {
  it("é idempotente: reaplicar não altera contagens", async () => {
    await comoAtor(superusuario, async (s) => {
      const contar = async () => {
        const [r] = await s.query<{ e: string; l: string; b: string }>(
          `select (select count(*) from public.empresas) e, (select count(*) from public.locacoes) l,
                  (select count(*) from public.bens) b`,
        );
        return r;
      };
      const antes = await contar();
      await s.query(SEED);
      expect(await contar()).toEqual(antes);
    });
  });

  it("é bloqueado quando o banco está marcado como produção", async () => {
    await comoAtor(superusuario, async (s) => {
      await s.query("select set_config('app.ambiente', 'producao', true)");
      const r = await s.tentar(SEED);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.mensagem).toMatch(/bloqueado/);
    });
  });

  it("dados claramente marcados como demonstração", async () => {
    await comoAtor(superusuario, async (s) => {
      const empresas = await s.query<{ nome: string; demonstracao: boolean }>(
        "select nome, demonstracao from public.empresas",
      );
      for (const e of empresas) {
        expect(e.demonstracao).toBe(true);
        expect(e.nome).toContain("[DEMONSTRAÇÃO]");
      }
    });
  });

  it("cobre os cenários exigidos (rascunho, ativa com recebimento parcial, em devolução…)", async () => {
    await comoAtor(superusuario, async (s) => {
      const [r] = await s.query<Record<string, string>>(
        `select
           (select count(distinct papel) from public.usuarios_empresa where empresa_id = $1) papeis,
           (select count(*) from public.fornecedores where empresa_id = $1) fornecedores,
           (select count(*) from public.locais where empresa_id = $1) locais,
           (select count(*) from public.centros_custo where empresa_id = $1) centros,
           (select string_agg(distinct status::text, ',' order by status::text) from public.locacoes where empresa_id = $1) status,
           (select count(*) from public.lotes where empresa_id = $1) lotes,
           (select count(*) from public.vistorias where empresa_id = $1) vistorias,
           (select count(*) from public.movimentacoes where empresa_id = $1) movimentacoes,
           (select count(*) from public.ocorrencias where empresa_id = $1) ocorrencias`,
        [EMPRESA_A],
      );
      // Cadastros e locações crescem com os E2E (dados reais): mínimos do seed.
      expect(r).toMatchObject({
        papeis: "7",
        lotes: "1",
        vistorias: "2",
        movimentacoes: "1",
        ocorrencias: "1",
      });
      expect(Number(r?.fornecedores)).toBeGreaterThanOrEqual(2);
      expect(Number(r?.locais)).toBeGreaterThanOrEqual(3);
      expect(Number(r?.centros)).toBeGreaterThanOrEqual(2);
      expect(r?.status?.split(",")).toEqual(
        expect.arrayContaining(["ATIVA", "EM_DEVOLUCAO", "RASCUNHO"]),
      );
    });
  });
});
