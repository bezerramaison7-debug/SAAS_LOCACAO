import { ShieldOff } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { sair } from "@/features/auth/actions";
import { getEstadoAcesso } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Sem acesso" };

/** Usuário autenticado sem associação ativa a nenhuma empresa (ou desativado). */
export default async function SemAcessoPage() {
  const acesso = await getEstadoAcesso();
  if (acesso.estado === "anonimo") redirect("/login");
  if (acesso.estado === "ok") redirect("/dashboard");
  if (acesso.estado === "escolher_empresa") redirect("/selecionar-empresa");
  return (
    <main id="conteudo" className="mx-auto max-w-xl p-4 pt-16">
      <EmptyState
        icone={ShieldOff}
        titulo="Sem acesso a nenhuma empresa"
        descricao={
          <>
            A conta <strong>{acesso.usuario.email}</strong> não possui associação ativa. Procure o
            administrador da sua empresa.
          </>
        }
        acao={
          <form action={sair}>
            <Button type="submit" variante="primaria">
              Sair
            </Button>
          </form>
        }
      />
    </main>
  );
}
