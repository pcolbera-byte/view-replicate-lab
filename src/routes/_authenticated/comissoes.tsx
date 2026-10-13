import { createFileRoute } from "@tanstack/react-router";
import { ComissoesPage, type ComissoesAba } from "@/features/comissoes/comissoes-page";
import { pageHead } from "@/lib/seo";

const ABAS: ComissoesAba[] = ["lista", "conciliacao", "repasses"];

export const Route = createFileRoute("/_authenticated/comissoes")({
  validateSearch: (s: Record<string, unknown>): { aba?: ComissoesAba | undefined } =>
    ABAS.includes(s["aba"] as ComissoesAba) ? { aba: s["aba"] as ComissoesAba } : {},
  head: () => pageHead("Comissões", "Comissões previstas, recebidas, conciliação e repasses."),
  component: function ComissoesRoute() {
    const { aba } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <ComissoesPage
        aba={aba ?? "lista"}
        onAba={(a) => navigate({ search: a === "lista" ? {} : { aba: a }, replace: true })}
      />
    );
  },
});
