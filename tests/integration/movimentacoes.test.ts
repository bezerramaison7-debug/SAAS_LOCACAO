/** Fase 6: movimentações, ocorrências, troca, vistoria avulsa e linha do tempo. */
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
const responsavel = usuario(USUARIOS.responsavelA);
const admin = usuario(USUARIOS.adminA);
const compras = usuario(USUARIOS.comprasA);

type Mov = {
  destino: string;
  resp: string;
  bem?: string;
  lote?: string;
  qtd?: number;
  corrige?: string;
  motivo?: string;
};

async function mover(s: Sessao, m: Mov): Promise<string> {
  const [r] = await s.query<{ id: string }>(
    `select public.rpc_registrar_movimentacao($1, $2, now(), $3, p_bem => $4, p_lote => $5, p_quantidade => $6,
       p_corrige => $7) id`,
    [
      m.destino,
      m.resp,
      m.motivo ?? "Envio para frente de serviço",
      m.bem ?? null,
      m.lote ?? null,
      m.qtd ?? null,
      m.corrige ?? null,
    ],
  );
  return r?.id as string;
}

async function bem(s: Sessao, id: string) {
  const [b] = await s.query<{ status: string; local: string; resp: string }>(
    "select status, local_atual_id local, responsavel_atual_id resp from public.bens where id = $1",
    [id],
  );
  return b;
}

async function exigirAceite(s: Sessao, valor: boolean) {
  await s.como(superusuario);
  await s.query("update public.empresas set exige_aceite_movimentacao = $2 where id = $1", [
    EMPRESA_A,
    valor,
  ]);
}

/**
 * Invariante do gate (RN-30): o local e o responsável atuais de cada bem/lote
 * ativo são exatamente os do último evento confirmado.
 */
async function violacoesInvariante(s: Sessao): Promise<unknown[]> {
  await s.como(superusuario);
  return s.query(
    `with ultimo_bem as (
       select distinct on (m.bem_id) m.bem_id, m.destino_local_id, m.novo_responsavel_id
       from public.movimentacoes m where m.status = 'CONFIRMADA' and m.bem_id is not null
       order by m.bem_id, m.data_evento desc, m.confirmada_em desc
     ), ultimo_lote as (
       select distinct on (m.lote_destino_id) m.lote_destino_id lote_id, m.destino_local_id, m.novo_responsavel_id
       from public.movimentacoes m where m.status = 'CONFIRMADA' and m.lote_destino_id is not null
       order by m.lote_destino_id, m.data_evento desc, m.confirmada_em desc
     )
     select 'bem' tipo, b.codigo from public.bens b
     left join ultimo_bem u on u.bem_id = b.id
     left join public.recebimentos r on r.id = b.recebimento_id
     left join public.bens antigo on antigo.id = b.substitui_bem_id
     where b.empresa_id = $1 and public.status_bem_ativo(b.status) and b.status <> 'EM_TRANSFERENCIA'
       and (b.local_atual_id is distinct from case when u.bem_id is not null then u.destino_local_id
                                                   when antigo.id is not null then antigo.local_atual_id
                                                   else r.local_id end
         or b.responsavel_atual_id is distinct from case when u.bem_id is not null then u.novo_responsavel_id
                                                         when antigo.id is not null then antigo.responsavel_atual_id
                                                         else r.responsavel_id end)
     union all
     select 'lote', l.codigo from public.lotes l
     left join ultimo_lote u on u.lote_id = l.id
     left join public.recebimentos r on r.id = l.recebimento_id
     where l.empresa_id = $1 and l.status = 'ATIVO'
       and (l.local_atual_id is distinct from case when u.lote_id is not null then u.destino_local_id else r.local_id end
         or l.responsavel_atual_id is distinct from
              case when u.lote_id is not null then u.novo_responsavel_id else r.responsavel_id end)`,
    [EMPRESA_A],
  );
}

