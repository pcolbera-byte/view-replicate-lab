import { useMemo, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import { Card, CardHeader, PageHeader } from "@/components/shared/ui";
import { LEAD_ORIGINS, isActivePolicy, isOpenRenewal } from "@/lib/domain";
import { daysUntil, money } from "@/lib/format";
import { SEM_PRODUTOR, participacao } from "@/features/produtores/produtores";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function RelatoriosPage() {
  const { ws, alertDays, get } = useWorkspace();
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth() - 11, 1)));
  const [to, setTo] = useState(iso(now));
  const inRange = (d?: string | null) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;

  const r = useMemo(() => {
    const leads = ws.leads.filter((l) => inRange(l.data_entrada));
    const sold = leads.filter((l) => l.status === "Vendido").length;
    const lost = leads.filter((l) => l.status === "Perdido");
    const newPolicies = ws.apolices.filter((a) => inRange(a.inicio));
    const renewalsDone = newPolicies.filter((a) => a.apolice_anterior_id);
    const dueInPeriod = ws.apolices.filter(
      (a) => inRange(a.vencimento) && daysUntil(a.vencimento) <= 0,
    );
    const notRenewed = ws.apolices.filter(
      (a) => inRange(a.vencimento) && a.renovacao_status === "Não renovada",
    );
    const com = ws.comissoes.filter((c) => inRange(c.data_prevista) && c.status !== "Cancelada");
    const byInsurer = new Map<string, { n: number; premio: number }>();
    for (const a of newPolicies) {
      const e = byInsurer.get(a.seguradora) ?? { n: 0, premio: 0 };
      e.n++;
      e.premio += Number(a.premio);
      byInsurer.set(a.seguradora, e);
    }
    const lostReasons = new Map<string, number>();
    for (const l of lost) {
      const k = (l.motivo_perda || "Sem motivo informado").trim();
      lostReasons.set(k, (lostReasons.get(k) ?? 0) + 1);
    }
    return {
      leads,
      sold,
      lost: lost.length,
      conversion: leads.length ? Math.round((sold / leads.length) * 100) : 0,
      origins: LEAD_ORIGINS.map((o) => ({
        label: o,
        value: leads.filter((l) => l.origem === o).length,
        sold: leads.filter((l) => l.origem === o && l.status === "Vendido").length,
      })).filter((o) => o.value),
      lostReasons: [...lostReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      newPolicies: newPolicies.length - renewalsDone.length,
      renewalsDone: renewalsDone.length,
      premios: newPolicies.reduce((s, a) => s + Number(a.premio), 0),
      dueInPeriod: dueInPeriod.length,
      notRenewed: notRenewed.length,
      renewalRate: dueInPeriod.length
        ? Math.round(
            (dueInPeriod.filter((a) => a.renovacao_status === "Renovada" || a.status === "Renovada")
              .length /
              dueInPeriod.length) *
              100,
          )
        : null,
      cancelled: ws.apolices.filter((a) => a.status === "Cancelada" && inRange(a.updated_at))
        .length,
      insurers: [...byInsurer.entries()].sort((a, b) => b[1].premio - a[1].premio),
      comPrev: com.reduce((s, c) => s + Number(c.valor), 0),
      comRec: com.filter((c) => c.status === "Recebida").reduce((s, c) => s + Number(c.valor), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, from, to]);

  const upcoming = ws.apolices.filter(
    (a) => isOpenRenewal(a, alertDays) && daysUntil(a.vencimento) >= 0,
  ).length;
  const overdue = ws.apolices.filter(
    (a) => isOpenRenewal(a, alertDays) && daysUntil(a.vencimento) < 0,
  ).length;
  const active = ws.apolices.filter(isActivePolicy);

  // Visão por produtor (como no Mais Corret): prêmios ponderados pela participação no rateio.
  const produtores = useMemo(() => {
    if (!ws.temProdutores || !ws.produtores.length) return [];
    const ids = [...ws.produtores.map((p) => p.id), SEM_PRODUTOR];
    const peso = (a: (typeof ws.apolices)[number], id: string) =>
      id === SEM_PRODUTOR ? (a.produtor_id ? 0 : 1) : participacao(a, id, get.rateio);
    return ids
      .map((id) => {
        let carteira = 0,
          vigentes = 0,
          producao = 0,
          novas = 0,
          vencem = 0,
          renovadas = 0;
        for (const a of ws.apolices) {
          const w = peso(a, id);
          if (!w) continue;
          if (isActivePolicy(a)) {
            vigentes++;
            carteira += Number(a.premio) * w;
          }
          if (inRange(a.inicio) && a.status !== "Cancelada") {
            novas++;
            producao += Number(a.premio) * w;
          }
          if (inRange(a.vencimento) && daysUntil(a.vencimento) <= 0 && a.status !== "Cancelada") {
            vencem++;
            if (a.status === "Renovada" || a.renovacao_status === "Renovada") renovadas++;
          }
        }
        const comissao = ws.comissoes
          .filter(
            (c) =>
              c.status !== "Cancelada" &&
              inRange(c.data_prevista) &&
              (id === SEM_PRODUTOR ? !c.produtor_id : c.produtor_id === id),
          )
          .reduce((t, c) => t + Number(c.valor), 0);
        return {
          id,
          nome: id === SEM_PRODUTOR ? "Sem produtor" : get.produtorNome(id),
          clientes: ws.clientes.filter((c) =>
            id === SEM_PRODUTOR ? !c.produtor_id : c.produtor_id === id,
          ).length,
          vigentes,
          carteira,
          novas,
          producao,
          vencem,
          renovadas,
          comissao,
        };
      })
      .filter((p) => p.clientes || p.vigentes || p.novas || p.vencem || p.comissao)
      .sort((a, b) => b.carteira - a.carteira);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, from, to, get]);

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Relatórios"
        description="Indicadores da carteira e da operação."
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-end gap-2 print:hidden">
        <label className="text-xs font-semibold text-muted-foreground">
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block h-10 rounded-md border bg-card px-3 text-sm text-foreground"
          />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block h-10 rounded-md border bg-card px-3 text-sm text-foreground"
          />
        </label>
        {[
          ["Este mês", 0],
          ["3 meses", 2],
          ["12 meses", 11],
        ].map(([l, m]) => (
          <Button
            key={String(l)}
            size="sm"
            variant="ghost"
            onClick={() => {
              setFrom(iso(new Date(now.getFullYear(), now.getMonth() - Number(m), 1)));
              setTo(iso(now));
            }}
          >
            {l}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Report title="Carteira" subtitle="Situação atual (não depende do período)">
          <Kpis
            items={[
              ["Clientes", ws.clientes.length],
              ["Veículos", ws.veiculos.length],
              ["Apólices", ws.apolices.length],
              ["Vigentes", active.length],
              ["Prêmios vigentes", money(active.reduce((s, a) => s + Number(a.premio), 0))],
              ["Cancelamentos no período", r.cancelled],
            ]}
          />
        </Report>
        <Report title="Comercial" subtitle="Leads que entraram no período">
          <Kpis
            items={[
              ["Leads", r.leads.length],
              ["Vendidos", r.sold],
              ["Perdidos", r.lost],
              ["Conversão", `${r.conversion}%`],
            ]}
          />
          {r.origins.length > 0 && (
            <Bars
              title="Origem dos leads (vendidos em destaque)"
              rows={r.origins.map((o) => ({ label: o.label, value: o.value, highlight: o.sold }))}
            />
          )}
          {r.lostReasons.length > 0 && (
            <Bars
              title="Motivos de perda"
              rows={r.lostReasons.map(([label, value]) => ({ label, value }))}
              tone="bad"
            />
          )}
        </Report>
        <Report title="Renovações">
          <Kpis
            items={[
              ["Próximas", upcoming],
              ["Vencidas sem ação", overdue],
              ["Renovadas no período", r.renewalsDone],
              ["Não renovadas", r.notRenewed],
              ["Taxa de renovação", r.renewalRate === null ? "—" : `${r.renewalRate}%`],
            ]}
          />
        </Report>
        <Report title="Produção" subtitle="Apólices com início no período">
          <Kpis
            items={[
              ["Novas apólices", r.newPolicies],
              ["Renovações", r.renewalsDone],
              ["Prêmios emitidos", money(r.premios)],
            ]}
          />
          {r.insurers.length > 0 && (
            <Bars
              title="Prêmios por seguradora"
              rows={r.insurers.map(([label, v]) => ({
                label: `${label} (${v.n})`,
                value: v.premio,
              }))}
              format={money}
            />
          )}
        </Report>
        <Report
          title="Comissões"
          subtitle={ws.isAdmin ? "Previsão no período" : "Suas comissões no período"}
        >
          <Kpis
            items={[
              ["Previstas", money(r.comPrev)],
              ["Recebidas", money(r.comRec)],
              ["Pendentes", money(r.comPrev - r.comRec)],
            ]}
          />
        </Report>
      </div>
      {produtores.length > 0 && (
        <Card
          className="mt-5 break-inside-avoid overflow-hidden"
          data-testid="relatorio-produtores"
        >
          <CardHeader
            title="Por produtor"
            subtitle="Carteira atual e movimento no período. Com rateio, cada produtor conta a sua parte do prêmio."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  {[
                    "Produtor",
                    "Clientes",
                    "Vigentes",
                    "Prêmios vigentes",
                    "Produção no período",
                    "Renovação",
                    "Comissões no período",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-2 font-semibold ${i ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {produtores.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-semibold">{p.nome}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{p.clientes}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{p.vigentes}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(p.carteira)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {money(p.producao)}
                      <span className="block text-xs text-muted-foreground">
                        {p.novas} apólice(s)
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {p.vencem ? `${Math.round((p.renovadas / p.vencem) * 100)}%` : "—"}
                      <span className="block text-xs text-muted-foreground">
                        {p.renovadas}/{p.vencem}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(p.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function Report({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-5 p-4 lg:p-5">{children}</div>
    </Card>
  );
}

function Kpis({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <p className="text-xs text-muted-foreground">{k}</p>
          <p className="mt-0.5 font-display text-xl font-bold tabular-nums">{v}</p>
        </div>
      ))}
    </div>
  );
}

function Bars({
  title,
  rows,
  format = (n: number) => String(n),
  tone = "good",
}: {
  title: string;
  rows: { label: string; value: number; highlight?: number | undefined }[];
  format?: (n: number) => string;
  tone?: "good" | "bad" | undefined;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
          >
            <span className="truncate">{r.label}</span>
            <span className="relative h-2.5 overflow-hidden rounded-full bg-muted">
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${tone === "bad" ? "bg-destructive/40" : "bg-celeste-strong/35"}`}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
              {r.highlight ? (
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-celeste"
                  style={{ width: `${(r.highlight / max) * 100}%` }}
                />
              ) : null}
            </span>
            <span className="text-right tabular-nums text-muted-foreground">
              {format(r.value)}
              {r.highlight !== undefined ? ` · ${r.highlight}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
