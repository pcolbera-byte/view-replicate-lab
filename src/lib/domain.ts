// Regras de negócio da corretora: listas de status, faixas de renovação e derivados.
import { daysUntil } from "./format";
import type { Apolice, Parcela, Tarefa } from "./data/types";

export const LEAD_STAGES = [
  "Novo",
  "Contato",
  "Qualificado",
  "Proposta",
  "Negociação",
  "Vendido",
  "Perdido",
] as const;
export const LEAD_ORIGINS = [
  "Site",
  "Google",
  "Instagram",
  "Facebook",
  "WhatsApp",
  "Indicação",
  "Cliente atual",
  "Outros",
] as const;
export const PRODUCTS = [
  "Seguro Auto",
  "Seguro Moto",
  "Seguro Caminhão",
  "Seguro Residencial",
  "Seguro Vida",
  "Seguro Empresarial",
  "Outros",
] as const;
export const RAMOS = [
  "Auto",
  "Moto",
  "Caminhão",
  "Residencial",
  "Condomínio",
  "Empresarial",
  "Vida",
  "Saúde",
  "Previdência",
  "Responsabilidade civil",
  "Equipamentos",
  "Riscos de engenharia",
  "Fiança locatícia",
  "Viagem",
  "Funeral",
  "Capitalização",
  "Celular",
  "Outros",
] as const;
export const POLICY_STATUS = ["Vigente", "Renovada", "Cancelada", "Encerrada"] as const;
export const RENEWAL_STATUS = ["Pendente", "Em negociação", "Renovada", "Não renovada"] as const;
export const INSTALLMENT_STATUS = ["Pendente", "Pago", "Atrasado", "Cancelado"] as const;
export const COMMISSION_STATUS = ["Prevista", "Recebida", "Cancelada"] as const;
export const TASK_TYPES = [
  "Ligação",
  "WhatsApp",
  "E-mail",
  "Documento",
  "Renovação",
  "Pós-venda",
  "Sinistro",
  "Outro",
] as const;
export const TASK_STATUS = ["Pendente", "Concluído", "Adiado", "Cancelado"] as const;
export const TASK_PRIORITY = ["Baixa", "Normal", "Alta", "Urgente"] as const;
export const CONTACT_TYPES = ["WhatsApp", "Ligação", "E-mail", "Presencial", "Outro"] as const;
export const CLAIM_STATUS = [
  "Aberto",
  "Documentação",
  "Em análise",
  "Autorizado",
  "Em reparo",
  "Finalizado",
] as const;
export const CLAIM_TYPES = [
  "Colisão",
  "Roubo",
  "Furto",
  "Vidros",
  "Incêndio",
  "Fenômeno natural",
  "Terceiros",
  "Assistência",
  "Outro",
] as const;
export const VEHICLE_TYPES = ["Automóvel", "Moto", "Caminhão", "Utilitário", "Outro"] as const;
export const FUELS = [
  "Flex",
  "Gasolina",
  "Etanol",
  "Diesel",
  "Elétrico",
  "Híbrido",
  "GNV",
] as const;
export const VEHICLE_USE = ["Particular", "Comercial", "Aplicativo", "Táxi", "Outro"] as const;
export const GARAGE = [
  "Garagem fechada",
  "Estacionamento pago",
  "Rua",
  "Condomínio",
  "Outro",
] as const;
export const MARITAL = [
  "Solteiro(a)",
  "Casado(a)",
  "União estável",
  "Divorciado(a)",
  "Viúvo(a)",
] as const;
export const PAYMENT_METHODS = [
  "Cartão de crédito",
  "Boleto",
  "Débito em conta",
  "Pix",
  "Carnê",
] as const;
export const UF = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export const DOC_CATEGORIES = [
  "Apólice",
  "Proposta",
  "CNH",
  "CRLV",
  "Documento pessoal",
  "Comprovante de residência",
  "Boletim de ocorrência",
  "Fotos",
  "Orçamento",
  "Outro",
] as const;

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

