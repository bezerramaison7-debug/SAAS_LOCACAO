import { ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { FormEmpresa } from "@/features/empresa/components/form-empresa";
import { FormPerfil } from "@/features/empresa/components/form-perfil";
import { obterConfiguracaoEmpresa, obterTelefone } from "@/features/empresa/queries";
import { pode } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";

export const metadata: Metadata = { title: "Configurações" };

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-md border border-borda bg-superficie p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

export default async function ConfiguracoesPage() {
  const contexto = await exigirContexto();
  const [telefone, empresa] = await Promise.all([
    obterTelefone(contexto),
    pode(contexto, "empresa.configurar")
      ? obterConfiguracaoEmpresa(contexto)
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        titulo="Configurações"
        descricao="Seu perfil e, conforme seu papel, a empresa e os usuários."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Secao titulo="Meu perfil">
          <FormPerfil
            nome={contexto.usuario.nome}
            telefone={telefone}
            email={contexto.usuario.email}
          />
        </Secao>
        {empresa ? (
          <Secao titulo="Empresa">
            <FormEmpresa atual={empresa} />
          </Secao>
        ) : null}
        {pode(contexto, "usuarios.gerenciar") ? (
          <Link
            href="/configuracoes/usuarios"
            className="flex min-h-16 items-center justify-between gap-3 rounded-md border border-borda bg-superficie p-4 hover:bg-superficie-2"
          >
            <span className="flex items-center gap-3">
              <Users aria-hidden className="size-6 text-primaria" />
              <span>
                <span className="block font-semibold">Usuários e papéis</span>
                <span className="block text-texto-suave">
                  Convidar, alterar papel, desativar acesso
                </span>
              </span>
            </span>
            <ChevronRight aria-hidden />
          </Link>
        ) : null}
      </div>
    </>
  );
}
