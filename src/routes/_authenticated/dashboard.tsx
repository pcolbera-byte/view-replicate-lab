import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead("Painel", "Prioridades do dia: renovações, tarefas e indicadores."),
  component: DashboardPage,
});
