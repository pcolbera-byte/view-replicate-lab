import { useMemo, useState } from "react";
import { Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Card,
  DemoBadge,
  EmptyState,
  FilterSelect,
  ListCount,
  PageHeader,
  SearchInput,
  Segmented,
  StatusBadge,
} from "@/components/shared/ui";
import { RAMOS, installmentStatus, isOpenRenewal, policyStatus } from "@/lib/domain";
import { dateBR, daysUntil, money, normalize } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter =
  "vigente" | "renovacao" | "Renovada" | "Cancelada" | "Encerrada" | "Vencida" | "todas";

export function ApolicesPage() {
  const { ws, openForm, openRecord, get, alertDays } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("vigente");
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("");
  const [ramo, setRamo] = useState("");

  const counts = useMemo(() => {
    const st = ws.apolices.map(policyStatus);
    return {
      vigente: st.filter((s) => s === "Vigente").length,
      renovacao: ws.apolices.filter(
        (a) => isOpenRenewal(a, alertDays) && daysUntil(a.vencimento) >= 0,
      ).length,
      Renovada: st.filter((s) => s === "Renovada").length,
      Vencida: st.filter((s) => s === "Vencida").length,
      Cancelada: st.filter((s) => s === "Cancelada").length,
      Encerrada: st.filter((s) => s === "Encerrada").length,
      todas: ws.apolices.length,
    };
  }, [ws.apolices, alertDays]);

  const rows = useMemo(() => {
    const t = normalize(q);
    return ws.apolices
      .filter((a) => {
        const st = policyStatus(a);
        const okFilter =
          filter === "todas"
            ? true
            : filter === "vigente"
              ? st === "Vigente"
              : filter === "renovacao"
                ? isOpenRenewal(a, alertDays) && daysUntil(a.vencimento) >= 0
                : st === filter;
        return (
          okFilter &&
          (!seg || a.seguradora === seg) &&
          (!ramo || a.ramo === ramo) &&
          (!t ||
            normalize(
              `${a.numero} ${a.seguradora} ${get.clienteNome(a.cliente_id)} ${get.veiculoNome(a.veiculo_id)}`,
            ).includes(t))
        );
      })
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [ws.apolices, filter, q, seg, ramo, get, alertDays]);

  const insurers = [...new Set(ws.apolices.map((a) => a.seguradora))].sort();
  const total = rows.reduce((s, a) => s + Number(a.premio), 0);

  return (
    <>
      <PageHeader
        eyebrow="Carteira"
        title="Apólices"
        description={`${counts.vigente} vigentes`}
        actions={
          <Button onClick={() => openForm({ table: "apolices" })}>
            <Plus /> Nova apólice
          </Button>
        }
      />
      <div className="mb-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "vigente", label: "Vigentes", count: counts.vigente },
            { value: "renovacao", label: "Próximas da renovação", count: counts.renovacao },
            { value: "Renovada", label: "Renovadas", count: counts.Renovada },
            { value: "Vencida", label: "Vencidas", count: counts.Vencida },
            { value: "Cancelada", label: "Canceladas", count: counts.Cancelada },
            { value: "Encerrada", label: "Encerradas", count: counts.Encerrada },
            { value: "todas", label: "Todas", count: counts.todas },
          ]}
        />
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Número, cliente, placa…"
          className="sm:w-80"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            value={seg}
            onChange={setSeg}
            options={insurers}
            allLabel="Todas as seguradoras"
          />
          <FilterSelect value={ramo} onChange={setRamo} options={RAMOS} allLabel="Todos os ramos" />
        </div>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        {rows.length} apólice{rows.length === 1 ? "" : "s"} · prêmios {money(total)}
      </p>
      <Card className="overflow-hidden">
        {rows.length ? (
          <>
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_1fr_1fr_0.9fr_0.9fr_0.9fr] gap-3 border-b bg-muted/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
              <span>Cliente</span>
              <span>Veículo</span>
              <span>Seguradora · nº</span>
              <span>Vigência</span>
              <span>Prêmio</span>
              <span>Parcelas</span>
              <span>Situação</span>
            </div>
            {rows.map((a) => {
              const d = daysUntil(a.vencimento);
              const parc = ws.parcelas.filter((p) => p.apolice_id === a.id);
              const late = parc.filter((p) => installmentStatus(p) === "Atrasado").length;
              const paid = parc.filter((p) => p.status === "Pago").length;
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openRecord("apolice", a.id)}
                  onKeyDown={(e) => e.key === "Enter" && openRecord("apolice", a.id)}
                  className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/50 xl:grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_1fr_1fr_0.9fr_0.9fr_0.9fr] xl:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold">
                      {get.clienteNome(a.cliente_id)}
                      <DemoBadge show={a.is_demo} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground xl:hidden">
                      {a.seguradora} · {a.numero} ·{" "}
                      {a.veiculo_id ? get.veiculoNome(a.veiculo_id) : a.ramo}
                    </p>
                  </div>
                  <span className="hidden truncate text-sm xl:block">
                    {a.veiculo_id ? get.veiculoNome(a.veiculo_id) : a.ramo}
                  </span>
                  <span className="hidden truncate text-sm xl:block">
                    {a.seguradora}
                    <span className="block text-xs text-muted-foreground">{a.numero}</span>
                  </span>
                  <span
                    className={cn(
                      "hidden text-sm xl:block",
                      policyStatus(a) === "Vigente" && d <= 30 && "font-semibold text-destructive",
                    )}
                  >
                    {dateBR(a.vencimento)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      desde {dateBR(a.inicio)}
                    </span>
                  </span>
                  <span className="text-right text-sm font-semibold tabular-nums xl:text-left">
                    {money(a.premio)}
                    <span className="block text-xs font-normal text-muted-foreground xl:hidden">
                      até {dateBR(a.vencimento)}
                    </span>
                  </span>
                  <span className="hidden text-sm xl:block">
                    {parc.length ? (
                      <>
                        {paid}/{parc.length} pagas
                        {late ? (
                          <span className="block text-xs font-semibold text-destructive">
                            {late} em atraso
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <StatusBadge status={policyStatus(a)} />
                </div>
              );
            })}
          </>
        ) : (
          <EmptyState
            icon={Shield}
            title="Nenhuma apólice neste filtro"
            action={
              <Button size="sm" onClick={() => openForm({ table: "apolices" })}>
                <Plus /> Nova apólice
              </Button>
            }
          />
        )}
      </Card>
    </>
  );
}
