import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/panel";
import { useWorkspace, type FormRequest } from "@/components/app/workspace-context";
import { FEMININE, FORM_FIELDS, FORM_TITLES, defaultsFor, type Field } from "./fields";
import {
  deleteRecord,
  rpc,
  rpcSemTipos,
  saveCoberturas,
  saveRateio,
  saveRecord,
} from "@/lib/data/workspace";
import type { FormValues } from "@/lib/data/types";
import {
  addYears,
  maskCep,
  maskDocument,
  maskPhone,
  maskPlate,
  money,
  onlyDigits,
  todayISO,
} from "@/lib/format";
import { validateDocument, validateEmail, validatePhone, validatePlate } from "@/lib/validation";
import {
  FUELS,
  GARAGE,
  VEHICLE_USE,
  aliquotaIOF,
  commissionOf,
  impostoComissao,
  liquidoInformado,
  premioLiquido,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { CAMPOS_RAMO, grupoDoRamo } from "@/lib/ramos";

/** Prefixo dos campos do ramo no formulário (gravados juntos em apolices.dados_ramo). */
const RAMO = "ramo:";

/** Campos do ramo escolhido, no formato dos campos do formulário. */
function camposDoRamo(ramo: unknown): Field[] {
  const lista = CAMPOS_RAMO[grupoDoRamo(String(ramo ?? ""))];
  if (!lista.length) return [];
  return [
    { key: "_dados_ramo", label: `Dados do seguro ${String(ramo ?? "")}`.trim(), type: "section" },
    ...lista.map((c): Field => ({
      key: `${RAMO}${c.key}`,
      label: c.label,
      type: c.type === "money" ? "money" : (c.type ?? "text"),
      options: c.options,
      wide: c.wide,
      hint: c.hint,
    })),
  ];
}

const NULLABLE_TYPES = new Set([
  "date",
  "time",
  "number",
  "money",
  "percent",
  "cliente",
  "lead",
  "veiculo",
  "apolice",
  "seguradora",
  "usuario",
  "produtor",
]);
const PRODUTOR_TABLES = new Set(["clientes", "leads", "apolices", "comissoes"]);

type RateioLinha = { produtor_id: string; percentual: number };
const NUMERIC_TYPES = new Set(["number", "money", "percent"]);
const OTHER = "__outra__";

/** Veículo cadastrado junto com a apólice. */
const NOVO_VEICULO = "__novo_veiculo__";
const NV = "novoveic:";
const CAMPOS_NOVO_VEICULO: Field[] = [
  { key: "_novo_veiculo", label: "Dados do veículo", type: "section" },
  { key: `${NV}placa`, label: "Placa", type: "plate", required: true },
  { key: `${NV}valor_fipe`, label: "Valor FIPE (R$)", type: "money" },
  { key: `${NV}marca`, label: "Marca", required: true },
  { key: `${NV}modelo`, label: "Modelo", required: true },
  { key: `${NV}ano_fabricacao`, label: "Ano de fabricação", type: "number" },
  { key: `${NV}ano_modelo`, label: "Ano modelo", type: "number" },
  { key: `${NV}chassi`, label: "Chassi" },
  { key: `${NV}renavam`, label: "Renavam" },
  { key: `${NV}combustivel`, label: "Combustível", type: "select", options: FUELS },
  { key: `${NV}uso`, label: "Uso", type: "select", options: VEHICLE_USE },
  { key: `${NV}cep_pernoite`, label: "CEP de pernoite", type: "cep" },
  { key: `${NV}local_guarda`, label: "Local de guarda", type: "select", options: GARAGE },
];

/** Ramo de veículo e cliente sem veículo cadastrado: já abre os campos do veículo. */
function sugerirNovoVeiculo(v: FormValues, veiculos: { cliente_id: string }[]) {
  if (grupoDoRamo(String(v["ramo"] ?? "")) !== "auto") {
    if (v["veiculo_id"] === NOVO_VEICULO) v["veiculo_id"] = null;
    return;
  }
  if (!v["cliente_id"]) return;
  if (!v["veiculo_id"] && !veiculos.some((x) => x.cliente_id === v["cliente_id"]))
    v["veiculo_id"] = NOVO_VEICULO;
}

const VALORES = new Set([
  "premio_liquido",
  "adicional_fracionamento",
  "custo_apolice",
  "iof",
  "ramo",
  "premio",
]);
const PREMIO_LIQ_CAMPOS = new Set([
  "premio_liquido",
  "adicional_fracionamento",
  "custo_apolice",
  "iof",
]);
const numOu0 = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);
const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const centavos = (v: number) => Math.round(v * 100) / 100;

