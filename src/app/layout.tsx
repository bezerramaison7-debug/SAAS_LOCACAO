import "@/styles/globals.css";

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { COOKIE_TEMA, lerTema } from "@/components/layout/preferencias";

export const metadata: Metadata = {
  title: { default: "Rastreio de Locações", template: "%s · Rastreio de Locações" },
  description: "Rastreabilidade operacional de equipamentos locados.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1217" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // O tema é decidido no servidor (cookie), evitando "piscar" sem script inline.
  const tema = lerTema((await cookies()).get(COOKIE_TEMA)?.value);
  return (
    <html lang="pt-BR" {...(tema === "sistema" ? {} : { "data-theme": tema })}>
      <body className="min-h-dvh antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-superficie focus:px-4 focus:py-3"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
