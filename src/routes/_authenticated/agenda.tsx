import { createFileRoute } from "@tanstack/react-router";
import { AgendaPage } from "@/features/agenda/agenda-page";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => pageHead("Agenda", "Follow-ups e tarefas."),
  component: AgendaPage,
});