/** Prêmio líquido informado: calcula o IOF (pela alíquota do ramo) e o prêmio total
 * (líquido + adicional + custo de apólice + IOF). O IOF digitado à mão é respeitado; o total
 * pode ser ajustado depois, à mão. */
function recalcularValores(next: FormValues, key: string) {
  if (key === "iof") next["_iof_manual"] = !vazio(next["iof"]);
  if (key === "premio") return;
  if (vazio(next["premio_liquido"])) return;
  const base =
    numOu0(next["premio_liquido"]) +
    numOu0(next["adicional_fracionamento"]) +
    numOu0(next["custo_apolice"]);
  if (!next["_iof_manual"])
    next["iof"] = centavos((base * aliquotaIOF(String(next["ramo"] ?? ""))) / 100);
  next["premio"] = centavos(base + numOu0(next["iof"]));
}

export function RecordForm({ req, onClose }: { req: FormRequest; onClose: () => void }) {
  const { ws, get, run } = useWorkspace();
  const { table, id } = req;
  const existing = useMemo(
    () => (id ? (ws[table] as { id: string }[]).find((r) => r.id === id) : undefined),
    [ws, table, id],
  );
  const [values, setValues] = useState<FormValues>(() => {
    const base = existing
      ? { ...(existing as unknown as FormValues) }
      : defaultsFor(table, ws.userId, todayISO());
    const merged = { ...base, ...req.initial };
    if (table === "apolices") {
      const dados = (existing as { dados_ramo?: Record<string, unknown> | null } | undefined)
        ?.dados_ramo;
      for (const [k, v] of Object.entries(dados ?? {}))
        if (v === null || ["string", "number", "boolean"].includes(typeof v))
          merged[`${RAMO}${k}`] = v as string | number | boolean | null;
    }
    if (table === "apolices" && !existing) sugerirNovoVeiculo(merged, ws.veiculos);
    if (table === "apolices" && merged["seguradora_id"] == null && merged["seguradora"])
      merged["seguradora_id"] = OTHER;
    // Produtor padrão: o vinculado ao usuário ou, na falta, a própria corretora.
    if (
      ws.temProdutores &&
      !existing &&
      PRODUTOR_TABLES.has(table) &&
      merged["produtor_id"] === undefined
    )
      merged["produtor_id"] = get.produtorPadrao;
    return merged;
  });
  const [rateio, setRateio] = useState<RateioLinha[]>(
    () => req.rateio ?? (id && table === "apolices" ? get.rateio(id) : []),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const set = (key: string, value: FormValues[string]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // Regras de preenchimento automático
      if (key === "cliente_id" && prev["cliente_id"] !== value) {
        if (next["veiculo_id"] && get.veiculo(String(next["veiculo_id"]))?.cliente_id !== value)
          next["veiculo_id"] = null;
        if (next["apolice_id"] && get.apolice(String(next["apolice_id"]))?.cliente_id !== value)
          next["apolice_id"] = null;
      }
      if (table === "apolices" && key === "inicio" && typeof value === "string" && value) {
        const prevAuto =
          typeof prev["inicio"] === "string" && prev["inicio"] ? addYears(prev["inicio"], 1) : "";
        if (!prev["vencimento"] || prev["vencimento"] === prevAuto)
          next["vencimento"] = addYears(value, 1);
      }
      if (table === "apolices" && VALORES.has(key)) recalcularValores(next, key);
      if (table === "apolices" && (key === "cliente_id" || key === "ramo"))
        sugerirNovoVeiculo(next, ws.veiculos);
      if (key === "veiculo_id" && value && !next["cliente_id"])
        next["cliente_id"] = get.veiculo(String(value))?.cliente_id ?? null;
      if (key === "apolice_id" && value && table === "sinistros") {
        const a = get.apolice(String(value));
        if (a) {
          next["cliente_id"] = a.cliente_id;
          if (!next["veiculo_id"]) next["veiculo_id"] = a.veiculo_id;
        }
      }
      return next;
    });
    setErrors((e) => {
      const { [key]: _, ...rest } = e;
      return rest;
    });
  };

  // CEP → endereço (ViaCEP), apenas no cadastro de cliente
  const cep = onlyDigits(String(values["cep"] ?? ""));
  useEffect(() => {
    if (table !== "clientes" || cep.length !== 8) return;
    if (existing && onlyDigits((existing as { cep?: string | null | undefined }).cep) === cep)
      return;
    let cancelled = false;
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then((r) => r.json())
      .then(
        (d: {
          erro?: boolean | undefined;
          logradouro?: string | undefined;
          bairro?: string | undefined;
          localidade?: string | undefined;
          uf?: string | undefined;
        }) => {
          if (cancelled || d.erro) return;
          setValues((v) => ({
            ...v,
            endereco: d.logradouro || v["endereco"],
            bairro: d.bairro || v["bairro"],
            cidade: d.localidade || v["cidade"],
            estado: d.uf || v["estado"],
          }));
        },
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [cep, table, existing]);

  const baseFields =
    table === "apolices"
      ? FORM_FIELDS[table].flatMap((f) =>
          f.key === "veiculo_id" && values["veiculo_id"] === NOVO_VEICULO
            ? [f, ...CAMPOS_NOVO_VEICULO]
            : f.key === "vencimento" && ws.temOperacao
              ? [f, ...camposDoRamo(values["ramo"])]
              : [f],
        )
      : FORM_FIELDS[table];
  const fields = baseFields
    .filter(
      (f) =>
        (!f.show || f.show(values)) &&
        (!f.createOnly || !id) &&
        // Antes da migração de produtores, esses campos não existem no banco.
        (ws.temProdutores ||
          (f.type !== "produtor" && f.type !== "rateio" && f.key !== "usuario_id")) &&
        (ws.temPremioLiquido || table !== "apolices" || !PREMIO_LIQ_CAMPOS.has(f.key)),
    )
    .map((f) =>
      table === "apolices" && f.key === "iof"
        ? {
            ...f,
            label: `IOF ${aliquotaIOF(String(values["ramo"] ?? "")).toLocaleString("pt-BR")}% (R$)`,
            hint: values["_iof_manual"] ? "Valor informado" : "Calculado pelo ramo; pode ajustar",
          }
        : f,
    );

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    for (const f of fields) {
      if (f.type === "section" || f.type === "checkbox") continue;
      const raw = values[f.key];
      const v = raw == null ? "" : String(raw).trim();
      if (f.required && !v && !(f.type === "seguradora" && values["seguradora"])) {
        e[f.key] = "Campo obrigatório";
        continue;
      }
      if (!v) continue;
      const msg =
        f.type === "document"
          ? validateDocument(v)
          : f.type === "tel"
            ? validatePhone(v)
            : f.type === "email"
              ? validateEmail(v)
              : f.type === "plate"
                ? validatePlate(v)
                : f.type === "cep" && onlyDigits(v).length !== 8
                  ? "CEP com 8 dígitos"
                  : NUMERIC_TYPES.has(f.type ?? "") && Number(v) < 0
                    ? "Valor não pode ser negativo"
                    : null;
      if (msg) e[f.key] = msg;
    }
    if (
      table === "apolices" &&
      values["inicio"] &&
      values["vencimento"] &&
      String(values["vencimento"]) <= String(values["inicio"])
    )
      e["vencimento"] = "Deve ser posterior ao início";
    if (table === "apolices") {
      const n = Number(values["parcelas_qtd"] || 0);
      if (values["parcelas_qtd"] && (n < 1 || n > 24 || !Number.isInteger(n)))
        e["parcelas_qtd"] = "Entre 1 e 24";
      if (values["seguradora_id"] === OTHER && !String(values["seguradora"] ?? "").trim())
        e["seguradora_id"] = "Informe o nome da seguradora";
    }
    if (table === "apolices" && rateio.length) {
      const total = rateio.reduce((t, r) => t + (Number(r.percentual) || 0), 0);
      const ids = rateio.map((r) => r.produtor_id);
      if (ids.some((x) => !x)) e["_rateio"] = "Escolha o produtor de cada linha";
      else if (new Set(ids).size !== ids.length) e["_rateio"] = "Produtor repetido no rateio";
      else if (Math.abs(total - 100) > 0.01)
        e["_rateio"] = `A soma deve ser 100% (está em ${total.toLocaleString("pt-BR")}%)`;
    }
    if (table === "veiculos") {
      const max = new Date().getFullYear() + 1;
      for (const k of ["ano_fabricacao", "ano_modelo"]) {
        const n = Number(values[k] || 0);
        if (values[k] && (n < 1950 || n > max)) e[k] = `Ano entre 1950 e ${max}`;
      }
    }
    return e;
  }

  function payload(): FormValues {
    const out: FormValues = {};
    const byKey = new Map<string, Field>();
    for (const f of FORM_FIELDS[table]) if (!byKey.has(f.key)) byKey.set(f.key, f);
    for (const [key, raw] of Object.entries(values)) {
      if (
        key.startsWith("_") ||
        key.startsWith(RAMO) ||
        key.startsWith(NV) ||
        key === "dados_ramo" ||
        ["id", "empresa_id", "created_at", "updated_at"].includes(key)
      )
        continue;
      const f = byKey.get(key);
      if (!f) {
        if (existing || req.initial?.[key] !== undefined) out[key] = raw;
        continue;
      }
      const t = f.type ?? "text";
      if (typeof raw === "string" && raw.trim() === "")
        out[key] = NULLABLE_TYPES.has(t) ? null : "";
      else if (NUMERIC_TYPES.has(t) && raw != null) out[key] = Number(raw);
      else if (t === "plate" && typeof raw === "string") out[key] = maskPlate(raw);
      else out[key] = raw;
    }
    if (table === "apolices") {
      if (values["seguradora_id"] === OTHER) {
        out["seguradora_id"] = null;
        out["seguradora"] = String(values["seguradora"] ?? "").trim();
      } else if (values["seguradora_id"])
        out["seguradora"] =
          get.seguradora(String(values["seguradora_id"]))?.nome ??
          String(values["seguradora"] ?? "");
      out["premio"] = Number(values["premio"] || 0);
      if (ws.temOperacao) {
        const tipos = new Map(camposDoRamo(values["ramo"]).map((f) => [f.key, f.type]));
        const dados: Record<string, string | number> = {};
        for (const [key, raw] of Object.entries(values)) {
          if (!key.startsWith(RAMO) || raw === null || raw === undefined) continue;
          const v = typeof raw === "string" ? raw.trim() : raw;
          if (v === "" || typeof v === "boolean") continue;
          const t = tipos.get(key);
          dados[key.slice(RAMO.length)] =
            (t === "money" || t === "number") && !Number.isNaN(Number(v)) ? Number(v) : v;
        }
        out["dados_ramo"] = dados as unknown as string;
      }
    }
    if (table === "historico_contatos" && !id) out["usuario_id"] = ws.userId;
    return out;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Revise os campos destacados.");
      return;
    }
    setBusy(true);
    setFormError("");
    let savedId = "";
    const ok = await run(
      async () => {
        const dados = payload();
        if (table === "apolices" && values["veiculo_id"] === NOVO_VEICULO) {
          const v = (k: string) => {
            const x = values[`${NV}${k}`];
            return x === undefined || x === null || String(x).trim() === "" ? null : x;
          };
          const num = (k: string) => (v(k) === null ? null : Number(v(k)));
          dados["veiculo_id"] = await saveRecord(
            "veiculos",
            {
              cliente_id: values["cliente_id"],
              placa: maskPlate(String(v("placa") ?? "")),
              marca: String(v("marca") ?? "").trim(),
              modelo: String(v("modelo") ?? "").trim(),
              ano_fabricacao: num("ano_fabricacao"),
              ano_modelo: num("ano_modelo"),
              valor_fipe: num("valor_fipe"),
              chassi: String(v("chassi") ?? "")
                .trim()
                .toUpperCase(),
              renavam: String(v("renavam") ?? "").trim(),
              combustivel: v("combustivel"),
              uso: v("uso"),
              cep_pernoite: v("cep_pernoite"),
              local_guarda: v("local_guarda"),
              tipo:
                values["ramo"] === "Moto"
                  ? "Moto"
                  : values["ramo"] === "Caminhão"
                    ? "Caminhão"
                    : "Automóvel",
            },
            ws.empresa.id,
          );
        }
        savedId = await saveRecord(table, dados, ws.empresa.id, id);
        // O rateio precisa existir antes de gerar as comissões (uma por produtor).
        if (table === "apolices" && ws.temProdutores) {
          const antes = id ? get.rateio(id) : [];
          if (JSON.stringify(antes) !== JSON.stringify(rateio))
            await saveRateio(savedId, ws.empresa.id, rateio);
        }
        // Valores mudaram numa apólice existente: atualiza as comissões ainda previstas.
        if (table === "apolices" && id && ws.isAdmin && ws.temPremioLiquido) {
          const antes = existing as Record<string, unknown> | undefined;
          const depois = payload();
          const mudou = [
            "premio",
            "premio_liquido",
            "iof",
            "adicional_fracionamento",
            "custo_apolice",
            "comissao_percentual",
            "comissao_valor",
            "ramo",
          ].some((k) => String(antes?.[k] ?? "") !== String(depois[k] ?? ""));
          if (mudou) await rpcSemTipos("recalcular_comissoes", { _apolice: id });
        }
        if (table === "apolices" && !id && req.copiarCoberturasDe && ws.temOperacao) {
          const cob = ws.coberturas.filter((c) => c.apolice_id === req.copiarCoberturasDe);
          if (cob.length) await saveCoberturas(savedId, ws.empresa.id, cob);
        }
        if (
          table === "apolices" &&
          !id &&
          values["_gerar_parcelas"] &&
          Number(values["premio"] || 0) > 0
        ) {
          await rpc("gerar_parcelas", { _apolice_id: savedId });
        }
      },
      id
        ? "Alterações salvas."
        : `${cap(FORM_TITLES[table])} cadastrad${FEMININE[table] ? "a" : "o"}.`,
    );
    setBusy(false);
    if (ok) {
      req.onSaved?.(savedId);
      onClose();
    }
  }

  async function remove() {
    if (!id) return;
    const ok = await run(() => deleteRecord(table, id), "Registro excluído.");
    if (ok) onClose();
  }

  const noun = FORM_TITLES[table];
  const title = req.title ?? `${id ? "Editar" : FEMININE[table] ? "Nova" : "Novo"} ${noun}`;
  const canDelete =
    !!id &&
    (ws.isAdmin ||
      (table === "tarefas" &&
        (existing as { responsavel_id?: string | null | undefined } | undefined)?.responsavel_id ===
          ws.userId));

  return (
    <Panel
      open
      onClose={onClose}
      eyebrow="Cadastro"
      title={title}
      footer={
        <div className="flex items-center gap-2">
          {canDelete && <DeleteButton onConfirm={remove} />}
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="record-form" disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <form
        id="record-form"
        onSubmit={submit}
        noValidate
        className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
      >
        {fields.map((f, i) =>
          f.type === "rateio" ? (
            <RateioEditor
              key={f.key}
              field={f}
              linhas={rateio}
              principal={values["produtor_id"] ? String(values["produtor_id"]) : ""}
              editando={!!id}
              error={errors["_rateio"]}
              onChange={(l) => {
                setRateio(l);
                setErrors(({ _rateio: _, ...rest }) => rest);
              }}
            />
          ) : (
            <FieldInput
              key={`${f.key}-${i}`}
              field={f}
              values={values}
              set={set}
              error={errors[f.key]}
            />
          ),
        )}
        {table === "apolices" && (
          <CommissionPreview
            values={values}
            sobreLiquido={ws.temPremioLiquido}
            imposto={impostoComissao(ws.empresa)}
          />
        )}
        {formError && (
          <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">
            {formError}
          </p>
        )}
      </form>
    </Panel>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <Button type="button" variant="destructive" onClick={onConfirm}>
      <Trash2 /> Confirmar exclusão
    </Button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      className="text-destructive"
      onClick={() => setArmed(true)}
    >
      <Trash2 /> Excluir
    </Button>
  );
}

