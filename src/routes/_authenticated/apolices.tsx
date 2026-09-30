import { createFileRoute } from "@tanstack/react-router";
import { ApolicesPage } from "@/features/apolices/apolices-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/apolices")({
  head: () => pageHead("Apólices", "Apólices, vigências, parcelas e prêmios."),
  component: ApolicesPage,
});
