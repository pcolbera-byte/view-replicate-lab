import { createFileRoute } from "@tanstack/react-router";
import { ClienteFicha } from "@/features/clientes/cliente-ficha";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => pageHead("Ficha do cliente"),
  component: function ClienteRoute() {
    const { id } = Route.useParams();
    return <ClienteFicha key={id} id={id} />;
  },
});