function CommissionPreview({
  values,
  sobreLiquido,
  imposto,
}: {
  values: FormValues;
  sobreLiquido: boolean;
  imposto: number;
}) {
  const premio = Number(values["premio"] || 0);
  if (!premio) return null;
  const num = (k: string) =>
    values[k] === "" || values[k] == null || Number.isNaN(Number(values[k]))
      ? null
      : Number(values[k]);
  const a = {
    premio,
    ramo: String(values["ramo"] ?? ""),
    premio_liquido: num("premio_liquido"),
    iof: num("iof"),
    adicional_fracionamento: num("adicional_fracionamento"),
    custo_apolice: num("custo_apolice"),
    comissao_percentual: num("comissao_percentual") ?? 0,
    comissao_valor: num("comissao_valor"),
  };
  // Antes da atualização do banco, as comissões ainda são geradas sobre o prêmio total.
  const total = sobreLiquido
    ? commissionOf(a, imposto)
    : (a.comissao_valor ?? Math.round(premio * (a.comissao_percentual ?? 0)) / 100);
  const base = sobreLiquido ? premioLiquido(a) : premio;
  const pct = a.comissao_percentual;
  const n = Number(values["parcelas_qtd"] || 1) || 1;
  return (
    <div
      className="space-y-1 rounded-md bg-secondary/60 p-3 text-sm sm:col-span-2"
      data-testid="previa-comissao"
    >
      <p>
        Comissão prevista: <strong>{money(total)}</strong>
        {a.comissao_valor == null && pct > 0 && (
          <span className="text-muted-foreground">
            {" "}
            = {pct.toLocaleString("pt-BR")}% sobre o prêmio {sobreLiquido ? "líquido" : "total"} de{" "}
            {money(base)}
            {imposto > 0 && ` − ${imposto.toLocaleString("pt-BR")}% de imposto retido`}
          </span>
        )}
      </p>
      {!sobreLiquido && (
        <p className="text-xs text-muted-foreground">
          Para calcular sobre o prêmio líquido (sem IOF), aplique a atualização do banco
          20261013230000_premio_liquido.
        </p>
      )}
      {sobreLiquido && a.comissao_valor == null && !liquidoInformado(a) && (
        <p className="text-xs text-muted-foreground">
          Prêmio líquido estimado tirando o IOF de {aliquotaIOF(a.ramo).toLocaleString("pt-BR")}% do
          prêmio total. Informe o prêmio líquido da apólice para o valor exato.
        </p>
      )}
      {n > 1 && (
        <p className="text-xs text-muted-foreground">
          {n} parcelas de {money(premio / n)} para o cliente
        </p>
      )}
    </div>
  );
}

