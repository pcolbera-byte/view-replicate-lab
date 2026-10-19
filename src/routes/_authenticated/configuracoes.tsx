import { createFileRoute } from "@tanstack/react-router";
import { ConfiguracoesPage, type SettingsTab } from "@/features/configuracoes/configuracoes-page";
import { pageHead } from "@/lib/seo";

const TABS: SettingsTab[] = [
  "empresa",
  "usuarios",
  "produtores",
  "mensagens",
  "seguradoras",
  "preferencias",
  "conta",
  "assinatura",
  "importar",
  "demo",
];

export const Route = createFileRoute("/_authenticated/configuracoes")({
  validateSearch: (s: Record<string, unknown>): { aba?: SettingsTab | undefined } =>
    TABS.includes(s["aba"] as SettingsTab) ? { aba: s["aba"] as SettingsTab } : {},
  head: () => pageHead("Configurações"),
  component: function ConfigRoute() {
    const { aba } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <ConfiguracoesPage
        tab={aba ?? "empresa"}
        onTab={(t) => navigate({ search: { aba: t }, replace: true })}
      />
    );
  },
});