describe("movimentação (RN-30..RN-35)", () => {
  it("sem aceite: confirma na hora e atualiza local/responsável; data anterior ao último evento é recusada", async () => {
    await comoAtor(operacao, async (s) => {
      await mover(s, { bem: A.bemEstacao2, destino: A.localObra2, resp: USUARIOS.responsavelA });
      expect(await bem(s, A.bemEstacao2)).toEqual({
        status: "EM_USO",
        local: A.localObra2,
        resp: USUARIOS.responsavelA,
      });
      const passado = await s.tentar(
        `select public.rpc_registrar_movimentacao($1, $2, now() - interval '60 days', 'Retroativa', p_bem => $3)`,
        [A.localAlmoxarifado, USUARIOS.operacaoA, A.bemEstacao2],
      );
      expect(passado.ok).toBe(false);
      if (!passado.ok) expect(passado.mensagem).toContain("posterior ao último evento");
      expect(await violacoesInvariante(s)).toEqual([]);
    });
  });

  it("com aceite: fica em transferência, bloqueia nova movimentação e só o destinatário aceita", async () => {
    await comoAtor(operacao, async (s) => {
      await exigirAceite(s, true);
      await s.como(operacao);
      const id = await mover(s, {
        bem: A.bemEstacao2,
        destino: A.localObra1,
        resp: USUARIOS.responsavelA,
      });
      expect(await bem(s, A.bemEstacao2)).toEqual({
        status: "EM_TRANSFERENCIA",
        local: A.localAlmoxarifado,
        resp: USUARIOS.operacaoA,
      });
      const outra = await s.tentar(
        "select public.rpc_registrar_movimentacao($1, $2, now(), 'Outra', p_bem => $3)",
        [A.localObra2, USUARIOS.operacaoA, A.bemEstacao2],
      );
      expect(outra.ok).toBe(false);

      await s.como(compras);
      const terceiro = await s.tentar("select public.rpc_aceitar_movimentacao($1)", [id]);
      expect(terceiro.ok).toBe(false);
      if (!terceiro.ok) expect(terceiro.codigo).toBe(SQLSTATE.privilegioInsuficiente);

      await s.como(responsavel);
      await s.query("select public.rpc_aceitar_movimentacao($1)", [id]);
      expect(await bem(s, A.bemEstacao2)).toEqual({
        status: "EM_USO",
        local: A.localObra1,
        resp: USUARIOS.responsavelA,
      });
      const [m] = await s.query<{ status: string; aceita_por: string }>(
        "select status, aceita_por from public.movimentacoes where id = $1",
        [id],
      );
      expect(m).toEqual({ status: "CONFIRMADA", aceita_por: USUARIOS.responsavelA });
      // Confirmada é imutável (RN-31).
      await s.como(superusuario);
      const alterar = await s.tentar("update public.movimentacoes set motivo = 'x' where id = $1", [
        id,
      ]);
      expect(alterar.ok).toBe(false);
      expect(await violacoesInvariante(s)).toEqual([]);
    });
  });

  it("recusa mantém local e responsável de origem; aceite administrativo exige justificativa", async () => {
    await comoAtor(operacao, async (s) => {
      await exigirAceite(s, true);
      await s.como(operacao);
      const recusada = await mover(s, {
        bem: A.bemEstacao2,
        destino: A.localObra1,
        resp: USUARIOS.responsavelA,
      });
      await s.como(responsavel);
      const curto = await s.tentar("select public.rpc_recusar_movimentacao($1, '')", [recusada]);
      expect(curto.ok).toBe(false);
      await s.query("select public.rpc_recusar_movimentacao($1, 'Não estou na obra')", [recusada]);
      await s.como(operacao); // RLS: o bem não está sob responsabilidade do responsável local
      expect(await bem(s, A.bemEstacao2)).toEqual({
        status: "EM_USO",
        local: A.localAlmoxarifado,
        resp: USUARIOS.operacaoA,
      });

      await s.como(operacao);
      const id = await mover(s, {
        bem: A.bemEstacao2,
        destino: A.localObra1,
        resp: USUARIOS.responsavelA,
      });
      await s.como(admin);
      const semJustificativa = await s.tentar("select public.rpc_aceitar_movimentacao($1)", [id]);
      expect(semJustificativa.ok).toBe(false);
      await s.query(
        "select public.rpc_aceitar_movimentacao($1, 'Responsável sem acesso ao sistema hoje')",
        [id],
      );
      const [m] = await s.query<{ aceite_administrativo: boolean }>(
        "select aceite_administrativo from public.movimentacoes where id = $1",
        [id],
      );
      expect(m?.aceite_administrativo).toBe(true);
    });
  });

  it("cancelamento de pendente pelo autor devolve o bem ao uso na origem", async () => {
    await comoAtor(operacao, async (s) => {
      await exigirAceite(s, true);
      await s.como(operacao);
      const id = await mover(s, {
        bem: A.bemEstacao2,
        destino: A.localObra1,
        resp: USUARIOS.responsavelA,
      });
      await s.query(
        "select public.rpc_cancelar_movimentacao($1, 'Enviado por engano ao responsável')",
        [id],
      );
      expect((await bem(s, A.bemEstacao2))?.status).toBe("EM_USO");
      expect((await bem(s, A.bemEstacao2))?.local).toBe(A.localAlmoxarifado);
    });
  });

  it("lote: movimentação parcial divide (RN-34) e o saldo do item se mantém", async () => {
    await comoAtor(operacao, async (s) => {
      const id = await mover(s, {
        lote: A.loteAndaime,
        qtd: 20,
        destino: A.localObra1,
        resp: USUARIOS.responsavelA,
      });
      const [m] = await s.query<{ lote_destino_id: string }>(
        "select lote_destino_id from public.movimentacoes where id = $1",
        [id],
      );
      const lotes = await s.query<{
        id: string;
        saldo: string;
        local: string;
        origem: string | null;
      }>(
        `select id, saldo::text, local_atual_id local, lote_origem_id origem from public.lotes
         where id in ($1, $2) order by lote_origem_id nulls first`,
        [A.loteAndaime, m?.lote_destino_id],
      );
      expect(lotes).toEqual([
        { id: A.loteAndaime, saldo: "40.000", local: A.localObra2, origem: null },
        { id: m?.lote_destino_id, saldo: "20.000", local: A.localObra1, origem: A.loteAndaime },
      ]);
      const [saldo] = await s.query<{ saldo: string }>(
        "select saldo::text from public.v_saldo_item_locacao where item_locacao_id = $1",
        [A.itemAndaime],
      );
      expect(saldo?.saldo).toBe("60.000");
      // Movimentar todo o restante não cria lote novo.
      const total = await mover(s, {
        lote: A.loteAndaime,
        destino: A.localObra1,
        resp: USUARIOS.operacaoA,
      });
      const [t] = await s.query<{ lote_destino_id: string; quantidade: string }>(
        "select lote_destino_id, quantidade::text from public.movimentacoes where id = $1",
        [total],
      );
      expect(t).toEqual({ lote_destino_id: A.loteAndaime, quantidade: "40.000" });
      const excesso = await s.tentar(
        "select public.rpc_registrar_movimentacao($1, $2, now(), 'Demais', p_lote => $3, p_quantidade => 999)",
        [A.localObra2, USUARIOS.operacaoA, A.loteAndaime],
      );
      expect(excesso.ok).toBe(false);
      expect(await violacoesInvariante(s)).toEqual([]);
    });
  });

  it("correção referencia a movimentação confirmada e exige motivo", async () => {
    await comoAtor(operacao, async (s) => {
      const errada = await mover(s, {
        bem: A.bemEstacao2,
        destino: A.localObra2,
        resp: USUARIOS.operacaoA,
      });
      const curta = await s.tentar(
        "select public.rpc_registrar_movimentacao($1, $2, now(), 'Erro', p_bem => $3, p_corrige => $4)",
        [A.localObra1, USUARIOS.operacaoA, A.bemEstacao2, errada],
      );
      expect(curta.ok).toBe(false);
      const id = await mover(s, {
        bem: A.bemEstacao2,
        destino: A.localObra1,
        resp: USUARIOS.operacaoA,
        corrige: errada,
        motivo: "Correção: destino lançado errado",
      });
      const [m] = await s.query<{ corrige: string }>(
        "select corrige_movimentacao_id corrige from public.movimentacoes where id = $1",
        [id],
      );
      expect(m?.corrige).toBe(errada);
      expect((await bem(s, A.bemEstacao2))?.local).toBe(A.localObra1);
    });
  });

  it("responsável precisa ser membro ativo e não auditor; responsável local não movimenta", async () => {
    await comoAtor(operacao, async (s) => {
      const auditor = await s.tentar(
        "select public.rpc_registrar_movimentacao($1, $2, now(), 'Teste', p_bem => $3)",
        [A.localObra1, USUARIOS.auditorA, A.bemEstacao2],
      );
      expect(auditor.ok).toBe(false);
      if (!auditor.ok) expect(auditor.mensagem).toContain("auditor");
      await s.como(responsavel);
      const rl = await s.tentar(
        "select public.rpc_registrar_movimentacao($1, $2, now(), 'Teste', p_bem => $3)",
        [A.localObra2, USUARIOS.responsavelA, A.bemEstacao1],
      );
      expect(rl.ok).toBe(false);
    });
  });
});