function RateioEditor({
  field: f,
  linhas,
  principal,
  editando,
  error,
  onChange,
}: {
  field: Field;
  linhas: RateioLinha[];
  principal: string;
  editando: boolean;
  error?: string | undefined;
  onChange: (l: RateioLinha[]) => void;
}) {
  const { ws } = useWorkspace();
  const opts = ws.produtores.filter((p) => p.ativo || linhas.some((l) => l.produtor_id === p.id));
  const total = linhas.reduce((t, r) => t + (Number(r.percentual) || 0), 0);
  const upd = (i: number, patch: Partial<RateioLinha>) =>
    onChange(linhas.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const box = "h-10 rounded-md border bg-background px-2 text-sm font-normal";
  return (
    <div className="text-sm sm:col-span-2" data-testid="rateio">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{f.label}</span>
        {linhas.length === 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const outro = opts.find((p) => p.id !== principal)?.id ?? "";
              onChange([
                { produtor_id: principal, percentual: 50 },
                { produtor_id: outro, percentual: 50 },
              ]);
            }}
          >
            Dividir comissão
          </Button>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
            Sem rateio
          </Button>
        )}
      </div>
      {linhas.length > 0 && (
        <div className="mt-2 space-y-2">
          {linhas.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_2.5rem] items-center gap-2">
              <select
                aria-label={`Produtor ${i + 1}`}
                value={l.produtor_id}
                onChange={(e) => upd(i, { produtor_id: e.target.value })}
                className={box}
              >
                <option value="">Selecione</option>
                {opts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Percentual ${i + 1}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                value={l.percentual}
                onChange={(e) => upd(i, { percentual: Number(e.target.value) })}
                className={box}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remover linha"
                onClick={() => onChange(linhas.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange([...linhas, { produtor_id: "", percentual: 0 }])}
            >
              <Plus /> Produtor
            </Button>
            <span
              className={cn(
                "tabular-nums",
                Math.abs(total - 100) > 0.01 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              Total {total.toLocaleString("pt-BR")}%
            </span>
          </div>
        </div>
      )}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>
      ) : (
        <span className="mt-1 block text-xs text-muted-foreground">
          {editando && linhas.length
            ? "Vale para as comissões geradas daqui em diante; as já lançadas não mudam."
            : f.hint}
        </span>
      )}
    </div>
  );
}

