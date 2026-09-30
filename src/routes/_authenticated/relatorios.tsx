import { createFileRoute } from "@tanstack/react-router";
import { RelatoriosPage } from "@/features/relatorios/relatorios-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => pageHead("Relatórios", "Indicadores da carteira e da operação."),
  component: RelatoriosPage,
});
