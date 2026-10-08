// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Package } from "lucide-react";
import { describe, expect, it } from "vitest";

import { FormField } from "@/components/forms/form-field";
import { DataTable } from "@/components/tables/data-table";

import { Alert } from "./alert";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Input } from "./input";

describe("Button", () => {
  it("é type=button por padrão (não submete formulário sem querer)", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("type", "button");
  });

  it("garante alvo de toque mínimo de 44px", () => {
    render(<Button variante="primaria">Ok</Button>);
    expect(screen.getByRole("button").className).toMatch(/min-h-11/);
    expect(screen.getByRole("button").className).toMatch(/min-w-11/);
  });

  it("asChild renderiza o elemento filho com o estilo", () => {
    render(
      <Button asChild variante="primaria">
        <a href="#conteudo">Locações</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Locações" });
    expect(link.getAttribute("type")).toBeNull();
    expect(link.className).toMatch(/bg-primaria/);
  });
});

describe("FormField", () => {
  it("liga rótulo, descrição e erro ao campo", () => {
    render(
      <FormField
        nome="codigo"
        rotulo="Código"
        descricao="Ex.: OBRA-01"
        erro="Já existe"
        obrigatorio
      >
        {(attrs) => <Input {...attrs} />}
      </FormField>,
    );
    const campo = screen.getByLabelText(/Código/);
    expect(campo.getAttribute("name")).toBe("codigo");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(campo.hasAttribute("required")).toBe(true);
    const descritoPor = campo.getAttribute("aria-describedby")?.split(" ") ?? [];
    const textos = descritoPor.map((id) => document.getElementById(id)?.textContent);
    expect(textos).toEqual(["Ex.: OBRA-01", "Já existe"]);
  });

  it("sem erro não marca aria-invalid", () => {
    render(
      <FormField nome="nome" rotulo="Nome">
        {(attrs) => <Input {...attrs} />}
      </FormField>,
    );
    expect(screen.getByLabelText("Nome").hasAttribute("aria-invalid")).toBe(false);
  });
});

describe("Alert", () => {
  it("erros são anunciados com role=alert; demais com role=status", () => {
    const { rerender } = render(<Alert tom="perigo" titulo="Falhou" />);
    expect(screen.getByRole("alert").textContent).toContain("Falhou");
    rerender(<Alert tom="sucesso" titulo="Salvo" />);
    expect(screen.getByRole("status").textContent).toContain("Salvo");
  });
});

describe("DataTable", () => {
  type Linha = { id: string; codigo: string; status: string };
  const colunas = [
    { chave: "codigo", titulo: "Código", principal: true, render: (l: Linha) => l.codigo },
    { chave: "status", titulo: "Status", render: (l: Linha) => l.status },
  ];

  it("renderiza tabela (desktop) e cartões (celular) com os mesmos dados", () => {
    render(
      <DataTable
        legenda="Locações"
        colunas={colunas}
        linhas={[{ id: "1", codigo: "LOC-000001", status: "ATIVA" }]}
        chaveLinha={(l) => l.id}
        vazio={<p>vazio</p>}
      />,
    );
    expect(screen.getByRole("table").querySelector("caption")?.textContent).toBe("Locações");
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Código",
      "Status",
    ]);
    const cartoes = screen.getByRole("list", { name: "Locações" });
    expect(cartoes.textContent).toContain("LOC-000001");
    expect(cartoes.textContent).toContain("ATIVA");
  });

  it("mostra o estado vazio quando não há linhas", () => {
    render(
      <DataTable
        legenda="Bens"
        colunas={colunas}
        linhas={[]}
        chaveLinha={(l) => l.id}
        vazio={<EmptyState icone={Package} titulo="Nenhum bem" descricao="Receba itens." />}
      />,
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("heading", { name: "Nenhum bem" })).toBeTruthy();
  });
});
