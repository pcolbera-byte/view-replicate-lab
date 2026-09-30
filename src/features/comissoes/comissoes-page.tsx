import { useMemo, useState } from "react";
import { Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Card,
  EmptyState,
  FilterSelect,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/components/shared/ui";
import { COMMISSION_STATUS } from "@/lib/domain";
import { dateBR, daysUntil, money, percent, todayISO } from "@/lib/format";
import { updateFields } from "@/lib/data/workspace";
import { cn } from "@/lib/utils";

function monthStart(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}

export function ComissoesPage() {
  const { ws, get, run, openRecord } = useWorkspace();
  const [from, setFrom] = useState(monthStart(-2));
  const [to, setTo] = useState(monthStart(3));
  const [seg, setSeg] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("");

  const rows = useMemo(
    () =>
      ws.comissoes
        .filter((c) => {
          const a = get.apolice(c.apolice_id);
          const m = c.data_prevista.slice(0, 7);
          return (
            (!from || m >= from) &&
            (!to || m <= to) &&
            (!seg || a?.seguradora === seg) &&
            (!owner || c.responsavel_id === owner) &&
            (!status ||
              (status === "Atrasada"
                ? c.status === "Prevista" && daysUntil(c.data_prevista) < 0
                : c.status === status))
          );
        })
        .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista)),
    [ws.comissoes, from, to, seg, owner, status, get],
  );

  const sum = (f: (c: (typeof rows)[number]) => boolean) =>
    rows.filter(f).reduce((s, c) => s + Number(c.valor), 0);
  const previsto = sum((c) => c.status !== "Cancelada");
  const recebido = sum((c) => c.status === "Recebida");
  const pendente = sum((c) => c.status === "Prevista");
  const atrasado = sum((c) => c.status === "Prevista" && daysUntil(c.data_prevista) < 0);
  const insurers = [...new Set(ws.apolices.map((a) => a.seguradora))].sort();

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Comissões"
        description={
          ws.isAdmin
            ? "Comissões de toda a corretora, geradas a partir das parcelas das apólices."
            : "Suas comissões previstas e recebidas."
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Prevista no período"
          value={<span className="text-xl">{money(previsto)}</span>}
          icon={Wallet}
          tone="info"
        />
        <StatCard
          label="Recebida"
          value={<span className="text-xl">{money(recebido)}</span>}
          icon={Check}
          tone="good"
        />
        <StatCard
          label="Pendente"
          value={<span className="text-xl">{money(pendente)}</span>}
          icon={Wallet}
          tone="warn"
        />
        <StatCard
          label="Atrasada"
          value={<span className="text-xl">{money(atrasado)}</span>}
          icon={Wallet}
          tone={atrasado ? "bad" : "neutral"}
          hint="prevista e não recebida"
        />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-end">
        <label className="text-xs font-semibold text-muted-foreground">
          De
          <input
            type="month"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block h-10 w-full rounded-md border bg-card px-3 text-sm text-foreground"
          />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Até
          <input
            type="month"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block h-10 w-full rounded-md border bg-card px-3 text-sm text-foreground"
          />
        </label>
        <FilterSelect
          value={seg}
          onChange={setSeg}
          options={insurers}
          allLabel="Todas as seguradoras"
        />
        {ws.isAdmin && (
          <FilterSelect
            value={owner}
            onChange={setOwner}
            options={ws.profiles.map((p) => ({ value: p.id, label: p.nome || p.email }))}
            allLabel="Todos os corretores"
          />
        )}
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[...COMMISSION_STATUS, "Atrasada"]}
          allLabel="Todas as situações"
        />
      </div>
      <Card className="overflow-hidden">
        {rows.length ? (
          <>
            <div className="hidden grid-cols-[minmax(0,1.6fr)_1.1fr_0.8fr_0.6fr_0.8fr_0.9fr_0.9fr_auto] gap-3 border-b bg-muted/50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Cliente · apólice</span>
              <span>Seguradora</span>
              <span>Prêmio</span>
              <span>%</span>
              <span>Valor</span>
              <span>Previsto</span>
              <span>Situação</span>
              <span className="w-24" />
            </div>
            {rows.map((c) => {
              const a = get.apolice(c.apolice_id);
              const late = c.status === "Prevista" && daysUntil(c.data_prevista) < 0;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-0 lg:grid lg:grid-cols-[minmax(0,1.6fr)_1.1fr_0.8fr_0.6fr_0.8fr_0.9fr_0.9fr_auto] lg:px-5"
                >
                  <button
                    type="button"
                    onClick={() => a && openRecord("apolice", a.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold">
                      {get.clienteNome(a?.cliente_id)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a?.numero}
                      {c.parcela ? ` · parcela ${c.parcela}` : ""}
                      <span className="lg:hidden">
                        {" "}
                        · {a?.seguradora} · {dateBR(c.data_prevista)}
                      </span>
                    </p>
                  </button>
                  <span className="hidden truncate text-sm lg:block">{a?.seguradora}</span>
                  <span className="hidden text-sm tabular-nums lg:block">
                    {a ? money(a.premio) : "—"}
                  </span>
                  <span className="hidden text-sm tabular-nums lg:block">
                    {c.percentual != null ? percent(c.percentual) : "—"}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{money(c.valor)}</span>
                  <span
                    className={cn(
                      "hidden text-sm lg:block",
                      late && "font-semibold text-destructive",
                    )}
                  >
                    {dateBR(c.data_prevista)}
                    {c.data_recebida && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        recebida {dateBR(c.data_recebida)}
                      </span>
                    )}
                  </span>
                  <StatusBadge status={late ? "Atrasado" : c.status} />
                  <span className="w-24 text-right">
                    {ws.isAdmin && c.status === "Prevista" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          run(
                            () =>
                              updateFields("comissoes", c.id, {
                                status: "Recebida",
                                data_recebida: todayISO(),
                              }),
                            "Comissão recebida.",
                          )
                        }
                      >
                        Recebida
                      </Button>
                    )}
                    {ws.isAdmin && c.status === "Recebida" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          run(() =>
                            updateFields("comissoes", c.id, {
                              status: "Prevista",
                              data_recebida: null,
                            }),
                          )
                        }
                      >
                        Desfazer
                      </Button>
                    )}
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <EmptyState
            icon={Wallet}
            title="Nenhuma comissão no período"
            subtitle="As comissões previstas são geradas junto com as parcelas ao cadastrar uma apólice."
          />
        )}
      </Card>
      {!ws.isAdmin && (
        <p className="mt-3 text-xs text-muted-foreground">
          Somente o administrador pode dar baixa em comissões.
        </p>
      )}
    </>
  );
}
