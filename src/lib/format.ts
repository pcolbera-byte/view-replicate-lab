// Formatação e utilitários de data/texto — sem dependência de banco.

export function money(value: number | string | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0),
  );
}

export function percent(value: number | string | null | undefined): string {
  return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Data ISO (yyyy-mm-dd) → dd/mm/aaaa */
export function dateBR(value?: string | null): string {
  if (!value) return "—";
  const d = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export function dateTimeBR(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function relativeTime(value?: string | null): string {
  if (!value) return "";
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  return days === 1 ? "ontem" : days < 30 ? `há ${days} dias` : dateBR(value);
}

/** yyyy-mm-dd de hoje no fuso local */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addYears(iso: string, years: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return toISODate(d);
}

/** Dias corridos entre hoje e a data (negativo = passou). */
export function daysUntil(iso?: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const target = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function onlyDigits(value?: string | null): string {
  return (value || "").replace(/\D/g, "");
}

export function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function maskDocument(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function maskPlate(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

export function firstName(name?: string | null): string {
  return (
    (name || "")
      .replace(/^\[DEMO\]\s*/, "")
      .trim()
      .split(/\s+/)[0] || ""
  );
}

export function initials(name?: string | null): string {
  const parts = (name || "")
    .replace(/^\[DEMO\]\s*/, "")
    .trim()
    .split(/\s+/);
  return (
    (
      (parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "")
    ).toUpperCase() || "?"
  );
}

/** Link do WhatsApp externo com mensagem pré-preenchida. */
export function whatsappLink(phone?: string | null, message?: string): string | undefined {
  const digits = onlyDigits(phone);
  if (digits.length < 10) return undefined;
  const full = digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`;
  return `https://wa.me/${full}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function telLink(phone?: string | null): string | undefined {
  const digits = onlyDigits(phone);
  return digits.length >= 8 ? `tel:${digits}` : undefined;
}

/** Substitui {chave} por valores. Chaves ausentes ficam vazias. */
export function fillTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function monthKey(iso?: string | null): string {
  return (iso || "").slice(0, 7);
}
