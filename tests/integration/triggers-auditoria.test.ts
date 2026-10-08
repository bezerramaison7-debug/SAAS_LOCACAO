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

const REQUEST_ID = "3cd7a1e2-5b4f-4c3d-9a8b-1234567890ab";

async function esperarErro(s: Sessao, sql: string, params: unknown[], codigo: string) {
  const r = await s.tentar(sql, params);
  expect(r.ok, sql).toBe(false);
  if (!r.ok) expect(r.codigo, r.mensagem).toBe(codigo);
}

describe("guarda de transição de estado (vale até para o superusuário)", () => {
  it.each([
    ["locacoes", "status", "ENCERRADA_OPERACIONALMENTE", A.locacaoRascunho],
    ["locacoes", "status_financeiro", "ENCERRADO", A.locacaoAtiva],
    ["bens", "status", "DEVOLVIDO", A.bemEstacao1],
    ["devolucoes", "status", "RETIRADA_CONFIRMADA", A.devolucao],
    ["ocorrencias", "status", "ABERTA", A.ocorrenciaBem2],
  ])("%s.%s → %s fora da tabela é rejeitado", async (tabela, coluna, para, id) => {
    await comoAtor(superusuario, async (s) => {
      const r = await s.tentar(`update public.${tabela} set ${coluna} = $1 where id = $2`, [
        para,
        id,
      ]);
      if (para === "ABERTA") {
        expect(r.ok).toBe(true); // mesmo estado: no-op permitido
        return;
      }
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.codigo).toBe(SQLSTATE.violacaoCheck);
        expect(r.mensagem).toMatch(/Transição de estado não permitida/);
      }
    });
  });

  it("transição permitida passa (RASCUNHO → CANCELADA com dados completos)", async () => {
    await comoAtor(superusuario, async (s) => {
      const r = await s.tentar(
        `update public.locacoes set status = 'CANCELADA', cancelada_em = now(),
           motivo_cancelamento = 'Pedido cancelado no Sectra' where id = $1`,
        [A.locacaoRascunho],
      );
      expect(r.ok).toBe(true);
    });
  });
});

describe("códigos legíveis e autoria", () => {
  it("códigos sequenciais por empresa e imutáveis", async () => {
    await comoAtor(usuario(USUARIOS.comprasA), async (s) => {
      const [a] = await s.query<{ codigo: string }>(
        "insert into public.locacoes (empresa_id) values ($1) returning codigo",
        [EMPRESA_A],
      );
      const [b] = await s.query<{ codigo: string }>(
        "insert into public.locacoes (empresa_id) values ($1) returning codigo",
        [EMPRESA_A],
      );
      const n = (c?: string) => Number(c?.slice(4));
      expect(n(b?.codigo)).toBe(n(a?.codigo) + 1);
    });
    await comoAtor(superusuario, (s) =>
      esperarErro(
        s,
        "update public.locacoes set codigo = 'LOC-999999' where id = $1",
        [A.locacaoAtiva],
        SQLSTATE.privilegioInsuficiente,
      ),
    );
  });

  it("created_by/updated_by vêm do JWT e empresa_id é imutável", async () => {
    await comoAtor(usuario(USUARIOS.comprasA), async (s) => {
      const [l] = await s.query<{ updated_by: string; created_by: string }>(
        "update public.locacoes set observacoes = 'editada' where id = $1 returning created_by, updated_by",
        [A.locacaoRascunho],
      );
      expect(l?.updated_by).toBe(USUARIOS.comprasA);
      expect(l?.created_by).not.toBe(USUARIOS.comprasA);
    });
    await comoAtor(superusuario, (s) =>
      esperarErro(
        s,
        "update public.fornecedores set empresa_id = 'b0000000-0000-4000-8000-000000000001' where id = $1",
        [A.fornecedor1],
        SQLSTATE.privilegioInsuficiente,
      ),
    );
  });
});