export function statusTone(status?: string | null): Tone {
  switch (status) {
    case "Vigente":
    case "Vendido":
    case "Concluído":
    case "Finalizado":
    case "Pago":
    case "Recebida":
    case "Renovada":
    case "Autorizado":
      return "good";
    case "Perdido":
    case "Cancelada":
    case "Cancelado":
    case "Atrasado":
    case "Não renovada":
    case "Urgente":
    case "Vencida":
      return "bad";
    case "Proposta":
    case "Negociação":
    case "Em negociação":
    case "Em análise":
    case "Em reparo":
    case "Adiado":
    case "Alta":
    case "Prevista":
      return "warn";
    case "Novo":
    case "Aberto":
    case "Contato":
    case "Qualificado":
    case "Documentação":
      return "info";
    default:
      return "neutral";
  }
}

// ---------- Renovações (derivadas da apólice, sem registros duplicados) ----------
export type RenewalBucket = "vencidas" | "0-7" | "8-15" | "16-30" | "31-60" | "61+";
export const RENEWAL_BUCKETS: {
  key: RenewalBucket;
  label: string;
  min: number;
  max: number;
  tone: Tone;
  dot: string;
}[] = [
  {
    key: "vencidas",
    label: "Vencidas",
    min: -9999,
    max: -1,
    tone: "neutral",
    dot: "bg-foreground",
  },
  { key: "0-7", label: "0–7 dias", min: 0, max: 7, tone: "bad", dot: "bg-destructive" },
  { key: "8-15", label: "8–15 dias", min: 8, max: 15, tone: "warn", dot: "bg-orange" },
  { key: "16-30", label: "16–30 dias", min: 16, max: 30, tone: "warn", dot: "bg-warning" },
  { key: "31-60", label: "31–60 dias", min: 31, max: 60, tone: "info", dot: "bg-info" },
  { key: "61+", label: "Mais de 60 dias", min: 61, max: 180, tone: "info", dot: "bg-info/50" },
];

export function renewalBucket(vencimento: string): RenewalBucket | null {
  const d = daysUntil(vencimento);
  return RENEWAL_BUCKETS.find((b) => d >= b.min && d <= b.max)?.key ?? null;
}

/** Apólices que ainda precisam de ação de renovação dentro da janela de alerta. */
export function isOpenRenewal(a: Apolice, alertDays: number): boolean {
  if (a.status !== "Vigente") return false;
  if (a.renovacao_status === "Renovada" || a.renovacao_status === "Não renovada") return false;
  const d = daysUntil(a.vencimento);
  return d <= alertDays && d >= -60;
}

/** Status efetivo da parcela: pendente com vencimento passado vira "Atrasado". */
export function installmentStatus(p: Parcela): string {
  if (p.status === "Pendente" && daysUntil(p.vencimento) < 0) return "Atrasado";
  return p.status;
}

export function isOpenTask(t: Tarefa): boolean {
  return t.status === "Pendente" || t.status === "Adiado";
}

export function commissionOf(
  a: Pick<Apolice, "premio" | "comissao_percentual" | "comissao_valor">,
): number {
  if (a.comissao_valor != null) return Number(a.comissao_valor);
  return Math.round(Number(a.premio || 0) * Number(a.comissao_percentual || 0)) / 100;
}

export function isDemoName(name?: string | null): boolean {
  return (name || "").startsWith("[DEMO]");
}

/** Situação efetiva: apólice "Vigente" com fim de vigência no passado aparece como "Vencida". */
export function policyStatus(a: Pick<Apolice, "status" | "vencimento">): string {
  if (a.status === "Vigente" && daysUntil(a.vencimento) < 0) return "Vencida";
  return a.status;
}

export function isActivePolicy(a: Pick<Apolice, "status" | "vencimento">): boolean {
  return policyStatus(a) === "Vigente";
}
