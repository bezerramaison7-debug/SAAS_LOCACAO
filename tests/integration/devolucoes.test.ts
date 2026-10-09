/** Fase 7: devolução em etapas, cobranças, estimativa e encerramentos independentes. */
import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import {
  comoAtor,
  encerrarPool,
  SQLSTATE,
  superusuario,
  usuario,
  type Sessao,
} from "../support/db";
import { A, EMPRESA_A, USUARIOS } from "../support/fixtures";

afterAll(encerrarPool);

const operacao = usuario(USUARIOS.operacaoA);
const financeiro = usuario(USUARIOS.financeiroA);
const compras = usuario(USUARIOS.comprasA);
const responsavel = usuario(USUARIOS.responsavelA);

type ItemSolicitado = { bem: string } | { lote: string; quantidade?: number };

async function solicitar(s: Sessao, itens: ItemSolicitado[], locacao: string = A.locacaoAtiva) {
  const [r] = await s.query<{ id: string }>(
    "select public.rpc_solicitar_devolucao($1, $2::jsonb, 'Fim do serviço') id",
    [locacao, JSON.stringify(itens)],
  );
  return r?.id as string;
}

async function itens(s: Sessao, devolucao: string) {
  return s.query<{ id: string; bem_id: string | null; lote_id: string | null }>(
    "select id, bem_id, lote_id from public.itens_devolucao where devolucao_id = $1 order by created_at, id",
    [devolucao],
  );
}

/** Vistoria de saída respondida, com a foto exigida, e concluída. */
async function vistoriaSaida(s: Sessao, item: string) {
  const [v] = await s.query<{ id: string }>("select public.rpc_iniciar_vistoria_saida($1) id", [
    item,
  ]);
  const perguntas = await s.query<{ id: string }>(
    "select p.id from public.perguntas_checklist p join public.vistorias v on v.modelo_id = p.modelo_id where v.id = $1 order by p.ordem",
    [v?.id],
  );
  await s.query("select public.rpc_salvar_respostas_vistoria($1, $2::jsonb)", [
    v?.id,
    JSON.stringify({
      [perguntas[0]?.id as string]: "CONFORME",
      [perguntas[1]?.id as string]: "SIM",
    }),
  ]);
  await s.query(
    `select public.rpc_registrar_evidencia('VISTORIA', $1, 'FOTO', $2, 'image/jpeg', 100, $3, p_pergunta => $4)`,
    [v?.id, `${EMPRESA_A}/vistoria/${v?.id}/${randomUUID()}.jpg`, "d".repeat(64), perguntas[0]?.id],
  );
  await s.query("select public.rpc_concluir_vistoria($1)", [v?.id]);
}

/** Agenda, faz as vistorias e confirma a retirada com as quantidades dadas (padrão: tudo). */
async function retirar(s: Sessao, devolucao: string, quantidades: Record<string, number> = {}) {
  await s.query("select public.rpc_agendar_devolucao($1, now())", [devolucao]);
  const lista = await itens(s, devolucao);
  const payload = [];
  for (const it of lista) {
    const [q] = await s.query<{ q: string }>(
      "select quantidade_solicitada::text q from public.itens_devolucao where id = $1",
      [it.id],
    );
    const quantidade = quantidades[it.id] ?? Number(q?.q);
    if (quantidade > 0) await vistoriaSaida(s, it.id);
    payload.push({ id: it.id, quantidade, condicao: "BOM" });
  }
  await s.query("select public.rpc_confirmar_retirada($1, now(), 'João da Locadora', $2::jsonb)", [
    devolucao,
    JSON.stringify(payload),
  ]);
}

async function locacao(s: Sessao, id: string = A.locacaoAtiva) {
  const [l] = await s.query<{ status: string; financeiro: string; dev: string | null }>(
    "select status, status_financeiro financeiro, desmobilizacao_devolucao_id dev from public.locacoes where id = $1",
    [id],
  );
  return l;
}

async function lote(s: Sessao) {
  const [l] = await s.query<{ saldo: string; devolvida: string; status: string }>(
    "select saldo::text, quantidade_devolvida::text devolvida, status from public.lotes where id = $1",
    [A.loteAndaime],
  );
  return l;
}

