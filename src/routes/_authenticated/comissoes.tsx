import { createFileRoute } from "@tanstack/react-router";
import { ComissoesPage } from "@/features/comissoes/comissoes-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/comissoes")({
  head: () => pageHead("Comissões", "Comissões previstas, recebidas e pendentes."),
  component: ComissoesPage,
});