describe("auditoria", () => {
  it("grava ator, empresa, ação, antes/depois e request_id na mesma transação", async () => {
    await comoAtor(
      usuario(USUARIOS.comprasA),
      async (s) => {
        await s.query("update public.locacoes set observacoes = 'nova observação' where id = $1", [
          A.locacaoRascunho,
        ]);
        await s.como(superusuario);
        const [reg] = await s.query<{
          empresa_id: string;
          ator_id: string;
          acao: string;
          request_id: string;
          antes: string;
          depois: string;
        }>(
          `select empresa_id, ator_id, acao, request_id,
                  dados_anteriores->>'observacoes' as antes, dados_novos->>'observacoes' as depois
           from public.auditoria where entidade_id = $1 order by id desc limit 1`,
          [A.locacaoRascunho],
        );
        expect(reg).toMatchObject({
          empresa_id: EMPRESA_A,
          ator_id: USUARIOS.comprasA,
          acao: "locacoes.update",
          request_id: REQUEST_ID,
          antes: "[DEMONSTRAÇÃO] Locação em rascunho",
          depois: "nova observação",
        });
      },
      REQUEST_ID,
    );
  });

  it("rollback da operação descarta a auditoria junto (mesma transação)", async () => {
    let antes = 0;
    await comoAtor(superusuario, async (s) => {
      const [r] = await s.query<{ n: string }>("select count(*) n from public.auditoria");
      antes = Number(r?.n);
    });
    await comoAtor(usuario(USUARIOS.comprasA), (s) =>
      s.query("update public.locacoes set observacoes = 'será desfeito' where id = $1", [
        A.locacaoRascunho,
      ]),
    );
    await comoAtor(superusuario, async (s) => {
      const [r] = await s.query<{ n: string }>("select count(*) n from public.auditoria");
      expect(Number(r?.n)).toBe(antes);
    });
  });

  it("auditoria é append-only: nem o superusuário altera ou apaga", async () => {
    await comoAtor(superusuario, async (s) => {
      await esperarErro(
        s,
        "update public.auditoria set acao = 'x.y'",
        [],
        SQLSTATE.privilegioInsuficiente,
      );
      await esperarErro(s, "delete from public.auditoria", [], SQLSTATE.privilegioInsuficiente);
    });
  });

  it("nunca registra campos com nome de segredo", async () => {
    await comoAtor(superusuario, async (s) => {
      const [r] = await s.query<{ limpo: Record<string, unknown> }>(
        `select privado.sanitizar_auditoria('{"nome":"a","senha":"x","access_token":"t","api_key":"k","service_role":"s"}') as limpo`,
      );
      expect(r?.limpo).toEqual({ nome: "a" });
      const suspeitos = await s.query(
        `select id from public.auditoria
         where coalesce(dados_novos, '{}') ?| array['senha', 'password', 'token', 'encrypted_password']`,
      );
      expect(suspeitos).toEqual([]);
    });
  });

  it("usuário sem auditoria.ler não lê a auditoria", async () => {
    await comoAtor(usuario(USUARIOS.operacaoA), async (s) => {
      const [r] = await s.query<{ n: string }>("select count(*) n from public.auditoria");
      expect(Number(r?.n)).toBe(0);
    });
  });
});