describe("ocorrências (RN-40..RN-44)", () => {
  async function ocorrencia(
    s: Sessao,
    tipo: string,
    extra: string,
    params: unknown[],
  ): Promise<string> {
    const [o] = await s.query<{ id: string }>(
      `select public.rpc_registrar_ocorrencia($1::public.tipo_ocorrencia, 'Descrição detalhada do fato', now()${extra}) id`,
      [tipo, ...params],
    );
    return o?.id as string;
  }

  it("extravio: bem continua no saldo; encontrado volta ao estado anterior; indenizado vira baixado", async () => {
    await comoAtor(operacao, async (s) => {
      const o = await ocorrencia(s, "EXTRAVIO", ", p_bem => $2", [A.bemEstacao1]);
      expect((await bem(s, A.bemEstacao1))?.status).toBe("EXTRAVIADO");
      const saldo = async () =>
        (
          await s.query<{ saldo: string }>(
            "select saldo::text from public.v_saldo_item_locacao where item_locacao_id = $1",
            [A.itemEstacao],
          )
        )[0]?.saldo;
      expect(await saldo()).toBe("2.000");
      const errado = await s.tentar(
        "select public.rpc_resolver_ocorrencia($1, 'REPARADO', 'Resolvido de outra forma')",
        [o],
      );
      expect(errado.ok).toBe(false);
      await s.query(
        "select public.rpc_resolver_ocorrencia($1, 'ENCONTRADO', 'Achado no contêiner da obra')",
        [o],
      );
      expect((await bem(s, A.bemEstacao1))?.status).toBe("EM_USO");
      const reabrir = await s.tentar(
        "select public.rpc_reabrir_ocorrencia($1, 'Na verdade sumiu de novo')",
        [o],
      );
      expect(reabrir.ok).toBe(false);

      const o2 = await ocorrencia(s, "EXTRAVIO", ", p_bem => $2", [A.bemEstacao1]);
      await s.query(
        "select public.rpc_resolver_ocorrencia($1, 'INDENIZADO', 'Fornecedor cobrou o valor do bem')",
        [o2],
      );
      expect((await bem(s, A.bemEstacao1))?.status).toBe("BAIXADO");
      expect(await saldo()).toBe("1.000");
    });
  });

  it("extravio de lote indenizado baixa a quantidade", async () => {
    await comoAtor(operacao, async (s) => {
      const o = await ocorrencia(s, "EXTRAVIO", ", p_lote => $2, p_quantidade => 5", [
        A.loteAndaime,
      ]);
      await s.query(
        "select public.rpc_resolver_ocorrencia($1, 'INDENIZADO', 'Cinco peças indenizadas ao fornecedor')",
        [o],
      );
      const [l] = await s.query<{ saldo: string; baixada: string }>(
        "select saldo::text, quantidade_baixada::text baixada from public.lotes where id = $1",
        [A.loteAndaime],
      );
      expect(l).toEqual({ saldo: "55.000", baixada: "5.000" });
    });
  });

  it("manutenção bloqueia movimentação; resolver devolve; cancelar extravio também devolve", async () => {
    await comoAtor(operacao, async (s) => {
      const o = await ocorrencia(s, "DEFEITO", ", p_bem => $2, p_manutencao => true", [
        A.bemEstacao2,
      ]);
      expect((await bem(s, A.bemEstacao2))?.status).toBe("EM_MANUTENCAO");
      const mov = await s.tentar(
        "select public.rpc_registrar_movimentacao($1, $2, now(), 'Teste', p_bem => $3)",
        [A.localObra1, USUARIOS.operacaoA, A.bemEstacao2],
      );
      expect(mov.ok).toBe(false);
      await s.query("select public.rpc_tratar_ocorrencia($1, $2, now() + interval '3 days')", [
        o,
        USUARIOS.operacaoA,
      ]);
      await s.query(
        "select public.rpc_resolver_ocorrencia($1, 'REPARADO', 'Placa substituída pelo técnico')",
        [o],
      );
      expect((await bem(s, A.bemEstacao2))?.status).toBe("DISPONIVEL");

      const e = await ocorrencia(s, "EXTRAVIO", ", p_bem => $2", [A.bemEstacao2]);
      await s.query("select public.rpc_cancelar_ocorrencia($1, 'Registrado no bem errado')", [e]);
      expect((await bem(s, A.bemEstacao2))?.status).toBe("DISPONIVEL");
    });
  });

  it("reabrir ocorrência sem efeito no bem; regras por papel", async () => {
    await comoAtor(operacao, async (s) => {
      const o = await ocorrencia(s, "OUTRO", ", p_locacao => $2", [A.locacaoAtiva]);
      await s.query(
        "select public.rpc_resolver_ocorrencia($1, 'OUTRO', 'Tratado com o fornecedor por e-mail')",
        [o],
      );
      await s.query(
        "select public.rpc_reabrir_ocorrencia($1, 'Fornecedor não cumpriu o combinado')",
        [o],
      );
      const [r] = await s.query<{ status: string }>(
        "select status from public.ocorrencias where id = $1",
        [o],
      );
      expect(r?.status).toBe("ABERTA");

      await s.como(usuario(USUARIOS.financeiroA));
      const avaria = await s.tentar(
        "select public.rpc_registrar_ocorrencia('AVARIA', 'Descrição detalhada do fato', now(), p_locacao => $1)",
        [A.locacaoAtiva],
      );
      expect(avaria.ok).toBe(false);
      if (!avaria.ok) expect(avaria.codigo).toBe(SQLSTATE.privilegioInsuficiente);
      const doc = await s.tentar(
        "select public.rpc_registrar_ocorrencia('DIVERGENCIA_DOCUMENTAL', 'Nota com valor diferente do pedido', now(), p_locacao => $1)",
        [A.locacaoAtiva],
      );
      expect(doc.ok).toBe(true);

      // Responsável local: só sobre bens sob sua responsabilidade.
      await s.como(responsavel);
      const meu = await s.tentar(
        "select public.rpc_registrar_ocorrencia('AVARIA', 'Tela trincada após queda', now(), p_bem => $1)",
        [A.bemEstacao1],
      );
      expect(meu.ok).toBe(true);
      const alheio = await s.tentar(
        "select public.rpc_registrar_ocorrencia('AVARIA', 'Tela trincada após queda', now(), p_bem => $1)",
        [A.bemEstacao2],
      );
      expect(alheio.ok).toBe(false);
      const tratar = await s.tentar("select public.rpc_tratar_ocorrencia($1)", [o]);
      expect(tratar.ok).toBe(false);
    });
  });
});

