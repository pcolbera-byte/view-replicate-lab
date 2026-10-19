// Endossos da apólice: inclusão, exclusão, troca de veículo, cancelamento...
// Na troca de veículo o endosso registra o novo veículo (cadastrado na hora ou já existente),
// a forma de pagamento e as parcelas da diferença e outros dados (franquia, condutor).
import { useState, type ReactNode } from "react";
import { Ban, Car, FilePlus2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/panel";
import { EmptyState } from "@/components/shared/ui";
import { useWorkspace } from "@/components/app/workspace-context";
import { ENDOSSO_TIPOS, type Apolice, type Endosso } from "@/lib/data/types";
import {
  FUELS,
  GARAGE,
  PAYMENT_METHODS,
  VEHICLE_USE,
  aliquotaIOF,
  impostoComissao,
  premioAtual,
} from "@/lib/domain";
import { deleteRecord, rpcSemTipos, saveRecord } from "@/lib/data/workspace";
import { addMonths, dateBR, maskCep, maskPlate, money, todayISO } from "@/lib/format";
import { validatePlate } from "@/lib/validation";
import { detalhesEndosso, nomeVeiculo } from "@/lib/endossos";
import { grupoDoRamo } from "@/lib/ramos";
import { PdfEndossoButton } from "@/features/pdf/pdf-buttons";
import { cn } from "@/lib/utils";
import { AvisoMigracao } from "./apolice-extras";

const box = "mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm font-normal";
const lbl = "block text-xs font-semibold text-muted-foreground";

type NovoVeiculo = {
  placa: string;
  marca: string;
  modelo: string;
  ano_fabricacao: string;
  ano_modelo: string;
  chassi: string;
  renavam: string;
  combustivel: string;
  uso: string;
  local_guarda: string;
  cep_pernoite: string;
  valor_fipe: string;
};
const VEICULO_VAZIO: NovoVeiculo = {
  placa: "",
  marca: "",
  modelo: "",
  ano_fabricacao: "",
  ano_modelo: "",
  chassi: "",
  renavam: "",
  combustivel: "Flex",
  uso: "Particular",
  local_guarda: "",
  cep_pernoite: "",
  valor_fipe: "",
};

type FormEndosso = {
  tipo: string;
  numero: string;
  data: string;
  inicio: string;
  premio: string;
  /** Diferença de prêmio líquido (sem IOF): ao informar, o total é calculado. */
  liquido: string;
  comissao: string;
  comissaoManual: boolean;
  descricao: string;
  // Troca de veículo
  veiculoModo: "novo" | "existente";
  veiculoId: string;
  veiculo: NovoVeiculo;
  // Pagamento da diferença
  forma: string;
  parcelas: string;
  vencimento: string;
  // Outros dados
  franquia: string;
  condutor: string;
  classeBonus: string;
};

function Campo({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn(lbl, className)}>
      {label}
      {children}
    </label>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="col-span-full mt-2 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
      <legend className="pr-2 text-[11px] font-bold uppercase tracking-wide text-celeste">
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

export function EndossosSection({ a }: { a: Apolice }) {
  const { ws, run, confirm, get } = useWorkspace();
  const lista = ws.endossos
    .filter((e) => e.apolice_id === a.id)
    .sort((x, y) => y.data_emissao.localeCompare(x.data_emissao));
  const [form, setForm] = useState<FormEndosso | null>(null);
  const [erro, setErro] = useState("");
  const pct = Number(a.comissao_percentual || 0);
  const iofPct = aliquotaIOF(a.ramo);
  const imposto = impostoComissao(ws.empresa);
  /** Diferença de prêmio total → líquida (comissão é sobre o líquido, sem IOF). */
  const liquidoDe = (total: number) => Math.round((total / (1 + iofPct / 100)) * 100) / 100;
  const detalhe = ws.temEndossoDetalhe;
  const auto = grupoDoRamo(a.ramo) === "auto" || !!a.veiculo_id;
  const outrosVeiculos = ws.veiculos.filter(
    (v) => v.cliente_id === a.cliente_id && v.id !== a.veiculo_id,
  );

  const abrir = (tipo = "Alteração de dados") => {
    setErro("");
    setForm({
      tipo,
      numero: "",
      data: todayISO(),
      inicio: todayISO(),
      premio: "",
      liquido: "",
      comissao: "",
      comissaoManual: false,
      descricao: "",
      veiculoModo: "novo",
      veiculoId: outrosVeiculos[0]?.id ?? "",
      veiculo: { ...VEICULO_VAZIO },
      forma: a.forma_pagamento ?? "",
      parcelas: "1",
      vencimento: addMonths(todayISO(), 1),
      franquia: "",
      condutor: "",
      classeBonus: "",
    });
  };
  const upd = (patch: Partial<FormEndosso>) =>
    setForm((f) => {
      if (!f) return f;
      const n = { ...f, ...patch };
      const cent = (v: number) => String(Math.round(v * 100) / 100);
      if ("liquido" in patch)
        n.premio = n.liquido.trim() ? cent(Number(n.liquido) * (1 + iofPct / 100)) : "";
      else if ("premio" in patch)
        n.liquido = n.premio.trim() ? cent(liquidoDe(Number(n.premio))) : "";
      if (("premio" in patch || "liquido" in patch) && !n.comissaoManual)
        n.comissao = n.liquido.trim()
          ? String(Math.round(Number(n.liquido) * pct * (1 - imposto / 100)) / 100)
          : "";
      return n;
    });
  const updVeic = (patch: Partial<NovoVeiculo>) =>
    setForm((f) => (f ? { ...f, veiculo: { ...f.veiculo, ...patch } } : f));

  const troca = form?.tipo === "Troca de veículo";
  const premioNum = Number(form?.premio || 0);
  const temPagamento = detalhe && premioNum > 0;

  function validar(f: FormEndosso): string {
    if (Number.isNaN(Number(f.premio || 0)) || Number.isNaN(Number(f.comissao || 0)))
      return "Valores inválidos.";
    if (troca && detalhe) {
      if (f.veiculoModo === "existente" && !f.veiculoId) return "Escolha o novo veículo.";
      if (f.veiculoModo === "novo") {
        if (!f.veiculo.placa.trim() || !f.veiculo.marca.trim() || !f.veiculo.modelo.trim())
          return "Informe placa, marca e modelo do novo veículo.";
        const p = validatePlate(f.veiculo.placa);
        if (p) return `Placa: ${p}`;
      }
    }
    if (temPagamento) {
      const n = Number(f.parcelas || 1);
      if (!Number.isInteger(n) || n < 1 || n > 12) return "Parcelas: de 1 a 12.";
    }
    return "";
  }

  async function salvar() {
    if (!form) return;
    const msg = validar(form);
    setErro(msg);
    if (msg) return;
    if (form.tipo === "Cancelamento") {
      const ok = await confirm({
        title: "Cancelar a apólice?",
        description:
          "A apólice ficará como Cancelada. Parcelas pendentes e comissões previstas a partir da data do cancelamento também serão canceladas.",
        confirmLabel: "Registrar cancelamento",
        destructive: true,
      });
      if (ok === false) return;
    }
    const f = form;
    const ok = await run(
      async () => {
        const base = {
          _apolice: a.id,
          _tipo: f.tipo,
          _numero: f.numero.trim(),
          _data: f.data || todayISO(),
          _inicio: f.inicio || null,
          _premio: Number(f.premio || 0),
          _comissao: Number(f.comissao || 0),
          _descricao: f.descricao.trim(),
        };
        if (!detalhe) return rpcSemTipos("registrar_endosso", base);
        let veiculo: string | null = null;
        if (f.tipo === "Troca de veículo") {
          if (f.veiculoModo === "existente") veiculo = f.veiculoId;
          else {
            const v = f.veiculo;
            const num = (x: string) => (x.trim() ? Number(x) : null);
            veiculo = await saveRecord(
              "veiculos",
              {
                cliente_id: a.cliente_id,
                placa: maskPlate(v.placa),
                marca: v.marca.trim(),
                modelo: v.modelo.trim(),
                ano_fabricacao: num(v.ano_fabricacao),
                ano_modelo: num(v.ano_modelo),
                chassi: v.chassi.trim(),
                renavam: v.renavam.trim(),
                combustivel: v.combustivel || null,
                uso: v.uso || null,
                local_guarda: v.local_guarda || null,
                cep_pernoite: v.cep_pernoite.trim() || null,
                valor_fipe: num(v.valor_fipe),
                tipo: a.ramo === "Moto" ? "Moto" : a.ramo === "Caminhão" ? "Caminhão" : "Automóvel",
              },
              ws.empresa.id,
            );
          }
        }
        const dados: Record<string, string | number> = {};
        if (f.franquia.trim()) dados["franquia_nova"] = Number(f.franquia);
        if (f.condutor.trim()) dados["condutor_principal"] = f.condutor.trim();
        if (f.classeBonus.trim()) dados["classe_bonus"] = f.classeBonus.trim();
        const pago = Number(f.premio || 0) > 0;
        return rpcSemTipos("registrar_endosso", {
          ...base,
          _forma: pago ? f.forma : "",
          _parcelas: pago ? Number(f.parcelas || 1) : null,
          _vencimento: pago ? f.vencimento || null : null,
          _veiculo: veiculo,
          _dados: dados,
        });
      },
      form.tipo === "Cancelamento" ? "Cancelamento registrado." : "Endosso registrado.",
    );
    if (ok) setForm(null);
  }

  async function excluir(e: Endosso) {
    const ok = await confirm({
      title: "Excluir este endosso?",
      description:
        e.tipo === "Cancelamento"
          ? "A comissão do endosso será removida. A situação da apólice, das parcelas e das comissões canceladas não volta sozinha: ajuste pela edição, se precisar."
          : e.veiculo_id
            ? "A apólice volta para o veículo anterior e a franquia anterior; as parcelas e a comissão deste endosso serão removidas."
            : "As parcelas e a comissão geradas por este endosso também serão removidas.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok === false) return;
    await run(() => deleteRecord("endossos", e.id), "Endosso excluído.");
  }

  const totalPremio = lista.reduce((t, e) => t + Number(e.premio_diferenca || 0), 0);
  return (
    <div data-testid="endossos">
      {!ws.temOperacao ? (
        <AvisoMigracao />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => abrir()} disabled={a.status === "Cancelada"}>
              <FilePlus2 /> Novo endosso
            </Button>
            {auto && a.status !== "Cancelada" && (
              <Button size="sm" variant="outline" onClick={() => abrir("Troca de veículo")}>
                <Car /> Trocar veículo
              </Button>
            )}
            {a.status !== "Cancelada" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => abrir("Cancelamento")}
              >
                <Ban /> Cancelar apólice
              </Button>
            )}
            <div className="flex-1" />
            {lista.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Prêmio original {money(a.premio)} · atual{" "}
                <strong className="text-foreground">{money(premioAtual(a, ws.endossos))}</strong>
              </span>
            )}
          </div>
          {lista.length ? (
            <div className="divide-y rounded-md border">
              {lista.map((e) => {
                const det = detalhesEndosso(e, get.veiculo);
                return (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 px-3 py-2.5"
                    data-testid="endosso"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {e.tipo}
                        {e.numero && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · nº {e.numero}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Emitido {dateBR(e.data_emissao)}
                        {e.inicio_vigencia
                          ? ` · vigência a partir de ${dateBR(e.inicio_vigencia)}`
                          : ""}
                        {e.criado_por ? ` · ${get.usuarioNome(e.criado_por)}` : ""}
                      </p>
                      {det.length > 0 && (
                        <dl className="mt-1.5 grid gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr]">
                          {det.map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="font-semibold text-muted-foreground">{k}</dt>
                              <dd>{v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {e.descricao && <p className="mt-1 text-sm">{e.descricao}</p>}
                    </div>
                    <div className="text-right text-xs tabular-nums">
                      {Number(e.premio_diferenca) !== 0 && (
                        <p
                          className={cn(
                            "font-semibold",
                            Number(e.premio_diferenca) < 0 ? "text-destructive" : "text-emerald",
                          )}
                        >
                          {Number(e.premio_diferenca) > 0 ? "+" : ""}
                          {money(e.premio_diferenca)}
                        </p>
                      )}
                      {Number(e.comissao_diferenca) !== 0 && (
                        <p className="text-muted-foreground">
                          comissão {Number(e.comissao_diferenca) > 0 ? "+" : ""}
                          {money(e.comissao_diferenca)}
                        </p>
                      )}
                      <div className="mt-1.5 flex justify-end gap-1">
                        <PdfEndossoButton endossoId={e.id} />
                        {ws.isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="Excluir endosso"
                            onClick={() => void excluir(e)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {totalPremio !== 0 && (
                <p className="bg-muted/30 px-3 py-2 text-right text-xs text-muted-foreground">
                  Diferença total de prêmio: {money(totalPremio)}
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              title="Nenhum endosso"
              subtitle="Registre aqui inclusões, exclusões, trocas de veículo, mudanças de cobertura e cancelamentos."
            />
          )}
        </>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={
          form?.tipo === "Cancelamento"
            ? "Cancelamento da apólice"
            : troca
              ? "Endosso de troca de veículo"
              : "Novo endosso"
        }
        description={`${a.seguradora} ${a.numero} · ${get.clienteNome(a.cliente_id)}`}
        width="w-[min(96vw,680px)]"
        footer={
          <>
            <Button variant="outline" onClick={() => setForm(null)}>
              Voltar
            </Button>
            <Button
              variant={form?.tipo === "Cancelamento" ? "destructive" : "default"}
              onClick={() => void salvar()}
              data-testid="salvar-endosso"
            >
              {form?.tipo === "Cancelamento" ? "Registrar cancelamento" : "Registrar endosso"}
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Tipo">
              <select
                value={form.tipo}
                onChange={(e) => upd({ tipo: e.target.value })}
                className={box}
              >
                {ENDOSSO_TIPOS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Número do endosso">
              <input
                value={form.numero}
                onChange={(e) => upd({ numero: e.target.value })}
                className={box}
              />
            </Campo>
            <Campo label="Data de emissão">
              <input
                type="date"
                value={form.data}
                onChange={(e) => upd({ data: e.target.value })}
                className={box}
              />
            </Campo>
            <Campo
              label={
                form.tipo === "Cancelamento" ? "Cancelada a partir de" : "Vigência a partir de"
              }
            >
              <input
                type="date"
                value={form.inicio}
                onChange={(e) => upd({ inicio: e.target.value })}
                className={box}
              />
            </Campo>

            {troca &&
              (detalhe ? (
                <Grupo titulo="Novo veículo">
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Veículo atual: <strong>{get.veiculoNome(a.veiculo_id)}</strong>
                  </p>
                  {outrosVeiculos.length > 0 && (
                    <div className="flex gap-4 text-sm sm:col-span-2">
                      {(
                        [
                          ["novo", "Cadastrar novo veículo"],
                          ["existente", "Veículo já cadastrado do cliente"],
                        ] as const
                      ).map(([k, t]) => (
                        <label key={k} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="veiculoModo"
                            checked={form.veiculoModo === k}
                            onChange={() => upd({ veiculoModo: k })}
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                  )}
                  {form.veiculoModo === "existente" && outrosVeiculos.length > 0 ? (
                    <Campo label="Veículo" className="sm:col-span-2">
                      <select
                        value={form.veiculoId}
                        onChange={(e) => upd({ veiculoId: e.target.value })}
                        className={box}
                      >
                        {outrosVeiculos.map((v) => (
                          <option key={v.id} value={v.id}>
                            {nomeVeiculo(v)}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  ) : (
                    <>
                      <Campo label="Placa *">
                        <input
                          value={form.veiculo.placa}
                          onChange={(e) => updVeic({ placa: e.target.value.toUpperCase() })}
                          className={box}
                          placeholder="ABC1D23"
                        />
                      </Campo>
                      <Campo label="Valor FIPE (R$)">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          value={form.veiculo.valor_fipe}
                          onChange={(e) => updVeic({ valor_fipe: e.target.value })}
                          className={box}
                        />
                      </Campo>
                      <Campo label="Marca *">
                        <input
                          value={form.veiculo.marca}
                          onChange={(e) => updVeic({ marca: e.target.value })}
                          className={box}
                        />
                      </Campo>
                      <Campo label="Modelo *">
                        <input
                          value={form.veiculo.modelo}
                          onChange={(e) => updVeic({ modelo: e.target.value })}
                          className={box}
                        />
                      </Campo>
                      <Campo label="Ano de fabricação">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={form.veiculo.ano_fabricacao}
                          onChange={(e) => updVeic({ ano_fabricacao: e.target.value })}
                          className={box}
                        />
                      </Campo>
                      <Campo label="Ano modelo">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={form.veiculo.ano_modelo}
                          onChange={(e) => updVeic({ ano_modelo: e.target.value })}
                          className={box}
                        />
                      </Campo>
                      <Campo label="Chassi">
                        <input
                          value={form.veiculo.chassi}
                          onChange={(e) => updVeic({ chassi: e.target.value.toUpperCase() })}
                          className={box}
                        />
                      </Campo>
                      <Campo label="Renavam">
                        <input
                          value={form.veiculo.renavam}
                          onChange={(e) => updVeic({ renavam: e.target.value })}
                          className={box}
                        />
                      </Campo>
                      <Campo label="Combustível">
                        <select
                          value={form.veiculo.combustivel}
                          onChange={(e) => updVeic({ combustivel: e.target.value })}
                          className={box}
                        >
                          {FUELS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Campo>
                      <Campo label="Uso">
                        <select
                          value={form.veiculo.uso}
                          onChange={(e) => updVeic({ uso: e.target.value })}
                          className={box}
                        >
                          {VEHICLE_USE.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Campo>
                      <Campo label="CEP de pernoite">
                        <input
                          inputMode="numeric"
                          value={form.veiculo.cep_pernoite}
                          onChange={(e) => updVeic({ cep_pernoite: maskCep(e.target.value) })}
                          className={box}
                        />
                      </Campo>
                      <Campo label="Local de guarda">
                        <select
                          value={form.veiculo.local_guarda}
                          onChange={(e) => updVeic({ local_guarda: e.target.value })}
                          className={box}
                        >
                          <option value="">Selecione</option>
                          {GARAGE.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Campo>
                    </>
                  )}
                </Grupo>
              ) : (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground sm:col-span-2">
                  Para registrar o novo veículo, a forma de pagamento e as parcelas no endosso,
                  aplique a atualização <strong>20261013200000_endosso_detalhes</strong> no banco.
                </p>
              ))}

            <Grupo titulo={form.tipo === "Cancelamento" ? "Valores" : "Prêmio e comissão"}>
              <Campo
                label={
                  form.tipo === "Cancelamento"
                    ? "Prêmio líquido a restituir (negativo)"
                    : "Diferença de prêmio líquido (R$)"
                }
              >
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Sem IOF"
                  value={form.liquido}
                  onChange={(e) => upd({ liquido: e.target.value })}
                  className={box}
                />
                <span className="mt-1 block font-normal">
                  O total é calculado com o IOF de {iofPct.toLocaleString("pt-BR")}%
                </span>
              </Campo>
              <Campo
                label={
                  form.tipo === "Cancelamento"
                    ? "Prêmio a restituir (use valor negativo)"
                    : "Diferença de prêmio total (R$)"
                }
              >
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0,00 (negativo = restituição)"
                  value={form.premio}
                  onChange={(e) => upd({ premio: e.target.value })}
                  className={box}
                />
              </Campo>
              <Campo label="Diferença de comissão (R$)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.comissao}
                  onChange={(e) => upd({ comissao: e.target.value, comissaoManual: true })}
                  className={box}
                />
                {pct > 0 && !form.comissaoManual && (
                  <span className="mt-1 block font-normal">
                    {pct.toLocaleString("pt-BR")}% sobre o líquido de{" "}
                    {money(Number(form.liquido || 0))}
                    {imposto > 0 && ` − ${imposto.toLocaleString("pt-BR")}% de imposto retido`}
                  </span>
                )}
              </Campo>
            </Grupo>

            {temPagamento && (
              <Grupo titulo="Pagamento da diferença">
                <Campo label="Forma de pagamento">
                  <select
                    value={form.forma}
                    onChange={(e) => upd({ forma: e.target.value })}
                    className={box}
                  >
                    <option value="">Selecione</option>
                    {PAYMENT_METHODS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Parcelas">
                  <select
                    value={form.parcelas}
                    onChange={(e) => upd({ parcelas: e.target.value })}
                    className={box}
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => (
                      <option key={n} value={n}>
                        {n}x de {money(premioNum / Number(n))}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="1º vencimento">
                  <input
                    type="date"
                    value={form.vencimento}
                    onChange={(e) => upd({ vencimento: e.target.value })}
                    className={box}
                  />
                </Campo>
                <p className="self-end pb-2 text-xs font-normal text-muted-foreground">
                  As parcelas entram na aba Parcelas da apólice.
                </p>
              </Grupo>
            )}

            {detalhe && form.tipo !== "Cancelamento" && (
              <Grupo titulo="Outros dados">
                <Campo label="Nova franquia (R$)">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    placeholder={a.franquia != null ? `Atual: ${money(a.franquia)}` : ""}
                    value={form.franquia}
                    onChange={(e) => upd({ franquia: e.target.value })}
                    className={box}
                  />
                </Campo>
                {auto && (
                  <>
                    <Campo label="Condutor principal">
                      <input
                        value={form.condutor}
                        onChange={(e) => upd({ condutor: e.target.value })}
                        className={box}
                      />
                    </Campo>
                    <Campo label="Classe de bônus">
                      <input
                        inputMode="numeric"
                        value={form.classeBonus}
                        onChange={(e) => upd({ classeBonus: e.target.value })}
                        className={box}
                      />
                    </Campo>
                  </>
                )}
              </Grupo>
            )}

            <Campo
              label={form.tipo === "Cancelamento" ? "Motivo do cancelamento" : "Descrição"}
              className="sm:col-span-2"
            >
              <textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => upd({ descricao: e.target.value })}
                className="mt-1 w-full rounded-md border bg-background p-3 text-sm font-normal"
              />
            </Campo>
            {erro && (
              <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">
                {erro}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