describe("imutabilidade de registros finalizados", () => {
  it("movimentação confirmada não muda", async () => {
    await comoAtor(superusuario, (s) =>
      esperarErro(
        s,
        "update public.movimentacoes set motivo = 'reescrita' where id = $1",
        [A.movimentacaoBem1],
        SQLSTATE.privilegioInsuficiente,
      ),
    );
  });

  it("vistoria concluída e suas respostas não mudam", async () => {
    await comoAtor(superusuario, async (s) => {
      await esperarErro(
        s,
        "update public.vistorias set observacao = 'x' where id = $1",
        [A.vistoriaBem1],
        SQLSTATE.privilegioInsuficiente,
      );
      await esperarErro(
        s,
        "update public.respostas_vistoria set resposta_json = '\"NAO_CONFORME\"' where vistoria_id = $1",
        [A.vistoriaBem1],
        SQLSTATE.privilegioInsuficiente,
      );
    });
  });

  it("checklist publicado: perguntas e conteúdo imutáveis; só pode ser arquivado", async () => {
    await comoAtor(superusuario, async (s) => {
      await esperarErro(
        s,
        "update public.perguntas_checklist set texto = 'Outra pergunta' where id = $1",
        [A.pergunta1],
        SQLSTATE.privilegioInsuficiente,
      );
      await esperarErro(
        s,
        `insert into public.perguntas_checklist (empresa_id, modelo_id, ordem, texto, tipo_resposta)
         values ($1, $2, 99, 'Nova pergunta', 'TEXTO')`,
        [EMPRESA_A, A.modelo],
        SQLSTATE.privilegioInsuficiente,
      );
      await esperarErro(
        s,
        "update public.modelos_checklist set nome = 'Renomeado' where id = $1",
        [A.modelo],
        SQLSTATE.privilegioInsuficiente,
      );
      const r = await s.tentar(
        "update public.modelos_checklist set status = 'ARQUIVADO' where id = $1",
        [A.modelo],
      );
      expect(r.ok).toBe(true);
    });
  });

  it("vistoria exige modelo publicado", async () => {
    await comoAtor(superusuario, async (s) => {
      const [m] = await s.query<{ id: string }>(
        "insert into public.modelos_checklist (empresa_id, nome) values ($1, 'Rascunho') returning id",
        [EMPRESA_A],
      );
      await esperarErro(
        s,
        `insert into public.vistorias (empresa_id, tipo, modelo_id, bem_id, data_evento, realizada_por)
         values ($1, 'PERIODICA', $2, $3, now(), $4)`,
        [EMPRESA_A, m?.id, A.bemEstacao1, USUARIOS.operacaoA],
        SQLSTATE.violacaoCheck,
      );
    });
  });

  it("evidência: conteúdo (hash, caminho, tamanho) nunca muda", async () => {
    await comoAtor(superusuario, async (s) => {
      const caminho = `${EMPRESA_A}/bem/${A.bemEstacao1}/3cd7a1e2-5b4f-4c3d-9a8b-1234567890ab.jpg`;
      const [e] = await s.query<{ id: string }>(
        `insert into public.evidencias (empresa_id, entidade_tipo, entidade_id, tipo, bucket, storage_path,
           mime_type, tamanho_bytes, hash_arquivo, enviada_por)
         values ($1, 'BEM', $2, 'FOTO', 'evidencias', $3, 'image/jpeg', 10, $4, $5) returning id`,
        [EMPRESA_A, A.bemEstacao1, caminho, "b".repeat(64), USUARIOS.operacaoA],
      );
      await esperarErro(
        s,
        "update public.evidencias set hash_arquivo = $2 where id = $1",
        [e?.id, "c".repeat(64)],
        SQLSTATE.privilegioInsuficiente,
      );
      const r = await s.tentar(
        `update public.evidencias set status = 'REMOVIDA', removida_em = now(),
           motivo_remocao = 'Foto de outro equipamento' where id = $1`,
        [e?.id],
      );
      expect(r.ok).toBe(true);
    });
  });
});

describe("associação e último ADMIN", () => {
  it("não permite desativar ou rebaixar o último ADMIN ativo", async () => {
    await comoAtor(superusuario, async (s) => {
      await esperarErro(
        s,
        "update public.usuarios_empresa set ativo = false where user_id = $1 and empresa_id = $2",
        [USUARIOS.adminA, EMPRESA_A],
        SQLSTATE.violacaoCheck,
      );
      await esperarErro(
        s,
        "update public.usuarios_empresa set papel = 'GESTOR' where user_id = $1 and empresa_id = $2",
        [USUARIOS.adminA, EMPRESA_A],
        SQLSTATE.violacaoCheck,
      );
    });
  });

  it("permite rebaixar um ADMIN quando há outro ADMIN ativo", async () => {
    await comoAtor(superusuario, async (s) => {
      await s.query("update public.usuarios_empresa set papel = 'ADMIN' where user_id = $1", [
        USUARIOS.gestorA,
      ]);
      const r = await s.tentar(
        "update public.usuarios_empresa set papel = 'GESTOR' where user_id = $1 and empresa_id = $2",
        [USUARIOS.adminA, EMPRESA_A],
      );
      expect(r.ok).toBe(true);
    });
  });
});
