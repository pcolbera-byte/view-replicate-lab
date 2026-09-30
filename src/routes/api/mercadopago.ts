import { createFileRoute } from "@tanstack/react-router";

// Notificações (webhooks) do Mercado Pago. Configure no painel do Mercado Pago:
//   URL: https://SEU-ENDERECO/api/mercadopago   Eventos: "Planos e assinaturas"
// Os dados recebidos nunca são usados diretamente: a assinatura é sempre reconsultada no
// Mercado Pago com a credencial da conta.
export const Route = createFileRoute("/api/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const body = (await request.json().catch(() => ({}))) as {
          type?: string;
          topic?: string;
          data?: { id?: string | number };
        };
        const tipo = body.type ?? body.topic ?? url.searchParams.get("type") ?? "";
        const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? "");
        if (!id) return new Response("ok", { status: 200 });
        const mp = await import("@/lib/billing/mercadopago.server");
        if (!(await mp.notificacaoValida(request, url.searchParams.get("data.id") ?? id)))
          return new Response("assinatura inválida", { status: 401 });
        const db = await import("@/lib/billing/assinatura.server");
        try {
          if (tipo === "subscription_preapproval" || tipo === "preapproval") {
            await db.salvarPreapproval(await mp.buscarPreapproval(id));
          } else if (tipo === "subscription_authorized_payment") {
            const pagamento = await mp.buscarPagamentoAutorizado(id);
            await db.registrarPagamento(pagamento);
            await db.salvarPreapproval(await mp.buscarPreapproval(pagamento.preapproval_id));
          }
        } catch (e) {
          // Notificação de teste do painel ou id que não é desta conta: nada a fazer.
          if (e instanceof Error && /\((401|403|404)\)/.test(e.message))
            return new Response("ignorado", { status: 200 });
          console.error("[webhook mercadopago]", tipo, id, e);
          // 500 faz o Mercado Pago tentar de novo mais tarde.
          return new Response("erro", { status: 500 });
        }
        return new Response("ok", { status: 200 });
      },
      GET: () => new Response("ok", { status: 200 }),
    },
  },
});
