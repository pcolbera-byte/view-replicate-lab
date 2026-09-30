import { createFileRoute } from "@tanstack/react-router";
import { RenovacoesPage } from "@/features/renovacoes/renovacoes-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/renovacoes")({
  head: () => pageHead("Renovações", "Apólices próximas do vencimento."),
  component: RenovacoesPage,
});
