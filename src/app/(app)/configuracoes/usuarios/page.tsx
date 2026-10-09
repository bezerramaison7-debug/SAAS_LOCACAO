import { Users } from "lucide-react";
import type { Metadata } from "next";

import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { BotaoAtivo, FormPapel } from "@/features/usuarios/components/controles-usuario";
import { FormConvite } from "@/features/usuarios/components/form-convite";
import { listarUsuariosEmpresa, type UsuarioEmpresa } from "@/features/usuarios/queries";
import { exigirPermissaoPagina } from "@/lib/auth/autorizacao";
import { exigirContexto } from "@/lib/auth/contexto";
import { formatarDataHora } from "@/lib/format/datas";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const contexto = await exigirContexto();
  exigirPermissaoPagina(contexto, "usuarios.gerenciar");
  const usuarios = await listarUsuariosEmpresa(contexto);
  const fuso = contexto.empresa.timezone;

  return (
    <>
      <PageHeader
        titulo="Usuários e papéis"
        descricao={`Usuários com acesso a ${contexto.empresa.nome}. Toda alteração é registrada na auditoria.`}
      />
      <section className="mb-8 rounded-md border border-borda bg-superficie p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Convidar usuário</h2>
        <FormConvite />
      </section>
      <DataTable<UsuarioEmpresa>
        legenda="Usuários da empresa"
        linhas={usuarios}
        chaveLinha={(u) => u.associacaoId}
        vazio={
          <EmptyState
            icone={Users}
            titulo="Nenhum usuário"
            descricao="Convide o primeiro usuário acima."
          />
        }
        colunas={[
          {
            chave: "nome",
            titulo: "Usuário",
            principal: true,
            render: (u) => (
              <span className="flex flex-col">
                <span className="font-medium">{u.nome}</span>
                <span className="text-sm break-all text-texto-suave">{u.email}</span>
              </span>
            ),
          },
          {
            chave: "situacao",
            titulo: "Situação",
            render: (u) => (
              <Badge tom={u.ativo ? "sucesso" : "neutro"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
            ),
          },
          {
            chave: "acesso",
            titulo: "Último acesso",
            render: (u) =>
              u.ultimoAcesso ? formatarDataHora(u.ultimoAcesso, fuso) : "Nunca acessou",
          },
          {
            chave: "papel",
            titulo: "Papel",
            render: (u) => (
              <FormPapel associacaoId={u.associacaoId} nome={u.nome} papel={u.papel} />
            ),
          },
          {
            chave: "acoes",
            titulo: "Acesso",
            render: (u) => (
              <BotaoAtivo
                associacaoId={u.associacaoId}
                nome={u.nome}
                ativo={u.ativo}
                proprio={u.userId === contexto.usuario.id}
              />
            ),
          },
        ]}
      />
    </>
  );
}
