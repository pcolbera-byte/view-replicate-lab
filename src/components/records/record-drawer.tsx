// Fichas rápidas (painel lateral) de lead, veículo, apólice e sinistro.
import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Ban, Pencil, Plus, RefreshCw, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/panel";
import {
  CallButton,
  DemoBadge,
  EmptyState,
  KeyValues,
  Segmented,
  StatusBadge,
  WhatsAppButton,
} from "@/components/shared/ui";
import { useWorkspace, type RecordKind } from "@/components/app/workspace-context";
import { ContactTimeline, DocumentList, InstallmentList, PolicyRows, TaskList } from "./sections";
import { useRenewalActions } from "./renewal";
import { CLAIM_STATUS, LEAD_STAGES, commissionOf, policyStatus } from "@/lib/domain";
import { dateBR, daysUntil, money, percent, todayISO } from "@/lib/format";
import { rpc, updateFields } from "@/lib/data/workspace";
import { cn } from "@/lib/utils";

export function RecordDrawer({
  kind,
  id,
  onClose,
}: {
  kind: RecordKind;
  id: string;
  onClose: () => void;
}) {
  switch (kind) {
    case "lead":
      return <LeadDrawer id={id} onClose={onClose} />;
    case "veiculo":
      return <VehicleDrawer id={id} onClose={onClose} />;
    case "apolice":
      return <PolicyDrawer id={id} onClose={onClose} />;
    case "sinistro":
      return <ClaimDrawer id={id} onClose={onClose} />;
  }
}

function Missing({ onClose }: { onClose: () => void }) {
  return (
    <Panel open onClose={onClose} title="Registro não encontrado">
      <EmptyState title="Este registro foi excluído ou você não tem acesso a ele." />
    </Panel>
  );
}

function Tabs({
  tabs,
  children,
}: {
  tabs: { key: string; label: string; count?: number | undefined }[];
  children: (tab: string) => ReactNode;
}) {
  const [tab, setTab] = useState(tabs[0]?.key ?? "");
  return (
    <>
      <div className="-mx-1 mb-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={tabs.map((t) => ({
            value: t.key,
            label: t.label,
            ...(t.count !== undefined ? { count: t.count } : {}),
          }))}
        />
      </div>
      {children(tab)}
    </>
  );
}

