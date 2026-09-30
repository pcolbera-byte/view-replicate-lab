import { createFileRoute } from "@tanstack/react-router";
import { SinistrosPage } from "@/features/sinistros/sinistros-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/sinistros")({
  head: () => pageHead("Sinistros", "Acompanhamento de sinistros."),
  component: SinistrosPage,
});
