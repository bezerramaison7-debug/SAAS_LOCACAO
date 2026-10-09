import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { escolherEmpresa } from "@/features/auth/actions";
import { getEstadoAcesso } from "@/lib/auth/contexto";
import { ROTULO_PAPEL } from "@/lib/permissions/matriz";

export const metadata: Metadata = { title: "Selecionar empresa" };

export default async function SelecionarEmpresaPage({
  searchParams,
}: PageProps<"/selecionar-empresa">) {
  const acesso = await getEstadoAcesso();
  if (acesso.estado === "anonimo") redirect("/login");
  if (acesso.estado === "sem_empresa") redirect("/sem-acesso");
  const associacoes = acesso.estado === "ok" ? acesso.contexto.associacoes : acesso.associacoes;
  const atual = acesso.estado === "ok" ? acesso.contexto.empresa.id : undefined;
  const erro = (await searchParams).erro;
  return (
    <main id="conteudo" className="mx-auto max-w-xl space-y-4 p-4 pt-12">
      <h1 className="text-2xl font-semibold">Selecione a empresa</h1>
      {erro ? (
        <Alert tom="perigo" titulo="Empresa inválida. Escolha uma das opções abaixo." />
      ) : null}
      <ul className="space-y-3">
        {associacoes.map((a) => (
          <li key={a.empresaId}>
            <form action={escolherEmpresa}>
              <input type="hidden" name="empresaId" value={a.empresaId} />
              <Button
                type="submit"
                variante={a.empresaId === atual ? "primaria" : "secundaria"}
                className="h-auto w-full justify-between py-3 text-left"
              >
                <span className="whitespace-normal">{a.empresaNome}</span>
                <span className="text-sm opacity-80">{ROTULO_PAPEL[a.papel]}</span>
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