// ---------------------------------------------------------------- Lead
function LeadDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { ws, openForm, run, confirm, message, get } = useWorkspace();
  const navigate = useNavigate();
  const lead = get.lead(id);
  if (!lead) return <Missing onClose={onClose} />;
  const history = ws.historico_contatos.filter((h) => h.lead_id === id);
  const tasks = ws.tarefas.filter((t) => t.lead_id === id);

  async function convert() {
    if (!lead) return;
    let clienteId = "";
    const ok = await run(async () => {
      clienteId = await rpc("converter_lead", { _lead_id: lead.id });
    }, "Lead convertido em cliente. Histórico preservado.");
    if (ok && clienteId) {
      onClose();
      navigate({ to: "/clientes/$id", params: { id: clienteId } });
    }
  }
  async function lose() {
    if (!lead) return;
    const motivo = await confirm({
      title: "Marcar lead como perdido?",
      confirmLabel: "Marcar perdido",
      destructive: true,
      inputLabel: "Motivo da perda",
      inputRequired: true,
    });
    if (motivo !== false)
      await run(
        () => updateFields("leads", lead.id, { status: "Perdido", motivo_perda: motivo }),
        "Lead marcado como perdido.",
      );
  }

  return (
    <Panel
      open
      onClose={onClose}
      eyebrow={
        <span className="flex items-center gap-2">
          Lead <DemoBadge show={lead.is_demo} />
        </span>
      }
      title={lead.nome}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={lead.status} /> {lead.produto} · {lead.origem} · entrou em{" "}
          {dateBR(lead.data_entrada)}
        </span>
      }
      actions={
        <>
          <WhatsAppButton
            size="sm"
            phone={lead.whatsapp || lead.telefone}
            message={message("primeiro_contato", { nome: lead.nome })}
          />
          <CallButton size="sm" phone={lead.telefone || lead.whatsapp} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => openForm({ table: "leads", id: lead.id })}
          >
            <Pencil /> Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              openForm({
                table: "tarefas",
                initial: { lead_id: lead.id, titulo: `Retorno para ${lead.nome}` },
              })
            }
          >
            <Plus /> Tarefa
          </Button>
          {lead.cliente_id ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                navigate({ to: "/clientes/$id", params: { id: lead.cliente_id ?? "" } });
              }}
            >
              <ArrowRight /> Ver cliente
            </Button>
          ) : (
            <Button size="sm" onClick={convert}>
              <UserCheck /> Converter em cliente
            </Button>
          )}
          {!lead.cliente_id && lead.status !== "Perdido" && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={lose}>
              <Ban /> Perdido
            </Button>
          )}
        </>
      }
    >
      <div className="mb-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Etapa do funil
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LEAD_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                s !== lead.status && run(() => updateFields("leads", lead.id, { status: s }))
              }
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-medium transition-colors",
                s === lead.status
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <Tabs
        tabs={[
          { key: "dados", label: "Dados" },
          { key: "historico", label: "Histórico", count: history.length },
          { key: "tarefas", label: "Tarefas", count: tasks.length },
        ]}
      >
        {(tab) =>
          tab === "dados" ? (
            <KeyValues
              items={[
                ["WhatsApp", lead.whatsapp],
                ["Telefone", lead.telefone],
                ["E-mail", lead.email, true],
                ["CPF / CNPJ", lead.documento],
                ["Cidade", lead.cidade],
                ["Responsável", get.usuarioNome(lead.responsavel_id)],
                ["Motivo da perda", lead.motivo_perda, true],
                ["Observações", lead.observacoes, true],
              ]}
            />
          ) : tab === "historico" ? (
            <ContactTimeline items={history} initial={{ lead_id: lead.id }} />
          ) : (
            <TaskList items={tasks} initial={{ lead_id: lead.id }} compact />
          )
        }
      </Tabs>
    </Panel>
  );
}

