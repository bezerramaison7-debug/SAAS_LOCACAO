/**
 * Matriz de autorização — fonte de verdade em código (docs/permissions.md).
 *
 * Espelho no banco: `privado.papel_permissoes` (migration 002). Um teste de
 * integração falha se as duas divergirem. A MESMA permissão é verificada na
 * interface (`temPermissao`), no servidor (Fase 3: `exigirPermissao`) e no
 * banco (`privado.usuario_tem_permissao` em policies e funções).
 *
 * Escopos restritos (ex.: RESPONSAVEL_LOCAL só sobre itens sob sua
 * responsabilidade) são verificados pelas funções de domínio, não aqui.
 */

export const PAPEIS = [
  "ADMIN",
  "COMPRAS",
  "OPERACAO",
  "RESPONSAVEL_LOCAL",
  "FINANCEIRO",
  "GESTOR",
  "AUDITOR",
] as const;
export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  ADMIN: "Administrador",
  COMPRAS: "Compras",
  OPERACAO: "Operação",
  RESPONSAVEL_LOCAL: "Responsável local",
  FINANCEIRO: "Financeiro",
  GESTOR: "Gestor",
  AUDITOR: "Auditor",
};

const TODOS_EXCETO_RL = [
  "ADMIN",
  "COMPRAS",
  "OPERACAO",
  "FINANCEIRO",
  "GESTOR",
  "AUDITOR",
] as const;

export const MATRIZ = {
  // leitura
  "dados.ler_geral": TODOS_EXCETO_RL,
  "valores.ver": TODOS_EXCETO_RL,
  "auditoria.ler": ["ADMIN", "GESTOR", "AUDITOR"],
  // empresa / usuários
  "empresa.configurar": ["ADMIN"],
  "usuarios.gerenciar": ["ADMIN"],
  // cadastros
  "fornecedor.gerenciar": ["ADMIN", "COMPRAS"],
  "local.gerenciar": ["ADMIN", "COMPRAS", "OPERACAO"],
  "centro_custo.gerenciar": ["ADMIN", "COMPRAS", "FINANCEIRO"],
  "categoria.gerenciar": ["ADMIN", "COMPRAS"],
  "checklist.gerenciar": ["ADMIN", "OPERACAO"],
  // locação
  "locacao.criar": ["ADMIN", "COMPRAS"],
  "locacao.editar": ["ADMIN", "COMPRAS"],
  "locacao.referencia.gerenciar": ["ADMIN", "COMPRAS"],
  "locacao.ativar": ["ADMIN", "COMPRAS"],
  "locacao.cancelar": ["ADMIN", "COMPRAS"],
  "locacao.iniciar_desmobilizacao": ["ADMIN", "OPERACAO"],
  "locacao.encerrar_operacional": ["ADMIN", "OPERACAO"],
  "locacao.encerrar_financeiro": ["ADMIN", "FINANCEIRO"],
  // recebimento
  "recebimento.registrar": ["ADMIN", "OPERACAO"],
  "recebimento.autorizar_excesso": ["ADMIN", "COMPRAS"],
  "recebimento.cancelar_confirmado": ["ADMIN"],
  // vistoria / movimentação
  "vistoria.registrar": ["ADMIN", "OPERACAO"],
  "movimentacao.registrar": ["ADMIN", "OPERACAO"],
  "movimentacao.aceitar": [
    "ADMIN",
    "COMPRAS",
    "OPERACAO",
    "RESPONSAVEL_LOCAL",
    "FINANCEIRO",
    "GESTOR",
  ],
  // ocorrência / troca
  "ocorrencia.registrar": ["ADMIN", "COMPRAS", "OPERACAO", "RESPONSAVEL_LOCAL", "FINANCEIRO"],
  "ocorrencia.tratar": ["ADMIN", "OPERACAO"],
  "troca.registrar": ["ADMIN", "OPERACAO"],
  // devolução
  "devolucao.gerenciar": ["ADMIN", "OPERACAO"],
  "devolucao.ciencia_financeira": ["ADMIN", "FINANCEIRO"],
  // cobrança
  "cobranca.gerenciar": ["ADMIN", "FINANCEIRO"],
  "cobranca.ver_estimativa": ["ADMIN", "COMPRAS", "FINANCEIRO", "GESTOR", "AUDITOR"],
  // evidências
  "evidencia.enviar": ["ADMIN", "COMPRAS", "OPERACAO", "RESPONSAVEL_LOCAL", "FINANCEIRO"],
  "evidencia.substituir_remover": ["ADMIN", "OPERACAO"],
  // relatórios
  "relatorio.gerar": ["ADMIN", "COMPRAS", "OPERACAO", "FINANCEIRO", "GESTOR", "AUDITOR"],
} as const satisfies Record<string, readonly Papel[]>;

export type Permissao = keyof typeof MATRIZ;

export const PERMISSOES = Object.keys(MATRIZ) as Permissao[];

export function temPermissao(papel: Papel, permissao: Permissao): boolean {
  return (MATRIZ[permissao] as readonly Papel[]).includes(papel);
}

export function permissoesDoPapel(papel: Papel): Permissao[] {
  return PERMISSOES.filter((p) => temPermissao(papel, p));
}

/** Pares (papel, permissão), no mesmo formato de `privado.papel_permissoes`. */
export function paresPapelPermissao(): { papel: Papel; permissao: Permissao }[] {
  return PERMISSOES.flatMap((permissao) =>
    (MATRIZ[permissao] as readonly Papel[]).map((papel) => ({ papel, permissao })),
  );
}

/** Permissões que alteram dados (AUDITOR não pode ter nenhuma). */
export const PERMISSOES_LEITURA: readonly Permissao[] = [
  "dados.ler_geral",
  "valores.ver",
  "auditoria.ler",
  "cobranca.ver_estimativa",
  "relatorio.gerar",
];