describe("troca (RN-42)", () => {
  it("antigo substituído, novo herda local/responsável, vistoria de entrada pendente e saldo igual", async () => {
    await comoAtor(operacao, async (s) => {
      const sem = await s.tentar(
        "select public.rpc_trocar_bem($1, 'Equipamento com defeito recorrente', now())",
        [A.bemEstacao1],
      );
      expect(sem.ok).toBe(false);
      const mesmaSerie = await s.tentar(
        "select public.rpc_trocar_bem($1, 'Equipamento com defeito recorrente', now(), p_numero_serie => 'TS07-1001')",
        [A.bemEstacao1],
      );
      expect(mesmaSerie.ok).toBe(false);
      const [n] = await s.query<{ id: string }>(
        "select public.rpc_trocar_bem($1, 'Equipamento com defeito recorrente', now(), p_numero_serie => 'TS07-2001') id",
        [A.bemEstacao1],
      );
      expect((await bem(s, A.bemEstacao1))?.status).toBe("SUBSTITUIDO");
      expect(await bem(s, n?.id as string)).toEqual({
        status: "EM_USO",
        local: A.localObra1,
        resp: USUARIOS.responsavelA,
      });
      const [v] = await s.query<{ tipo: string; status: string }>(
        "select tipo, status from public.vistorias where bem_id = $1",
        [n?.id],
      );
      expect(v).toEqual({ tipo: "ENTRADA", status: "RASCUNHO" });
      const [o] = await s.query<{ tipo: string; status: string; bem_substituto_id: string }>(
        "select tipo, status, bem_substituto_id from public.ocorrencias where bem_id = $1 and tipo = 'TROCA'",
        [A.bemEstacao1],
      );
      expect(o).toEqual({ tipo: "TROCA", status: "RESOLVIDA", bem_substituto_id: n?.id });
      const [saldo] = await s.query<{ saldo: string; recebida: string }>(
        "select saldo::text, quantidade_recebida::text recebida from public.v_saldo_item_locacao where item_locacao_id = $1",
        [A.itemEstacao],
      );
      expect(saldo).toEqual({ saldo: "2.000", recebida: "2.000" });
      expect(await violacoesInvariante(s)).toEqual([]);
    });
  });
});

