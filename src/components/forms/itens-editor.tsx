// Lista de itens segurados da apólice (equipamentos, bens…), gravada em dados_ramo.itens.
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { numeroBR } from "@/lib/planilha/ler";
import type { CampoRamo } from "@/lib/ramos";
import { cn } from "@/lib/utils";

export type LinhaItem = Record<string, string>;

const valorItem = (v: string | undefined) => numeroBR(v ?? "") ?? 0;

export function ItensEditor({
  titulo,
  campos,
  linhas,
  error,
  onChange,
}: {
  titulo: string;
  campos: CampoRamo[];
  linhas: LinhaItem[];
  error?: string | undefined;
  onChange: (l: LinhaItem[]) => void;
}) {
  const upd = (i: number, k: string, v: string) =>
    onChange(linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const total = linhas.reduce((t, l) => t + valorItem(l["valor"]), 0);
  const temValor = campos.some((c) => c.key === "valor");
  const box =
    "h-9 w-full rounded-md border bg-background px-2.5 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="sm:col-span-2" data-testid="itens-ramo">
      <div className="mb-2 flex items-end justify-between gap-2 border-b pb-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-celeste">{titulo}</span>
        {linhas.length > 0 && (
          <span className="text-xs text-muted-foreground" data-testid="itens-total">
            {linhas.length} {linhas.length === 1 ? "item" : "itens"}
            {temValor && total > 0 && <> · total {money(total)}</>}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {linhas.map((l, i) => (
          <div
            key={i}
            className="grid grid-cols-[1.75rem_1fr_2.25rem] items-start gap-2 rounded-lg border bg-muted/30 p-2.5"
          >
            <span className="mt-2 grid size-6 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
              {campos.map((c) => (
                <label
                  key={c.key}
                  className={cn(
                    "text-xs text-muted-foreground",
                    c.wide ? "sm:col-span-6" : "sm:col-span-2",
                  )}
                >
                  {c.label}
                  <input
                    value={l[c.key] ?? ""}
                    onChange={(e) => upd(i, c.key, e.target.value)}
                    inputMode={c.type === "money" ? "decimal" : undefined}
                    placeholder={c.type === "money" ? "0,00" : undefined}
                    className={cn(box, "mt-1 text-foreground", c.type === "money" && "text-right")}
                    data-testid={`item-${i}-${c.key}`}
                  />
                </label>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover item ${i + 1}`}
              onClick={() => onChange(linhas.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2"
        onClick={() => onChange([...linhas, {}])}
        data-testid="adicionar-item"
      >
        <Plus /> Adicionar item
      </Button>
    </div>
  );
}
