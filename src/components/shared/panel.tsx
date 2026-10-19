// Painel lateral (desktop) / tela cheia (celular) para formulários e fichas rápidas.
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: ReactNode | undefined;
  title: ReactNode;
  subtitle?: ReactNode | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  width?: string | undefined;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            width,
          )}
        >
          <div className="border-b px-5 pb-4 pt-5 lg:px-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {eyebrow && (
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-celeste">
                    {eyebrow}
                  </div>
                )}
                <Dialog.Title className="font-display text-xl font-bold leading-tight">
                  {title}
                </Dialog.Title>
                {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
              </div>
              <Dialog.Close
                className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-muted"
                title="Fechar"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
            {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-7">{children}</div>
          {footer && (
            <div className="border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:px-7">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Caixa de confirmação centralizada. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  destructive,
  input,
  choice,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: ReactNode | undefined;
  confirmLabel?: string | undefined;
  destructive?: boolean | undefined;
  input?:
    | {
        label: string;
        value: string;
        onChange: (v: string) => void;
        required?: boolean | undefined;
      }
    | undefined;
  choice?:
    | {
        label: string;
        options: readonly string[];
        value: string;
        onChange: (v: string) => void;
        detailRequiredFor?: string | undefined;
      }
    | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const precisaTexto =
    !!choice && !!choice.detailRequiredFor && choice.value === choice.detailRequiredFor;
  const bloqueado =
    (!!choice && !choice.value) ||
    ((precisaTexto || input?.required) && !!input && !input.value.trim());
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-foreground/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[60] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card p-6 shadow-2xl outline-none"
        >
          <Dialog.Title className="font-display text-lg font-bold">{title}</Dialog.Title>
          {description && <div className="mt-2 text-sm text-muted-foreground">{description}</div>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!bloqueado) onConfirm();
            }}
            className="mt-5"
          >
            {choice && (
              <fieldset className="mb-4" data-testid="confirm-opcoes">
                <legend className="mb-2 text-sm font-semibold">{choice.label}</legend>
                <div className="grid gap-1.5">
                  {choice.options.map((o) => (
                    <label
                      key={o}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm",
                        choice.value === o && "border-primary bg-secondary/60 font-semibold",
                      )}
                    >
                      <input
                        type="radio"
                        name="confirm-opcao"
                        checked={choice.value === o}
                        onChange={() => choice.onChange(o)}
                        className="accent-[var(--primary)]"
                      />
                      {o}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {input && (
              <label className="mb-5 block text-sm font-semibold">
                {precisaTexto
                  ? `${input.label.replace(/ \(opcional\)$/, "")} (obrigatório)`
                  : input.label}
                <textarea
                  autoFocus
                  required={input.required}
                  rows={3}
                  value={input.value}
                  onChange={(e) => input.onChange(e.target.value)}
                  className="mt-2 w-full rounded-md border bg-background p-3 text-sm font-normal"
                />
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 rounded-md border px-4 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={bloqueado}
                className={cn(
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "h-9 rounded-md px-4 text-sm font-semibold text-primary-foreground",
                  destructive
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-primary hover:bg-primary/90",
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Janela centralizada para formulários curtos abertos de dentro de uma ficha. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "w-[min(94vw,560px)]",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  width?: string | undefined;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-foreground/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-1/2 z-[60] flex max-h-[92dvh] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-card shadow-2xl outline-none",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-lg font-bold">{title}</Dialog.Title>
              {description && (
                <div className="mt-1 text-sm text-muted-foreground">{description}</div>
              )}
            </div>
            <Dialog.Close
              className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-muted"
              title="Fechar"
            >
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
