/** Telas públicas de autenticação: cartão centralizado, sem navegação. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main
      id="conteudo"
      className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center"
    >
      <div className="w-full max-w-md space-y-6">
        <p className="text-center text-lg font-semibold">Rastreio de Locações</p>
        <section className="rounded-lg border border-borda bg-superficie p-6 shadow-sutil">
          {children}
        </section>
      </div>
    </main>
  );
}