const TUDO: ItemSolicitado[] = [
  { bem: A.bemEstacao1 },
  { bem: A.bemEstacao2 },
  { lote: A.loteAndaime },
];

describe("devolução (RN-50..58)", () => {
  it("CA-50: devolução parcial de 30 de um lote de 60 só muda o saldo na retirada", async () => {
    await comoAtor(operacao, async (s) => {
      const dev = await solicitar(s, [{ lote: A.loteAndaime, quantidade: 30 }]);
      expect(await lote(s)).toEqual({ saldo: "60.000", devolvida: "0.000", status: "ATIVO" });
      // RN-52: o restante disponível é 30.
      const excesso = await s.tentar("select public.rpc_solicitar_devolucao($1, $2::jsonb)", [
        A.locacaoAtiva,
        JSON.stringify([{ lote: A.loteAndaime, quantidade: 31 }]),
      ]);
      expect(excesso.ok).toBe(false);
      if (!excesso.ok) expect(excesso.mensagem).toContain("disponível para devolução: 30");
      await retirar(s, dev);
      expect(await lote(s)).toEqual({ saldo: "30.000", devolvida: "30.000", status: "ATIVO" });
      // CA-51: retirada não encerra cobrança.
      expect((await locacao(s))?.financeiro).toBe("EM_COBRANCA");
    });
  });

  it("retirada parcial: só a quantidade retirada sai; o resto volta a ficar disponível", async () => {
    await comoAtor(operacao, async (s) => {
      const dev = await solicitar(s, [{ lote: A.loteAndaime, quantidade: 30 }]);
      const [it] = await itens(s, dev);
      await retirar(s, dev, { [it?.id as string]: 20 });
      expect(await lote(s)).toEqual({ saldo: "40.000", devolvida: "20.000", status: "ATIVO" });
      const [r] = await s.query<{ reserva: string }>(
        `select coalesce(sum(i.quantidade_solicitada), 0)::text reserva from public.itens_devolucao i
         join public.devolucoes d on d.id = i.devolucao_id
         where i.lote_id = $1 and i.ativo and d.status in ('SOLICITADA', 'AGENDADA')`,
        [A.loteAndaime],
      );
      expect(r?.reserva).toBe("0");
    });
  });

  it("bem individual: fica DEVOLUCAO_SOLICITADA, não entra em outra devolução e volta ao estado anterior se cancelada", async () => {
    await comoAtor(operacao, async (s) => {
      const dev = await solicitar(s, [{ bem: A.bemEstacao1 }]);
      const status = async () =>
        (
          await s.query<{ status: string }>("select status from public.bens where id = $1", [
            A.bemEstacao1,
          ])
        )[0]?.status;
      expect(await status()).toBe("DEVOLUCAO_SOLICITADA");
      const outra = await s.tentar("select public.rpc_solicitar_devolucao($1, $2::jsonb)", [
        A.locacaoAtiva,
        JSON.stringify([{ bem: A.bemEstacao1 }]),
      ]);
      expect(outra.ok).toBe(false);
      const mover = await s.tentar(
        "select public.rpc_registrar_movimentacao($1, $2, now(), 'Teste', p_bem => $3)",
        [A.localObra2, USUARIOS.operacaoA, A.bemEstacao1],
      );
      expect(mover.ok).toBe(false);
      const curto = await s.tentar("select public.rpc_cancelar_devolucao($1, 'curto')", [dev]);
      expect(curto.ok).toBe(false);
      await s.query("select public.rpc_cancelar_devolucao($1, 'Obra prorrogada pelo cliente')", [
        dev,
      ]);
      expect(await status()).toBe("EM_USO");
      expect((await locacao(s))?.status).toBe("ATIVA");
    });
  });

  it("retirada exige agendamento, recebedor do fornecedor, data não futura e vistoria de saída", async () => {
    await comoAtor(operacao, async (s) => {
      const dev = await solicitar(s, [{ bem: A.bemEstacao1 }]);
      const [it] = await itens(s, dev);
      const payload = JSON.stringify([{ id: it?.id, quantidade: 1, condicao: "BOM" }]);
      const semAgenda = await s.tentar(
        "select public.rpc_confirmar_retirada($1, now(), 'João', $2::jsonb)",
        [dev, payload],
      );
      expect(semAgenda.ok).toBe(false);
      if (!semAgenda.ok) expect(semAgenda.mensagem).toContain("agendada");
      await s.query("select public.rpc_agendar_devolucao($1, now() + interval '1 day')", [dev]);
      // Reagendamento preserva a data anterior na auditoria.
      await s.query("select public.rpc_agendar_devolucao($1, now() + interval '2 days')", [dev]);
      await s.como(superusuario);
      const [aud] = await s.query<{ n: string }>(
        "select count(*)::text n from public.auditoria where entidade_id = $1 and acao = 'devolucao.reagendar'",
        [dev],
      );
      expect(aud?.n).toBe("1");
      await s.como(operacao);
      for (const [sql, trecho] of [
        ["select public.rpc_confirmar_retirada($1, now(), ' ', $2::jsonb)", "quem recebeu"],
        [
          "select public.rpc_confirmar_retirada($1, now() + interval '1 day', 'João', $2::jsonb)",
          "futuro",
        ],
        ["select public.rpc_confirmar_retirada($1, now(), 'João', $2::jsonb)", "vistoria de saída"],
      ] as const) {
        const r = await s.tentar(sql, [dev, payload]);
        expect(r.ok, sql).toBe(false);
        if (!r.ok) expect(r.mensagem).toContain(trecho);
      }
      await vistoriaSaida(s, it?.id as string);
      await s.query("select public.rpc_confirmar_retirada($1, now(), 'João Silva', $2::jsonb)", [
        dev,
        payload,
      ]);
      const [b] = await s.query<{ status: string }>(
        "select status from public.bens where id = $1",
        [A.bemEstacao1],
      );
      expect(b?.status).toBe("DEVOLVIDO");
      const tl = await s.query<{ titulo: string }>(
        "select titulo from public.linha_do_tempo(p_bem => $1)",
        [A.bemEstacao1],
      );
      expect(tl.map((e) => e.titulo)).toEqual(
        expect.arrayContaining(["Devolução solicitada", "Retirado pelo fornecedor"]),
      );
    });
  });

  it("retirada imediata registra o agendamento na mesma operação", async () => {
    await comoAtor(operacao, async (s) => {
      const dev = await solicitar(s, [{ bem: A.bemEstacao1 }]);
      const [it] = await itens(s, dev);
      await vistoriaSaida(s, it?.id as string);
      await s.query(
        "select public.rpc_confirmar_retirada($1, now(), 'João', $2::jsonb, p_imediata => true)",
        [dev, JSON.stringify([{ id: it?.id, quantidade: 1, condicao: "REGULAR" }])],
      );
      await s.como(superusuario);
      const acoes = await s.query<{ acao: string }>(
        "select acao from public.auditoria where entidade_id = $1 order by id",
        [dev],
      );
      expect(acoes.map((a) => a.acao)).toEqual(
        expect.arrayContaining(["devolucao.agendar", "devolucao.confirmar_retirada"]),
      );
    });
  });

  it("D-15: devolução que cobre todo o saldo desmobiliza a locação; cancelá-la reativa", async () => {
    await comoAtor(operacao, async (s) => {
      const parcial = await solicitar(s, [{ bem: A.bemEstacao1 }]);
      expect((await locacao(s))?.status).toBe("ATIVA");
      const total = await solicitar(s, [{ bem: A.bemEstacao2 }, { lote: A.loteAndaime }]);
      expect(await locacao(s)).toEqual({
        status: "EM_DEVOLUCAO",
        financeiro: "EM_COBRANCA",
        dev: total,
      });
      await s.query("select public.rpc_cancelar_devolucao($1, 'Cliente pediu mais prazo')", [
        total,
      ]);
      expect((await locacao(s))?.status).toBe("ATIVA");
      await s.query("select public.rpc_cancelar_devolucao($1, 'Cliente pediu mais prazo')", [
        parcial,
      ]);
    });
  });

  it("bem extraviado durante a devolução não é retirado e a ocorrência guarda o estado anterior real", async () => {
    await comoAtor(operacao, async (s) => {
      const dev = await solicitar(s, [{ bem: A.bemEstacao2 }]);
      await s.query(
        "select public.rpc_registrar_ocorrencia('EXTRAVIO', 'Não localizado no carregamento', now(), p_bem => $1)",
        [A.bemEstacao2],
      );
      await s.query("select public.rpc_agendar_devolucao($1, now())", [dev]);
      const [it] = await itens(s, dev);
      const r = await s.tentar(
        "select public.rpc_confirmar_retirada($1, now(), 'João', $2::jsonb)",
        [dev, JSON.stringify([{ id: it?.id, quantidade: 0 }])],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.mensagem).toContain("Nenhum item retirado");
      await s.query(
        "select public.rpc_cancelar_devolucao($1, 'Bem extraviado antes da retirada')",
        [dev],
      );
      const [o] = await s.query<{ anterior: string }>(
        "select status_anterior_bem anterior from public.ocorrencias where bem_id = $1 and tipo = 'EXTRAVIO'",
        [A.bemEstacao2],
      );
      expect(o?.anterior).toBe("DISPONIVEL");
    });
  });

  it("comprovante só após a retirada; conferência exige comprovante; ciência é do financeiro", async () => {
    await comoAtor(operacao, async (s) => {
      const dev = await solicitar(s, [{ bem: A.bemEstacao1 }]);
      const comprovante = () =>
        s.tentar(
          "select public.rpc_registrar_evidencia('DEVOLUCAO', $1, 'COMPROVANTE', $2, 'application/pdf', 100, $3)",
          [dev, `${EMPRESA_A}/devolucao/${dev}/${randomUUID()}.pdf`, "e".repeat(64)],
        );
      const antes = await comprovante();
      expect(antes.ok).toBe(false);
      await retirar(s, dev);
      const semComprovante = await s.tentar("select public.rpc_conferir_devolucao($1)", [dev]);
      expect(semComprovante.ok).toBe(false);
      expect((await comprovante()).ok).toBe(true);
      await s.query("select public.rpc_conferir_devolucao($1)", [dev]);

      const operacaoCiencia = await s.tentar("select public.rpc_dar_ciencia_devolucao($1)", [dev]);
      expect(operacaoCiencia.ok).toBe(false);
      if (!operacaoCiencia.ok) expect(operacaoCiencia.codigo).toBe(SQLSTATE.privilegioInsuficiente);
      await s.como(financeiro);
      await s.query("select public.rpc_dar_ciencia_devolucao($1)", [dev]);
      const [d] = await s.query<{ status: string; ciencia: boolean; comprovante: boolean }>(
        "select status, ciencia_financeira_em is not null ciencia, comprovante_confirmado comprovante from public.devolucoes where id = $1",
        [dev],
      );
      expect(d).toEqual({ status: "CONFERIDA", ciencia: true, comprovante: true });
      // Financeiro não gerencia a devolução.
      const cancelar = await s.tentar("select public.rpc_solicitar_devolucao($1, $2::jsonb)", [
        A.locacaoAtiva,
        JSON.stringify([{ bem: A.bemEstacao2 }]),
      ]);
      expect(cancelar.ok).toBe(false);
      if (!cancelar.ok) expect(cancelar.codigo).toBe(SQLSTATE.privilegioInsuficiente);
    });
  });

  it("escrita direta em devoluções é negada (só funções de domínio)", async () => {
    await comoAtor(operacao, async (s) => {
      const r = await s.tentar(
        "insert into public.devolucoes (empresa_id, locacao_id) values ($1, $2)",
        [EMPRESA_A, A.locacaoAtiva],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
    });
  });
});

describe("encerramentos independentes (RN-60..62)", () => {
  it("CA-52/53/55: saldo zerado → encerramento pendente; operacional e financeiro não se disparam", async () => {
    await comoAtor(operacao, async (s) => {
      // CA-53: com bem ativo, o encerramento operacional é recusado.
      await s.query("select public.rpc_iniciar_desmobilizacao($1)", [A.locacaoAtiva]);
      const cedo = await s.tentar("select public.rpc_encerrar_operacional($1)", [A.locacaoAtiva]);
      expect(cedo.ok).toBe(false);
      if (!cedo.ok) expect(cedo.mensagem).toContain("bem(ns) ainda sob responsabilidade");

      const dev = await solicitar(s, TUDO);
      const aberta = await s.tentar("select public.rpc_encerrar_operacional($1)", [A.locacaoAtiva]);
      expect(aberta.ok).toBe(false);
      if (!aberta.ok) expect(aberta.mensagem).toContain("aguardando retirada");
      await retirar(s, dev);
      expect(await locacao(s)).toMatchObject({
        status: "EM_DEVOLUCAO",
        financeiro: "ENCERRAMENTO_PENDENTE",
      });
      expect((await lote(s))?.status).toBe("ENCERRADO");

      // Financeiro primeiro: bloqueado pela cobrança pendente; não altera o status operacional.
      await s.como(financeiro);
      const pendente = await s.tentar("select public.rpc_encerrar_financeiro($1, current_date)", [
        A.locacaoAtiva,
      ]);
      expect(pendente.ok).toBe(false);
      if (!pendente.ok) expect(pendente.mensagem).toContain("pendente(s) ou divergente(s)");
      await s.query("select public.rpc_conferir_cobranca($1)", [A.cobranca]);
      const futura = await s.tentar("select public.rpc_encerrar_financeiro($1, current_date + 2)", [
        A.locacaoAtiva,
      ]);
      expect(futura.ok).toBe(false);
      const operacionalPeloFinanceiro = await s.tentar(
        "select public.rpc_encerrar_operacional($1)",
        [A.locacaoAtiva],
      );
      expect(operacionalPeloFinanceiro.ok).toBe(false);
      if (!operacionalPeloFinanceiro.ok)
        expect(operacionalPeloFinanceiro.codigo).toBe(SQLSTATE.privilegioInsuficiente);
      await s.query("select public.rpc_encerrar_financeiro($1, current_date - 1)", [
        A.locacaoAtiva,
      ]);
      expect(await locacao(s)).toMatchObject({ status: "EM_DEVOLUCAO", financeiro: "ENCERRADO" });

      // Depois o operacional: não altera o financeiro.
      await s.como(operacao);
      const financeiroPelaOperacao = await s.tentar(
        "select public.rpc_encerrar_financeiro($1, current_date)",
        [A.locacaoAtiva],
      );
      expect(financeiroPelaOperacao.ok).toBe(false);
      await s.query("select public.rpc_encerrar_operacional($1)", [A.locacaoAtiva]);
      expect(await locacao(s)).toMatchObject({
        status: "ENCERRADA_OPERACIONALMENTE",
        financeiro: "ENCERRADO",
      });
      await s.como(superusuario);
      const acoes = await s.query<{ acao: string }>(
        "select acao from public.auditoria where entidade_id = $1 order by id",
        [A.locacaoAtiva],
      );
      expect(acoes.map((a) => a.acao)).toEqual(
        expect.arrayContaining([
          "financeiro.encerramento_pendente",
          "locacao.encerrar_financeiro",
          "locacao.encerrar_operacional",
        ]),
      );
    });
  });

  it("operacional antes do financeiro mantém o encerramento pendente", async () => {
    await comoAtor(operacao, async (s) => {
      const dev = await solicitar(s, TUDO);
      await retirar(s, dev);
      await s.query("select public.rpc_encerrar_operacional($1)", [A.locacaoAtiva]);
      expect(await locacao(s)).toMatchObject({
        status: "ENCERRADA_OPERACIONALMENTE",
        financeiro: "ENCERRAMENTO_PENDENTE",
      });
      // Financeiro continua podendo registrar e conferir cobranças.
      await s.como(financeiro);
      const [c] = await s.query<{ id: string }>(
        "select public.rpc_registrar_cobranca($1, current_date - 30, current_date, 100.50, 'NF-9') id",
        [A.locacaoAtiva],
      );
      expect(c?.id).toBeTruthy();
    });
  });
});

describe("cobranças (RN-70..74)", () => {
  it("registrar, divergir, resolver; RN-74 inicia o ciclo financeiro; só ADMIN/FINANCEIRO", async () => {
    await comoAtor(compras, async (s) => {
      const r = await s.tentar(
        "select public.rpc_registrar_cobranca($1, current_date - 30, current_date, 10, 'X')",
        [A.locacaoEmDevolucao],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);

      await s.como(financeiro);
      const invalida = await s.tentar(
        "select public.rpc_registrar_cobranca($1, current_date, current_date - 1, 10)",
        [A.locacaoEmDevolucao],
      );
      expect(invalida.ok).toBe(false);
      const centavos = await s.tentar(
        "select public.rpc_registrar_cobranca($1, current_date - 1, current_date, 10.005)",
        [A.locacaoEmDevolucao],
      );
      expect(centavos.ok).toBe(false);
      expect((await locacao(s, A.locacaoEmDevolucao))?.financeiro).toBe("NAO_INICIADO");
      const [c] = await s.query<{ id: string }>(
        "select public.rpc_registrar_cobranca($1, current_date - 30, current_date, 450.00, 'NF-55') id",
        [A.locacaoEmDevolucao],
      );
      expect((await locacao(s, A.locacaoEmDevolucao))?.financeiro).toBe("EM_COBRANCA");
      await s.query("select public.rpc_conferir_cobranca($1)", [c?.id]);
      const semMotivo = await s.tentar("select public.rpc_marcar_cobranca_divergente($1, 'x')", [
        c?.id,
      ]);
      expect(semMotivo.ok).toBe(false);
      await s.query(
        "select public.rpc_marcar_cobranca_divergente($1, 'Valor acima do contratado no período')",
        [c?.id],
      );
      await s.query(
        "select public.rpc_resolver_cobranca($1, 'Fornecedor emitiu nota de crédito NC-12')",
        [c?.id],
      );
      const [r2] = await s.query<{ status: string }>(
        "select status from public.cobrancas where id = $1",
        [c?.id],
      );
      expect(r2?.status).toBe("RESOLVIDA");
      const denovo = await s.tentar(
        "select public.rpc_marcar_cobranca_divergente($1, 'Nova divergência após resolução')",
        [c?.id],
      );
      expect(denovo.ok).toBe(false);
    });
  });
});

describe("estimativa (RN-72/73)", () => {
  it("unidades × dias de posse no período; dia da retirada não conta", async () => {
    await comoAtor(financeiro, async (s) => {
      const estimar = async (inicio: string, fim: string) =>
        s.query<{ descricao: string; unidades_dia: string; valor_estimado: string }>(
          `select descricao, unidades_dia, valor_estimado
           from public.estimativa_locacao($1, current_date + $2::int, current_date + $3::int)`,
          [A.locacaoAtiva, inicio, fim],
        );
      // Lote de 60 peças recebido há 38 dias, diária de 1,20: 10 dias = 600 peças-dia = 720.
      const dez = await estimar("-10", "-1");
      const andaime = dez.find((e) => e.descricao.startsWith("Andaime"));
      expect(Number(andaime?.unidades_dia)).toBe(600);
      expect(Number(andaime?.valor_estimado)).toBe(720);
      // 2 estações (mensal 2.800 → 2.800/30 por dia).
      const estacao = dez.find((e) => e.descricao.startsWith("Estação"));
      expect(Number(estacao?.unidades_dia)).toBe(20);
      expect(Number(estacao?.valor_estimado)).toBeCloseTo((20 * 2800) / 30, 6);

      await s.como(operacao);
      const sem = await s.tentar(
        "select * from public.estimativa_locacao($1, current_date, current_date)",
        [A.locacaoAtiva],
      );
      expect(sem.ok).toBe(false);
      if (!sem.ok) expect(sem.codigo).toBe(SQLSTATE.privilegioInsuficiente);
      const dev = await solicitar(s, [{ lote: A.loteAndaime, quantidade: 30 }]);
      await retirar(s, dev);
      await s.como(financeiro);
      const hoje = await estimar("0", "0");
      expect(Number(hoje.find((e) => e.descricao.startsWith("Andaime"))?.unidades_dia)).toBe(30);
    });
  });

  it("responsável local não vê estimativa nem cobranças", async () => {
    await comoAtor(responsavel, async (s) => {
      const r = await s.tentar(
        "select * from public.estimativa_locacao($1, current_date, current_date)",
        [A.locacaoAtiva],
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.codigo).toBe(SQLSTATE.naoEncontrado);
    });
  });
});

describe("consistência da Fase 7 com o seed", () => {
  it("a devolução do seed segue as mesmas regras (sem cobrança encerrada pela retirada)", async () => {
    await comoAtor(superusuario, async (s) => {
      const [d] = await s.query<{ status: string }>(
        "select status from public.devolucoes where id = $1",
        [A.devolucao],
      );
      expect(d?.status).toBe("SOLICITADA");
    });
  });
});