// ---------------------------------------------------------------- Veículo
function VehicleDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { ws, openForm, get } = useWorkspace();
  const navigate = useNavigate();
  const v = get.veiculo(id);
  if (!v) return <Missing onClose={onClose} />;
  const drivers = ws.condutores.filter((c) => c.veiculo_id === id);
  const policies = ws.apolices.filter((a) => a.veiculo_id === id);
  const docs = ws.documentos.filter((d) => d.veiculo_id === id);
  return (
    <Panel
      open
      onClose={onClose}
      eyebrow={
        <span className="flex items-center gap-2">
          Veículo <DemoBadge show={v.is_demo} />
        </span>
      }
      title={`${v.marca} ${v.modelo}`}
      subtitle={
        <span className="flex items-center gap-2">
          <span className="rounded border-2 border-foreground/80 px-1.5 font-mono text-xs font-bold text-foreground">
            {v.placa}
          </span>{" "}
          {get.clienteNome(v.cliente_id)}
        </span>
      }
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openForm({ table: "veiculos", id: v.id })}
          >
            <Pencil /> Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              openForm({
                table: "apolices",
                initial: { cliente_id: v.cliente_id, veiculo_id: v.id },
              })
            }
          >
            <Plus /> Apólice
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onClose();
              navigate({ to: "/clientes/$id", params: { id: v.cliente_id } });
            }}
          >
            <ArrowRight /> Cliente
          </Button>
        </>
      }
    >
      <Tabs
        tabs={[
          { key: "dados", label: "Dados" },
          { key: "condutores", label: "Condutores", count: drivers.length },
          { key: "apolices", label: "Apólices", count: policies.length },
          { key: "docs", label: "Documentos", count: docs.length },
        ]}
      >
        {(tab) =>
          tab === "dados" ? (
            <KeyValues
              items={[
                ["Placa", v.placa],
                ["Tipo", v.tipo],
                [
                  "Ano fab./modelo",
                  [v.ano_fabricacao, v.ano_modelo ?? v.ano].filter(Boolean).join(" / "),
                ],
                ["Valor FIPE", v.valor_fipe != null ? money(v.valor_fipe) : null],
                ["Combustível", v.combustivel],
                ["Uso", v.uso],
                ["Renavam", v.renavam],
                ["Chassi", v.chassi],
                ["Local de guarda", v.local_guarda],
                ["CEP de circulação", v.cep_circulacao],
                ["CEP de pernoite", v.cep_pernoite],
                ["Observações", v.observacoes, true],
              ]}
            />
          ) : tab === "condutores" ? (
            <div>
              <Button
                size="sm"
                variant="outline"
                className="mb-3"
                onClick={() => openForm({ table: "condutores", initial: { veiculo_id: v.id } })}
              >
                <Plus /> Adicionar condutor
              </Button>
              {drivers.length ? (
                <div className="divide-y rounded-md border">
                  {drivers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        openForm({ table: "condutores", id: c.id, initial: { veiculo_id: v.id } })
                      }
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.relacao || "Condutor"}
                          {c.cnh ? ` · CNH ${c.cnh}` : ""}
                          {c.data_habilitacao
                            ? ` · habilitado em ${dateBR(c.data_habilitacao)}`
                            : ""}
                        </p>
                      </div>
                      <Pencil size={14} className="text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Nenhum condutor"
                  subtitle="Cadastre quem dirige o veículo (apenas para controle da corretora)."
                />
              )}
            </div>
          ) : tab === "apolices" ? (
            <PolicyRows items={policies} />
          ) : (
            <DocumentList items={docs} links={{ cliente_id: v.cliente_id, veiculo_id: v.id }} />
          )
        }
      </Tabs>
    </Panel>
  );
}

