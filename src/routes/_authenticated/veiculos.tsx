import { createFileRoute } from "@tanstack/react-router";
import { VeiculosPage } from "@/features/veiculos/veiculos-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/veiculos")({
  head: () => pageHead("Veículos", "Veículos dos clientes e situação do seguro."),
  component: VeiculosPage,
});
