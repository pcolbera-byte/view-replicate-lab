import { createFileRoute } from "@tanstack/react-router";
import { DonoPage } from "@/features/dono/dono-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/dono")({
  head: () => pageHead("Painel do dono"),
  component: DonoPage,
});
