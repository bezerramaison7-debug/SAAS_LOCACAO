import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormRedefinir } from "@/features/auth/components/form-redefinir";
import { getUsuarioAutenticado } from "@/lib/auth/sessao";

export const metadata: Metadata = { title: "Definir nova senha" };

/** Acessível apenas com a sessão criada pelo link de recuperação/convite. */
export default async function RedefinirSenhaPage({
  searchParams,
}: PageProps<"/recuperar-senha/redefinir">) {
  const usuario = await getUsuarioAutenticado();
  if (!usuario) redirect("/login?erro=link");
  const convite = (await searchParams).convite === "1";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {convite ? "Crie sua senha" : "Definir nova senha"}
      </h1>
      <p className="text-texto-suave">
        Conta: <strong className="text-texto">{usuario.email}</strong>
      </p>
      <FormRedefinir />
    </div>
  );
}
