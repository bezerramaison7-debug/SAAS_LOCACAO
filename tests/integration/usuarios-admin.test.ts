/** Funções administrativas de usuários (Fase 3) e auditoria de autenticação. */
import { afterAll, describe, expect, it } from "vitest";

import {
  anon,
  comoAtor,
  encerrarPool,
  serviceRole,
  SQLSTATE,
  superusuario,
  usuario,
  type Sessao,
} from "../support/db";
import { EMPRESA_A, EMPRESA_B, USUARIOS } from "../support/fixtures";

afterAll(encerrarPool);

async function associacao(s: Sessao, empresa: string, user: string): Promise<string> {
  const [r] = await s.query<{ id: string }>(
    "select id from public.usuarios_empresa where empresa_id = $1 and user_id = $2",
    [empresa, user],
  );
  if (!r) throw new Error("associação inexistente");
  return r.id;
}

describe("rpc_listar_usuarios_empresa", () => {
  it("ADMIN lista usuários da própria empresa com e-mail (inclusive inativos)", async () => {
    const linhas = await comoAtor(usuario(USUARIOS.adminA), (s) =>
      s.query<{ email: string; ativo: boolean }>(
        "select * from public.rpc_listar_usuarios_empresa($1)",
        [EMPRESA_A],
      ),
    );
    const emails = linhas.map((l) => l.email);
    // Contas do seed da Empresa A (o E2E pode ter acrescentado convidados).
    for (const conta of [
      "admin.a",
      "compras.a",
      "operacao.a",
      "responsavel.a",
      "financeiro.a",
      "gestor.a",
      "auditor.a",
      "inativo.a",
      "recuperacao.a",
      "multi",
    ]) {
      expect(emails).toContain(`${conta}@demo.rastreio.test`);
    }
    expect(linhas.every((l) => l.email.endsWith("@demo.rastreio.test"))).toBe(true);
    expect(linhas.map((l) => l.email)).not.toContain("admin.b@demo.rastreio.test");
  });

  it.each([
    ["ADMIN de outra empresa", USUARIOS.adminB],
    ["GESTOR", USUARIOS.gestorA],
    ["AUDITOR", USUARIOS.auditorA],
    ["inativo", USUARIOS.inativoA],
  ])("%s não lista (42501)", async (_, ator) => {
    const r = await comoAtor(usuario(ator), (s) =>
      s.tentar("select * from public.rpc_listar_usuarios_empresa($1)", [EMPRESA_A]),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
  });

  it("anônimo não executa", async () => {
    const r = await comoAtor(anon, (s) =>
      s.tentar("select * from public.rpc_listar_usuarios_empresa($1)", [EMPRESA_A]),
    );
    expect(r.ok).toBe(false);
  });
});

describe("rpc_vincular_usuario", () => {
  it("ADMIN vincula usuário existente de outra empresa, com auditoria", async () => {
    await comoAtor(usuario(USUARIOS.adminA), async (s) => {
      const [r] = await s.query<{ id: string }>(
        "select public.rpc_vincular_usuario($1, 'OPERACAO.B@demo.rastreio.test', 'Otávio', 'GESTOR') as id",
        [EMPRESA_A],
      );
      expect(r?.id).toBeTruthy();
      await s.como(superusuario);
      const [aud] = await s.query<{ acao: string; ator_id: string }>(
        "select acao, ator_id from public.auditoria where entidade_id = $1 and acao = 'usuarios.vincular'",
        [r?.id],
      );
      expect(aud).toEqual({ acao: "usuarios.vincular", ator_id: USUARIOS.adminA });
    });
  });

  it("rejeita duplicado, inexistente e quem não é ADMIN", async () => {
    await comoAtor(usuario(USUARIOS.adminA), async (s) => {
      const dup = await s.tentar(
        "select public.rpc_vincular_usuario($1, 'compras.a@demo.rastreio.test', 'X Y', 'GESTOR')",
        [EMPRESA_A],
      );
      expect(dup.ok).toBe(false);
      if (!dup.ok) expect(dup.codigo).toBe(SQLSTATE.violacaoUnique);
      const inexistente = await s.tentar(
        "select public.rpc_vincular_usuario($1, 'ninguem@demo.rastreio.test', 'X Y', 'GESTOR')",
        [EMPRESA_A],
      );
      expect(inexistente.ok).toBe(false);
      if (!inexistente.ok) expect(inexistente.codigo).toBe("P0002");
    });
    const r = await comoAtor(usuario(USUARIOS.adminB), (s) =>
      s.tentar(
        "select public.rpc_vincular_usuario($1, 'operacao.b@demo.rastreio.test', 'X Y', 'ADMIN')",
        [EMPRESA_A],
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe(SQLSTATE.privilegioInsuficiente);
  });
});

describe("rpc_alterar_papel e rpc_definir_usuario_ativo", () => {
  it("ADMIN altera papel e desativa/reativa com motivo; tudo auditado", async () => {
    await comoAtor(usuario(USUARIOS.adminA), async (s) => {
      const id = await associacao(s, EMPRESA_A, USUARIOS.gestorA);
      await s.query("select public.rpc_alterar_papel($1, 'AUDITOR')", [id]);
      await s.query(
        "select public.rpc_definir_usuario_ativo($1, false, 'Desligado da empresa em outubro')",
        [id],
      );
      await s.query(
        "select public.rpc_definir_usuario_ativo($1, true, 'Recontratado para o projeto Sul')",
        [id],
      );
      await s.como(superusuario);
      const acoes = await s.query<{ acao: string }>(
        "select acao from public.auditoria where entidade_id = $1 and acao like 'usuarios.%' order by id",
        [id],
      );
      expect(acoes.map((a) => a.acao)).toEqual([
        "usuarios.alterar_papel",
        "usuarios.desativar",
        "usuarios.reativar",
      ]);
    });
  });

  it("usuário desativado perde o acesso imediatamente", async () => {
    await comoAtor(usuario(USUARIOS.adminA), async (s) => {
      const id = await associacao(s, EMPRESA_A, USUARIOS.comprasA);
      await s.query(
        "select public.rpc_definir_usuario_ativo($1, false, 'Teste de perda de acesso')",
        [id],
      );
      await s.como(usuario(USUARIOS.comprasA));
      const [r] = await s.query<{ n: string }>("select count(*) n from public.locacoes");
      expect(Number(r?.n)).toBe(0);
    });
  });

  it("ADMIN não desativa a si mesmo e não remove o último ADMIN", async () => {
    await comoAtor(usuario(USUARIOS.adminA), async (s) => {
      const proprio = await associacao(s, EMPRESA_A, USUARIOS.adminA);
      const r1 = await s.tentar(
        "select public.rpc_definir_usuario_ativo($1, false, 'Tentando sair sozinho')",
        [proprio],
      );
      expect(r1.ok).toBe(false);
      const r2 = await s.tentar("select public.rpc_alterar_papel($1, 'GESTOR')", [proprio]);
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.codigo).toBe(SQLSTATE.violacaoCheck);
    });
  });

  it("exige motivo e não revela associações de outra empresa", async () => {
    await comoAtor(usuario(USUARIOS.adminB), async (s) => {
      await s.como(superusuario);
      const idA = await associacao(s, EMPRESA_A, USUARIOS.comprasA);
      const idB = await associacao(s, EMPRESA_B, USUARIOS.operacaoB);
      await s.como(usuario(USUARIOS.adminB));
      const cruzado = await s.tentar("select public.rpc_alterar_papel($1, 'ADMIN')", [idA]);
      expect(cruzado.ok).toBe(false);
      if (!cruzado.ok) expect(cruzado.codigo).toBe("P0002");
      const semMotivo = await s.tentar(
        "select public.rpc_definir_usuario_ativo($1, false, 'curto')",
        [idB],
      );
      expect(semMotivo.ok).toBe(false);
      if (!semMotivo.ok) expect(semMotivo.codigo).toBe("22023");
    });
  });

  it("perfis não-ADMIN não alteram papéis", async () => {
    await comoAtor(usuario(USUARIOS.gestorA), async (s) => {
      await s.como(superusuario);
      const id = await associacao(s, EMPRESA_A, USUARIOS.comprasA);
      await s.como(usuario(USUARIOS.gestorA));
      const r = await s.tentar("select public.rpc_alterar_papel($1, 'ADMIN')", [id]);
      expect(r.ok).toBe(false);
    });
  });
});

describe("auditoria de autenticação", () => {
  const sql = `select public.registrar_evento_autenticacao('login.falha', null, $1, null, 'invalid_credentials', 'r1')`;
  const hash = "f".repeat(64);

  it("somente service_role registra", async () => {
    for (const ator of [anon, usuario(USUARIOS.adminA)]) {
      const r = await comoAtor(ator, (s) => s.tentar(sql, [hash]));
      expect(r.ok).toBe(false);
    }
    await comoAtor(serviceRole, async (s) => {
      const r = await s.tentar(sql, [hash]);
      expect(r.ok).toBe(true);
      await s.como(superusuario);
      const [ev] = await s.query<{ evento: string; email_hash: string }>(
        "select evento, email_hash from privado.auditoria_autenticacao order by id desc limit 1",
      );
      expect(ev).toEqual({ evento: "login.falha", email_hash: hash });
    });
  });

  it("rejeita e-mail em texto (somente hash) e evento desconhecido", async () => {
    await comoAtor(serviceRole, async (s) => {
      const r1 = await s.tentar(sql, ["admin.a@demo.rastreio.test"]);
      expect(r1.ok).toBe(false);
      const r2 = await s.tentar(
        "select public.registrar_evento_autenticacao('senha.vazada', null, null, null, null, null)",
      );
      expect(r2.ok).toBe(false);
    });
  });
});