describe("vistoria avulsa e linha do tempo", () => {
  it("vistoria periódica só conclui com obrigatórias e fotos (RN-83)", async () => {
    await comoAtor(operacao, async (s) => {
      const [v] = await s.query<{ id: string }>(
        "select public.rpc_iniciar_vistoria('PERIODICA', p_bem => $1) id",
        [A.bemEstacao2],
      );
      const incompleta = await s.tentar("select public.rpc_concluir_vistoria($1)", [v?.id]);
      expect(incompleta.ok).toBe(false);
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
        [
          v?.id,
          `${EMPRESA_A}/vistoria/${v?.id}/${randomUUID()}.jpg`,
          "c".repeat(64),
          perguntas[0]?.id,
        ],
      );
      await s.query("select public.rpc_concluir_vistoria($1)", [v?.id]);
      const [r] = await s.query<{ status: string }>(
        "select status from public.vistorias where id = $1",
        [v?.id],
      );
      expect(r?.status).toBe("CONCLUIDA");
    });
  });

  it("linha do tempo reúne recebimento, movimentações, vistorias e ocorrências, mais recente primeiro", async () => {
    await comoAtor(usuario(USUARIOS.gestorA), async (s) => {
      const eventos = await s.query<{ tipo: string; em: Date }>(
        "select tipo, em from public.linha_do_tempo(p_bem => $1)",
        [A.bemEstacao1],
      );
      expect(eventos.map((e) => e.tipo)).toEqual(
        expect.arrayContaining(["RECEBIMENTO", "MOVIMENTACAO", "VISTORIA"]),
      );
      const datas = eventos.map((e) => e.em.getTime());
      expect([...datas].sort((a, b) => b - a)).toEqual(datas);
    });
  });

  it("seed respeita a invariante local/responsável = último evento confirmado", async () => {
    await comoAtor(superusuario, async (s) => {
      expect(await violacoesInvariante(s)).toEqual([]);
    });
  });
});
