import { Building2, LogOut } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { sair } from "@/features/auth/actions";
import { type Contexto } from "@/lib/auth/contexto";
import { ROTULO_PAPEL } from "@/lib/permissions/matriz";

/** Identificação da sessão: usuário, papel, empresa ativa, troca de empresa e saída. */
export function MenuUsuario({ contexto }: { contexto: Contexto }) {
  const { usuario, empresa, papel, associacoes } = contexto;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="hidden min-w-0 text-right sm:block" data-testid="sessao-usuario">
        <p className="truncate font-medium">{usuario.nome || usuario.email}</p>
        <p className="truncate text-sm text-texto-suave">
          {ROTULO_PAPEL[papel]} · <span data-testid="empresa-ativa">{empresa.nome}</span>
        </p>
      </div>
      {associacoes.length > 1 ? (
        <Button asChild variante="fantasma" tamanho="icone" title="Trocar empresa">
          <Link href="/selecionar-empresa" aria-label="Trocar empresa">
            <Building2 aria-hidden />
          </Link>
        </Button>
      ) : null}
      <form action={sair}>
        <Button type="submit" variante="fantasma" tamanho="icone" aria-label="Sair" title="Sair">
          <LogOut aria-hidden />
        </Button>
      </form>
    </div>
  );
}
