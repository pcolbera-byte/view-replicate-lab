import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, Pencil, Plus, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/app/workspace-context";
import {
  Badge,
  CallButton,
  Card,
  DemoBadge,
  EmptyState,
  KeyValues,
  Segmented,
  StatusBadge,
  WhatsAppButton,
} from "@/components/shared/ui";
import {
  ClaimRows,
  ContactTimeline,
  DocumentList,
  PolicyRows,
  TaskList,
  VehicleRows,
} from "@/components/records/sections";
import { useRenewalActions } from "@/components/records/renewal";
import { isActivePolicy, isOpenRenewal, isOpenTask } from "@/lib/domain";
import { dateBR, daysUntil, money } from "@/lib/format";

type Tab =
  | "dados"
  | "veiculos"
  | "apolices"
  | "renovacoes"
  | "sinistros"
  | "tarefas"
  | "historico"
  | "documentos";

export function ClienteFicha({ id }: { id: string }) {
  const { ws, get, openForm, message, alertDays, openRecord } = useWorkspace();
  const r = useRenewalActions();
  const [tab, setTab] = useState<Tab>("dados");
  const c = get.cliente(id);
  if (!c) {
    return (
      <Card>
        <EmptyState
          title="Cliente não encontrado"
          subtitle="Ele pode ter sido excluído."
          action={
            <Link to="/clientes" className="text-sm font-semibold text-primary">
              Voltar para clientes
            </Link>
          }
        />
      </Card>
    );
  }

  const vehicles = ws.veiculos.filter((v) => v.cliente_id === id);
  const policies = ws.apolices.filter((a) => a.cliente_id === id);
  const renewals = policies.filter((a) => isOpenRenewal(a, 180));
  const claims = ws.sinistros.filter((s) => s.cliente_id === id);
  const tasks = ws.tarefas.filter((t) => t.cliente_id === id);
  const history = ws.historico_contatos.filter((h) => h.cliente_id === id);
  const docs = ws.documentos.filter((d) => d.cliente_id === id);
  const active = policies.filter(isActivePolicy);
  const nextRenewal = active.map((a) => a.vencimento).sort()[0];
  const origemLead = ws.leads.find((l) => l.cliente_id === id);

  const tabs: { value: Tab; label: string; count?: number | undefined }[] = [
    { value: "dados", label: "Dados" },
    { value: "veiculos", label: "Veículos", count: vehicles.length },
    { value: "apolices", label: "Apólices", count: policies.length },
    { value: "renovacoes", label: "Renovações", count: renewals.length },
    { value: "sinistros", label: "Sinistros", count: claims.length },
    { value: "tarefas", label: "Tarefas", count: tasks.filter(isOpenTask).length },
    { value: "historico", label: "Histórico", count: history.length },
    { value: "documentos", label: "Documentos", count: docs.length },
  ];

  const address = [
    c.endereco,
    c.numero,
    c.complemento,
    c.bairro,
    c.cidade && `${c.cidade}${c.estado ? `/${c.estado}` : ""}`,
    c.cep,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <Link
        to="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Clientes
      </Link>
      <Card className="mb-5 p-5 lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
              {c.tipo === "PJ" ? <Building2 size={26} /> : <User2 size={26} />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold">{c.nome}</h1>
                <DemoBadge show={c.is_demo} />
                <Badge tone="neutral">{c.tipo}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[c.documento, c.whatsapp || c.telefone, c.email].filter(Boolean).join(" · ") ||
                  "Sem documento ou contato cadastrado"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.produtor_id && <>Produtor: {get.produtorNome(c.produtor_id)} · </>}
                Responsável: {get.usuarioNome(c.responsavel_id)} · cliente desde{" "}
                {dateBR(c.created_at)}
                {origemLead ? ` · veio de lead (${origemLead.origem})` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <WhatsAppButton
              size="sm"
              phone={c.whatsapp || c.telefone}
              message={message("primeiro_contato", { nome: c.nome })}
            />
            <CallButton size="sm" phone={c.telefone || c.whatsapp} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => openForm({ table: "clientes", id: c.id })}
            >
              <Pencil /> Editar
            </Button>
            <Button
              size="sm"
              onClick={() => openForm({ table: "tarefas", initial: { cliente_id: c.id } })}
            >
              <Plus /> Nova tarefa
            </Button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
          <Metric label="Veículos" value={vehicles.length} />
          <Metric label="Apólices vigentes" value={active.length} />
          <Metric
            label="Prêmios vigentes"
            value={money(active.reduce((s, a) => s + Number(a.premio), 0))}
          />
          <Metric
            label="Próxima renovação"
            value={nextRenewal ? `${dateBR(nextRenewal)} (${daysUntil(nextRenewal)}d)` : "—"}
          />
        </div>
      </Card>

      <div className="mb-4">
        <Segmented value={tab} onChange={setTab} options={tabs} />
      </div>

      <Card className="p-4 lg:p-6">
        {tab === "dados" && (
          <KeyValues
            items={
              c.tipo === "PJ"
                ? [
                    ["Razão social", c.nome, true],
                    ["Nome fantasia", c.nome_fantasia],
                    ["CNPJ", c.documento],
                    ["Responsável", c.responsavel_nome],
                    ["CPF do responsável", c.responsavel_cpf],
                    ["WhatsApp", c.whatsapp],
                    ["Telefone", c.telefone],
                    ["E-mail", c.email],
                    ["Endereço", address, true],
                    ["Observações", c.observacoes, true],
                  ]
                : [
                    ["Nome completo", c.nome, true],
                    ["CPF", c.documento],
                    ["RG", c.rg],
                    ["Nascimento", c.data_nascimento ? dateBR(c.data_nascimento) : null],
                    ["Estado civil", c.estado_civil],
                    ["WhatsApp", c.whatsapp],
                    ["Telefone", c.telefone],
                    ["E-mail", c.email],
                    ["Endereço", address, true],
                    ["Observações", c.observacoes, true],
                  ]
            }
          />
        )}
        {tab === "veiculos" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="mb-3"
              onClick={() => openForm({ table: "veiculos", initial: { cliente_id: c.id } })}
            >
              <Plus /> Novo veículo
            </Button>
            <VehicleRows items={vehicles} />
          </>
        )}
        {tab === "apolices" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="mb-3"
              onClick={() =>
                openForm({
                  table: "apolices",
                  initial: {
                    cliente_id: c.id,
                    veiculo_id: vehicles.length === 1 ? vehicles[0]?.id : null,
                  },
                })
              }
            >
              <Plus /> Nova apólice
            </Button>
            <PolicyRows items={policies} />
          </>
        )}
        {tab === "renovacoes" &&
          (renewals.length ? (
            <div className="divide-y rounded-md border">
              {renewals.map((a) => {
                const d = daysUntil(a.vencimento);
                return (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                    <button
                      type="button"
                      onClick={() => openRecord("apolice", a.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-sm font-semibold">
                        {a.seguradora} · {a.numero}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.veiculo_id ? get.veiculoNome(a.veiculo_id) : a.ramo} · vence{" "}
                        {dateBR(a.vencimento)} ({d < 0 ? `venceu há ${-d}d` : `${d}d`})
                        {d > alertDays ? " · fora da janela de alerta" : ""}
                      </p>
                    </button>
                    <StatusBadge status={a.renovacao_status} />
                    <Button size="sm" onClick={() => r.renew(a)}>
                      Renovar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => r.markNotRenewed(a)}
                    >
                      Não renovada
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Nenhuma renovação pendente"
              subtitle="Apólices vigentes vencendo nos próximos meses aparecem aqui."
            />
          ))}
        {tab === "sinistros" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="mb-3"
              onClick={() => openForm({ table: "sinistros", initial: { cliente_id: c.id } })}
            >
              <Plus /> Novo sinistro
            </Button>
            <ClaimRows items={claims} />
          </>
        )}
        {tab === "tarefas" && <TaskList items={tasks} initial={{ cliente_id: c.id }} compact />}
        {tab === "historico" && <ContactTimeline items={history} initial={{ cliente_id: c.id }} />}
        {tab === "documentos" && <DocumentList items={docs} links={{ cliente_id: c.id }} />}
      </Card>
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
