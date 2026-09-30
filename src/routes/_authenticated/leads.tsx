import { createFileRoute } from "@tanstack/react-router";
import { LeadsPage } from "@/features/leads/leads-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => pageHead("Leads", "Funil de oportunidades da corretora."),
  component: LeadsPage,
});
