// Componentes visuais reutilizados em todas as telas.
import type { HTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Link } from "@tanstack/react-router";
import { ClipboardList, MessageCircle, Phone, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, telLink, whatsappLink } from "@/lib/format";
import { statusTone, type Tone } from "@/lib/domain";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string | undefined;
  title: ReactNode;
  description?: ReactNode | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-celeste">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-bold lg:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const toneClass: Record<Tone, string> = {
  good: "bg-emerald/10 text-emerald",
  warn: "bg-warning/15 text-[oklch(0.5_0.12_60)]",
  bad: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground",
};
const dotClass: Record<Tone, string> = {
  good: "bg-emerald",
  warn: "bg-warning",
  bad: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClass[tone])} />
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status?: string | null | undefined;
  className?: string | undefined;
}) {
  if (!status) return null;
  return (
    <Badge tone={statusTone(status)} className={className}>
      {status}
    </Badge>
  );
}

export function DemoBadge({ show }: { show?: boolean | null | undefined }) {
  if (!show) return null;
  return (
    <span className="rounded border border-dashed border-warning px-1.5 text-[10px] font-bold uppercase tracking-wide text-[oklch(0.5_0.12_60)]">
      Demo
    </span>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
  icon: Icon = ClipboardList,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
  icon?: LucideIcon;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon size={22} />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{subtitle}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string | undefined;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  return (
    <div className={cn("rounded-lg border bg-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5 lg:px-5">
      <div className="min-w-0">
        <h2 className="font-display text-[15px] font-bold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "good",
  to,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: Tone | undefined;
  to?: string | undefined;
  hint?: ReactNode | undefined;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground lg:text-[13px]">{label}</span>
        <span className={cn("grid size-8 place-items-center rounded-md", toneClass[tone])}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3 font-display text-2xl font-bold tabular-nums lg:text-[26px]">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </>
  );
  const cls = "block rounded-lg border bg-card p-4 transition-colors hover:border-primary/40";
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Avatar({
  name,
  className,
}: {
  name?: string | null | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-primary",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function WhatsAppButton({
  phone,
  message,
  label,
  size = "icon",
  className,
}: {
  phone?: string | null | undefined;
  message?: string | undefined;
  label?: string | undefined;
  size?: "icon" | "sm" | undefined;
  className?: string | undefined;
}) {
  const url = whatsappLink(phone, message);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Enviar WhatsApp"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-emerald/30 text-emerald transition-colors hover:bg-emerald/10",
        size === "icon" ? "size-9" : "h-8 px-3 text-xs font-semibold",
        className,
      )}
    >
      <MessageCircle size={16} />
      {size === "sm" && (label ?? "WhatsApp")}
    </a>
  );
}

export function CallButton({
  phone,
  size = "icon",
}: {
  phone?: string | null | undefined;
  size?: "icon" | "sm" | undefined;
}) {
  const url = telLink(phone);
  if (!url) return null;
  return (
    <a
      href={url}
      title="Ligar"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border text-foreground transition-colors hover:bg-muted",
        size === "icon" ? "size-9" : "h-8 px-3 text-xs font-semibold",
      )}
    >
      <Phone size={15} />
      {size === "sm" && "Ligar"}
    </a>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border bg-card pl-9 pr-3 text-sm"
      />
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  allLabel = "Todos",
  className,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  allLabel?: string | null | undefined;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value">) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-10 rounded-md border bg-card px-3 text-sm", className)}
      {...rest}
    >
      {allLabel !== null && <option value="">{allLabel}</option>}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number | undefined }[];
}) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-md bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-8 items-center gap-1.5 whitespace-nowrap rounded px-3 text-sm transition-colors",
            value === o.value
              ? "bg-card font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="rounded bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function KeyValues({ items }: { items: [string, ReactNode, boolean?][] }) {
  const visible = items.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "—");
  if (!visible.length)
    return <p className="text-sm text-muted-foreground">Nenhuma informação cadastrada.</p>;
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
      {visible.map(([k, v, wide]) => (
        <div key={k} className={wide ? "col-span-2" : ""}>
          <dt className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {k}
          </dt>
          <dd className="break-words text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RowButton({
  onClick,
  children,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 border-b px-4 py-3 transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none lg:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListCount({ n, noun = "registro" }: { n: number; noun?: string | undefined }) {
  return (
    <p className="mb-2 text-xs text-muted-foreground">
      {n} {noun}
      {n === 1 ? "" : "s"}
    </p>
  );
}
