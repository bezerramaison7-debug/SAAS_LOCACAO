/**
 * Máquina de estado declarativa. O banco é a autoridade (trigger
 * `privado.guardar_transicao` + tabela `privado.transicoes`); esta cópia
 * serve à interface e às regras puras. Um teste de paridade compara as duas.
 */
export type MaquinaEstado<E extends string> = {
  readonly nome: string;
  readonly estados: readonly E[];
  readonly inicial: E;
  readonly transicoes: Readonly<Record<E, readonly E[]>>;
};

export function definirMaquina<const E extends string>(
  maquina: MaquinaEstado<E>,
): MaquinaEstado<E> {
  for (const [de, destinos] of Object.entries(maquina.transicoes) as [E, readonly E[]][]) {
    if (!maquina.estados.includes(de))
      throw new Error(`${maquina.nome}: estado desconhecido ${de}`);
    for (const para of destinos) {
      if (!maquina.estados.includes(para)) {
        throw new Error(`${maquina.nome}: destino desconhecido ${de} → ${para}`);
      }
      if (para === de) throw new Error(`${maquina.nome}: auto-transição ${de}`);
    }
  }
  return maquina;
}

export function podeTransitar<E extends string>(
  maquina: MaquinaEstado<E>,
  de: E,
  para: E,
): boolean {
  return maquina.transicoes[de].includes(para);
}

export function destinosPossiveis<E extends string>(
  maquina: MaquinaEstado<E>,
  de: E,
): readonly E[] {
  return maquina.transicoes[de];
}

export function ehFinal<E extends string>(maquina: MaquinaEstado<E>, estado: E): boolean {
  return maquina.transicoes[estado].length === 0;
}

export class TransicaoInvalidaError extends Error {
  constructor(maquina: string, de: string, para: string) {
    super(`Transição de estado não permitida (${maquina}): ${de} → ${para}`);
    this.name = "TransicaoInvalidaError";
  }
}

/** Lança `TransicaoInvalidaError` se a transição não for permitida. */
export function exigirTransicao<E extends string>(maquina: MaquinaEstado<E>, de: E, para: E): void {
  if (!podeTransitar(maquina, de, para)) throw new TransicaoInvalidaError(maquina.nome, de, para);
}

/** Lista plana (maquina, de, para), no mesmo formato da tabela do banco. */
export function listarTransicoes<E extends string>(
  maquina: MaquinaEstado<E>,
): { maquina: string; de: E; para: E }[] {
  return (Object.entries(maquina.transicoes) as [E, readonly E[]][]).flatMap(([de, destinos]) =>
    destinos.map((para) => ({ maquina: maquina.nome, de, para })),
  );
}
