import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { FormLogin } from "@/features/auth/components/form-login";
import { destinoSeguro } from "@/lib/auth/redirecionamento";
import { getUsuarioAutenticado } from "@/lib/auth/sessao";

export const metadata: Metadata = { title: "Entrar" };

const AVISOS: Record<string, { tom: "info" | "perigo"; titulo: string }> = {
  saiu: { tom: "info", titulo: "Você saiu do sistema." },
  link: { tom: "perigo", titulo: "Link inválido ou expirado. Solicite um novo." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? destinoSeguro(params.next) : undefined;
  if (await getUsuarioAutenticado()) redirect(next ?? "/dashboard");
  const aviso = params.saiu ? AVISOS.saiu : params.erro === "link" ? AVISOS.link : undefined;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      {aviso ? <Alert tom={aviso.tom} titulo={aviso.titulo} /> : null}
      <FormLogin next={next} />
    </div>
  );
}