// ---------------------------------------------------------------- Apólice
function PolicyDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { ws, openForm, openRecord, get, message, run } = useWorkspace();
  const navigate = useNavigate();
  const r = useRenewalActions();
  const a = get.apolice(id);
  if (!a) return <Missing onClose={onClose} />;
  const cliente = get.cliente(a.cliente_id);
  const parcelas = ws.parcelas.filter((p) => p.apolice_id === id);
  const comissoes = ws.comissoes.filter((c) => c.apolice_id === id);
  const docs = ws.documentos.filter((d) => d.apolice_id === id);
  const history = ws.historico_contatos.filter((h) => h.apolice_id === id);
  const successor = ws.apolices.find((x) => x.apolice_anterior_id === id);
  const predecessor = get.apolice(a.apolice_anterior_id);
  const d = daysUntil(a.vencimento);
  const st = policyStatus(a);
  const renewable = a.status === "Vigente" && !successor && a.renovacao_status !== "Não renovada";

  return (
    <Panel
      open
      onClose={onClose}
      eyebrow={
        <span className="flex items-center gap-2">
          Apólice {a.ramo} <DemoBadge show={a.is_demo} />
        </span>
      }
      title={`${a.seguradora} · ${a.numero}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={st} /> {get.clienteNome(a.cliente_id)} · {dateBR(a.inicio)} a{" "}
          {dateBR(a.vencimento)}
          {st === "Vigente" && d <= 60 ? ` · vence em ${d} dia(s)` : ""}
        </span>
      }
      actions={
        <>
          <WhatsAppButton
            size="sm"
            phone={cliente?.whatsapp || cliente?.telefone}
            message={message(renewable && d <= 60 ? "renovacao" : "pos_venda", {
              nome: cliente?.nome,
              veiculo: get.veiculo(a.veiculo_id)?.modelo,
              vencimento: a.vencimento,
            })}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => openForm({ table: "apolices", id: a.id })}
          >
            <Pencil /> Editar
          </Button>
          {renewable && (
            <Button size="sm" onClick={() => r.renew(a)}>
              <RefreshCw /> Renovar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onClose();
              navigate({ to: "/clientes/$id", params: { id: a.cliente_id } });
            }}
          >
            <ArrowRight /> Cliente
          </Button>
        </>
      }
    >
      {(successor || predecessor || a.renovacao_status !== "Pendente") && (
        <div className="mb-5 space-y-2 rounded-md bg-muted p-3 text-sm">
          {a.renovacao_status !== "Pendente" && (
            <p>
              Renovação: <StatusBadge status={a.renovacao_status} />
              {a.renovacao_obs ? ` — ${a.renovacao_obs}` : ""}
            </p>
          )}
          {successor && (
            <p>
              Renovada pela apólice{" "}
              <button
                className="font-semibold text-primary underline"
                onClick={() => openRecord("apolice", successor.id)}
              >
                {successor.seguradora} {successor.numero}
              </button>
            </p>
          )}
          {predecessor && (
            <p>
              Renovação da apólice{" "}
              <button
                className="font-semibold text-primary underline"
                onClick={() => openRecord("apolice", predecessor.id)}
              >
                {predecessor.seguradora} {predecessor.numero}
              </button>
            </p>
          )}
        </div>
      )}
      <Tabs
        tabs={[
          { key: "dados", label: "Dados" },
          { key: "parcelas", label: "Parcelas", count: parcelas.length },
          { key: "comissao", label: "Comissão" },
          { key: "docs", label: "Documentos", count: docs.length },
          { key: "hist", label: "Contatos", count: history.length },
        ]}
      >
        {(tab) =>
          tab === "dados" ? (
            <KeyValues
              items={[
                ["Cliente", get.clienteNome(a.cliente_id)],
                ["Veículo", get.veiculoNome(a.veiculo_id)],
                ["Seguradora", a.seguradora],
                ["Número", a.numero],
                ["Início", dateBR(a.inicio)],
                ["Fim da vigência", dateBR(a.vencimento)],
                ["Prêmio", money(a.premio)],
                ["Franquia", a.franquia != null ? money(a.franquia) : null],
                ["Forma de pagamento", a.forma_pagamento],
                ["Parcelas", a.parcelas_qtd],
                ["Responsável", get.usuarioNome(a.responsavel_id)],
                ["Observações", a.observacoes, true],
              ]}
            />
          ) : tab === "parcelas" ? (
            <InstallmentList apolice={a} items={parcelas} />
          ) : tab === "comissao" ? (
            <div>
              <KeyValues
                items={[
                  [
                    "Percentual",
                    a.comissao_percentual != null ? percent(a.comissao_percentual) : null,
                  ],
                  ["Comissão total", money(commissionOf(a))],
                ]}
              />
              <div className="mt-5 divide-y rounded-md border">
                {comissoes.length ? (
                  comissoes.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                      <button
                        type="button"
                        disabled={!ws.isAdmin}
                        onClick={() => openForm({ table: "comissoes", id: c.id })}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-sm font-semibold tabular-nums">
                          {money(c.valor)}
                          {c.parcela ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · parcela {c.parcela}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Previsto {dateBR(c.data_prevista)}
                          {c.data_recebida ? ` · recebido ${dateBR(c.data_recebida)}` : ""}
                        </p>
                      </button>
                      <StatusBadge status={c.status} />
                      {ws.isAdmin && c.status === "Prevista" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald"
                          onClick={() =>
                            run(
                              () =>
                                updateFields("comissoes", c.id, {
                                  status: "Recebida",
                                  data_recebida: todayISO(),
                                }),
                              "Comissão marcada como recebida.",
                            )
                          }
                        >
                          Recebida
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Sem comissões lançadas"
                    subtitle="Elas são criadas junto com as parcelas."
                  />
                )}
              </div>
            </div>
          ) : tab === "docs" ? (
            <DocumentList
              items={docs}
              links={{ cliente_id: a.cliente_id, veiculo_id: a.veiculo_id, apolice_id: a.id }}
            />
          ) : (
            <ContactTimeline
              items={history}
              initial={{ cliente_id: a.cliente_id, apolice_id: a.id }}
            />
          )
        }
      </Tabs>
    </Panel>
  );
}

// ---------------------------------------------------------------- Sinistro
function ClaimDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { ws, openForm, get, run, message } = useWorkspace();
  const s = ws.sinistros.find((x) => x.id === id);
  if (!s) return <Missing onClose={onClose} />;
  const cliente = get.cliente(s.cliente_id);
  const apolice = get.apolice(s.apolice_id);
  const docs = ws.documentos.filter((d) => d.sinistro_id === id);
  const idx = CLAIM_STATUS.indexOf(s.status as (typeof CLAIM_STATUS)[number]);
  const stale = s.status !== "Finalizado" && daysUntil(s.updated_at.slice(0, 10)) < -7;
  return (
    <Panel
      open
      onClose={onClose}
      eyebrow={
        <span className="flex items-center gap-2">
          Sinistro <DemoBadge show={s.is_demo} />
        </span>
      }
      title={`${s.tipo} · ${get.clienteNome(s.cliente_id)}`}
      subtitle={`${dateBR(s.data)}${s.protocolo ? ` · protocolo ${s.protocolo}` : ""}${apolice ? ` · ${apolice.seguradora}` : ""}`}
      actions={
        <>
          <WhatsAppButton
            size="sm"
            phone={cliente?.whatsapp || cliente?.telefone}
            message={message("sinistro", { nome: cliente?.nome })}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => openForm({ table: "sinistros", id: s.id })}
          >
            <Pencil /> Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              openForm({
                table: "tarefas",
                initial: {
                  cliente_id: s.cliente_id,
                  tipo: "Sinistro",
                  titulo: `Acompanhar sinistro ${s.protocolo || s.tipo}`,
                },
              })
            }
          >
            <Plus /> Tarefa
          </Button>
        </>
      }
    >
      {stale && (
        <p className="mb-4 rounded-md bg-warning/15 p-3 text-sm">
          Sem atualização há mais de 7 dias. Verifique o andamento com a seguradora.
        </p>
      )}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Andamento
      </p>
      <ol className="mb-6 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {CLAIM_STATUS.map((st, i) => (
          <li key={st}>
            <button
              type="button"
              onClick={() =>
                st !== s.status &&
                run(() => updateFields("sinistros", s.id, { status: st }), `Sinistro: ${st}.`)
              }
              className={cn(
                "w-full rounded-md border px-1 py-2 text-[11px] font-semibold leading-tight transition-colors",
                i < idx
                  ? "border-emerald/30 bg-emerald/10 text-emerald"
                  : i === idx
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
              )}
            >
              {st}
            </button>
          </li>
        ))}
      </ol>
      <Tabs
        tabs={[
          { key: "dados", label: "Dados" },
          { key: "docs", label: "Documentos e fotos", count: docs.length },
        ]}
      >
        {(tab) =>
          tab === "dados" ? (
            <KeyValues
              items={[
                ["Cliente", get.clienteNome(s.cliente_id)],
                ["Veículo", get.veiculoNome(s.veiculo_id)],
                ["Apólice", apolice ? `${apolice.seguradora} ${apolice.numero}` : null],
                ["Protocolo", s.protocolo],
                ["Local", s.local],
                ["Oficina", s.oficina],
                ["Responsável", get.usuarioNome(s.responsavel_id)],
                ["Última atualização", dateBR(s.updated_at)],
                ["Descrição", s.descricao, true],
                ["Observações internas", s.observacoes, true],
              ]}
            />
          ) : (
            <DocumentList
              items={docs}
              links={{
                cliente_id: s.cliente_id,
                veiculo_id: s.veiculo_id,
                apolice_id: s.apolice_id,
                sinistro_id: s.id,
              }}
            />
          )
        }
      </Tabs>
    </Panel>
  );
}
