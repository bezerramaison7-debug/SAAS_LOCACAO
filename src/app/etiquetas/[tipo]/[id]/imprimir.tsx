"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BotaoImprimir() {
  return (
    <Button type="button" variante="primaria" onClick={() => window.print()}>
      <Printer aria-hidden /> Imprimir etiqueta
    </Button>
  );
}
