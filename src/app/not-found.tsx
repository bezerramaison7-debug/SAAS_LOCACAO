import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Também usado quando o registro não existe OU o usuário não tem acesso (indistinguíveis). */
export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto max-w-xl p-4 pt-16">
      <EmptyState
        icone={SearchX}
        titulo="Página não encontrada"
        descricao="O endereço não existe ou você não tem acesso a este registro."
        acao={
          <Link href="/dashboard" className={buttonVariants({ variante: "primaria" })}>
            Ir para o painel
          </Link>
        }
      />
    </main>
  );
}