function FieldInput({
  field: f,
  values,
  set,
  error,
}: {
  field: Field;
  values: FormValues;
  set: (k: string, v: FormValues[string]) => void;
  error?: string | undefined;
}) {
  const { ws, get } = useWorkspace();
  const t = f.type ?? "text";
  const raw = values[f.key];
  const value = raw == null ? "" : String(raw);
  const base = cn(
    "mt-1.5 h-11 w-full rounded-md border bg-background px-3 text-sm font-normal",
    error && "border-destructive",
  );

  if (t === "section")
    return (
      <h3 className="mt-3 border-t pt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground sm:col-span-2">
        {f.label}
      </h3>
    );
  if (t === "checkbox") {
    return (
      <label
        className={cn("flex items-center gap-2.5 text-sm font-medium", f.wide && "sm:col-span-2")}
      >
        <input
          type="checkbox"
          checked={!!raw}
          onChange={(e) => set(f.key, e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        {f.label}
      </label>
    );
  }

  let control;
  const refOptions = (() => {
    switch (t) {
      case "cliente":
        return [...ws.clientes]
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map((c) => ({
            value: c.id,
            label: `${c.nome}${c.documento ? ` · ${c.documento}` : ""}`,
          }));
      case "lead":
        return ws.leads
          .filter((l) => !l.cliente_id || l.id === raw)
          .map((l) => ({ value: l.id, label: l.nome }));
      case "veiculo":
        return ws.veiculos
          .filter((v) => !values["cliente_id"] || v.cliente_id === values["cliente_id"])
          .map((v) => ({ value: v.id, label: `${v.placa} · ${v.marca} ${v.modelo}` }));
      case "apolice":
        return ws.apolices
          .filter((a) => !values["cliente_id"] || a.cliente_id === values["cliente_id"])
          .map((a) => ({
            value: a.id,
            label: `${a.numero} · ${a.seguradora} · ${get.clienteNome(a.cliente_id)}`,
          }));
      case "produtor":
        return ws.produtores
          .filter((p) => p.ativo || p.id === raw)
          .map((p) => ({
            value: p.id,
            label: p.tipo === "Corretora" ? `${p.nome} (corretora)` : p.nome,
          }));
      case "usuario":
        return ws.profiles
          .filter((p) => p.ativo || p.id === raw)
          .map((p) => ({ value: p.id, label: p.nome || p.email }));
      case "seguradora":
        return [
          ...ws.seguradoras
            .filter((s) => s.ativo || s.id === raw)
            .map((s) => ({ value: s.id, label: s.nome })),
          { value: OTHER, label: "Outra (digitar nome)…" },
        ];
      default:
        return null;
    }
  })();

  if (t === "textarea") {
    control = (
      <textarea
        value={value}
        rows={3}
        onChange={(e) => set(f.key, e.target.value)}
        className={cn(base, "h-auto py-2.5")}
      />
    );
  } else if (t === "select" || refOptions) {
    const opts = refOptions ?? (f.options ?? []).map((o) => ({ value: o, label: o }));
    control = (
      <select value={value} onChange={(e) => set(f.key, e.target.value)} className={base}>
        <option value="">
          {t === "veiculo" && !values["cliente_id"] ? "Selecione o cliente primeiro…" : "Selecione"}
        </option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {t === "veiculo" && f.permiteNovo && values["cliente_id"] && (
          <option value={NOVO_VEICULO}>+ Cadastrar novo veículo</option>
        )}
      </select>
    );
  } else {
    const mask =
      t === "document"
        ? maskDocument
        : t === "tel"
          ? maskPhone
          : t === "cep"
            ? maskCep
            : t === "plate"
              ? maskPlate
              : null;
    control = (
      <input
        value={value}
        onChange={(e) => set(f.key, mask ? mask(e.target.value) : e.target.value)}
        type={
          t === "money" || t === "percent"
            ? "number"
            : ["document", "cep", "plate", "tel"].includes(t)
              ? "text"
              : t
        }
        inputMode={
          t === "money" || t === "percent"
            ? "decimal"
            : t === "tel" || t === "document" || t === "cep"
              ? "numeric"
              : undefined
        }
        step={t === "money" ? "0.01" : t === "percent" ? "0.01" : t === "number" ? "1" : undefined}
        min={NUMERIC_TYPES.has(t) ? 0 : undefined}
        placeholder={
          f.placeholder ?? (t === "plate" ? "ABC1D23" : t === "tel" ? "(11) 99999-9999" : undefined)
        }
        autoComplete="off"
        className={base}
      />
    );
  }

  return (
    <label
      className={cn("block text-sm font-semibold", (f.wide || t === "textarea") && "sm:col-span-2")}
    >
      {f.label}
      {f.required && <span className="text-destructive"> *</span>}
      {control}
      {t === "seguradora" && raw === OTHER && (
        <input
          value={String(values["seguradora"] ?? "")}
          onChange={(e) => set("seguradora", e.target.value)}
          placeholder="Nome da seguradora"
          className={cn(base, "mt-2")}
        />
      )}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>
      ) : (
        f.hint && (
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{f.hint}</span>
        )
      )}
    </label>
  );
}
