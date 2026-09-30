import { createFileRoute } from "@tanstack/react-router";
import { ClientesPage } from "@/features/clientes/clientes-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => pageHead("Clientes", "Carteira de clientes PF e PJ."),
  component: ClientesPage,
});
