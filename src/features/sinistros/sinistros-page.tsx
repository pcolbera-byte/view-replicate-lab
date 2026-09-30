import { useMemo, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Card,
  DemoBadge,
  EmptyState,
  FilterSelect,
  ListCount,
  PageHeader,
  RowButton,
  SearchInput,
  Segmented,
  StatusBadge,
} from "@/components/shared/ui";
import { CLAIM_STATUS, CLAIM_TYPES } from "@/lib/domain";
import { dateBR, daysUntil, normalize } from "@/lib/format";

export function SinistrosPage() {
  const { ws, openForm, openRecord, get } = useWorkspace();
  const [scope, setScope] = useState<"andamento" | "finalizados" | "todos">("andamento");
  const [status, setStatus] = useState("");
  const [tipo, setTipo] = useState("");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const t = normalize(q);
    return ws.sinistros
      .filter(
        (s) =>
          (scope === "todos" ||
            (scope === "andamento" ? s.status !== "Finalizado" : s.status === "Finalizado")) &&
          (!status || s.status === status) &&
          (!tipo || s.tipo === tipo) &&
          (!t ||
            normalize(
              `${s.protocolo} ${s.oficina} ${get.clienteNome(s.cliente_id)} ${get.veiculoNome(s.veiculo_id)}`,
            ).includes(t)),
      )
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [ws.sinistros, scope, status, tipo, q, get]);

  const active = ws.sinistros.filter((s) => s.status !== "Finalizado").length;

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Sinistros"
        description={`${active} em andamento`}
        actions={
          <Button onClick={() => openForm({ table: "sinistros" })}>
            <Plus /> Novo sinistro
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {CLAIM_STATUS.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => {
              setStatus(status === st ? "" : st);
              setScope("todos");
            }}
            className={`rounded-lg border bg-card p-3 text-left hover:border-primary/40 ${status === st ? "border-primary ring-1 ring-primary" : ""}`}
          >
            <span className="block truncate text-[11px] font-medium text-muted-foreground">
              {st}
            </span>
            <span className="font-display text-xl font-bold">
              {ws.sinistros.filter((s) => s.status === st).length}
            </span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <Segmented
          value={scope}
          onChange={(v) => {
            setScope(v);
            setStatus("");
          }}
          options={[
            { value: "andamento", label: "Em andamento" },
            { value: "finalizados", label: "Finalizados" },
            { value: "todos", label: "Todos" },
          ]}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Cliente, protocolo, oficina…"
          className="lg:w-72"
        />
        <FilterSelect
          value={tipo}
          onChange={setTipo}
          options={CLAIM_TYPES}
          allLabel="Todos os tipos"
        />
      </div>
      <ListCount n={rows.length} noun="sinistro" />
      <Card>
        {rows.length ? (
          rows.map((s) => {
            const stale = s.status !== "Finalizado" && daysUntil(s.updated_at.slice(0, 10)) < -7;
            return (
              <RowButton key={s.id} onClick={() => openRecord("sinistro", s.id)}>
                <span className="hidden size-10 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive sm:grid">
                  <AlertCircle size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold">
                    {get.clienteNome(s.cliente_id)}
                    <DemoBadge show={s.is_demo} />
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.tipo} · {dateBR(s.data)} · {get.veiculoNome(s.veiculo_id)}
                    {s.protocolo ? ` · ${s.protocolo}` : ""}
                  </p>
                </div>
                {stale && (
                  <span className="hidden text-xs font-semibold text-[oklch(0.5_0.12_60)] md:block">
                    sem atualização há 7+ dias
                  </span>
                )}
                <StatusBadge status={s.status} />
              </RowButton>
            );
          })
        ) : (
          <EmptyState icon={AlertCircle} title="Nenhum sinistro neste filtro" />
        )}
      </Card>
    </>
  );
}
