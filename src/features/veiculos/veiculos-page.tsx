import { useMemo, useState } from "react";
import { CarFront, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Badge,
  Card,
  DemoBadge,
  EmptyState,
  FilterSelect,
  ListCount,
  PageHeader,
  RowButton,
  SearchInput,
} from "@/components/shared/ui";
import { VEHICLE_TYPES, isActivePolicy } from "@/lib/domain";
import { money, normalize } from "@/lib/format";

export function VeiculosPage() {
  const { ws, openForm, openRecord, get } = useWorkspace();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [seguro, setSeguro] = useState("");

  const rows = useMemo(() => {
    const t = normalize(q),
      plate = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return ws.veiculos
      .map((v) => ({
        v,
        policy: ws.apolices.find((a) => a.veiculo_id === v.id && isActivePolicy(a)),
      }))
      .filter(
        ({ v, policy }) =>
          (!t ||
            (plate.length >= 2 && v.placa.includes(plate)) ||
            normalize(`${v.marca} ${v.modelo} ${get.clienteNome(v.cliente_id)}`).includes(t)) &&
          (!tipo || v.tipo === tipo) &&
          (!seguro || (seguro === "sim" ? !!policy : !policy)),
      );
  }, [ws, q, tipo, seguro, get]);

  return (
    <>
      <PageHeader
        eyebrow="Carteira"
        title="Veículos"
        description={`${ws.veiculos.length} veículos · ${ws.veiculos.filter((v) => ws.apolices.some((a) => a.veiculo_id === v.id && isActivePolicy(a))).length} segurados`}
        actions={
          <Button onClick={() => openForm({ table: "veiculos" })}>
            <Plus /> Novo veículo
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Placa, modelo ou cliente…"
          className="sm:w-80"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            value={tipo}
            onChange={setTipo}
            options={VEHICLE_TYPES}
            allLabel="Todos os tipos"
          />
          <FilterSelect
            value={seguro}
            onChange={setSeguro}
            options={[
              { value: "sim", label: "Segurados" },
              { value: "nao", label: "Sem apólice vigente" },
            ]}
            allLabel="Todos"
          />
        </div>
      </div>
      <ListCount n={rows.length} noun="veículo" />
      <Card>
        {rows.length ? (
          rows.map(({ v, policy }) => (
            <RowButton key={v.id} onClick={() => openRecord("veiculo", v.id)}>
              <span className="w-[84px] shrink-0 rounded border-2 border-foreground/80 py-0.5 text-center font-mono text-xs font-bold tracking-wider">
                {v.placa}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold">
                  {v.marca} {v.modelo}
                  <DemoBadge show={v.is_demo} />
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {get.clienteNome(v.cliente_id)} ·{" "}
                  {[v.ano_fabricacao, v.ano_modelo ?? v.ano].filter(Boolean).join("/")} · {v.tipo}
                </p>
              </div>
              <span className="hidden text-sm tabular-nums text-muted-foreground md:block">
                {v.valor_fipe ? money(v.valor_fipe) : ""}
              </span>
              {policy ? <Badge tone="good">{policy.seguradora}</Badge> : <Badge>Sem apólice</Badge>}
            </RowButton>
          ))
        ) : (
          <EmptyState
            icon={CarFront}
            title="Nenhum veículo encontrado"
            subtitle="Veículos são vinculados a um cliente."
          />
        )}
      </Card>
    </>
  );
}
