// Busca global: nome, CPF/CNPJ, placa, telefone e número de apólice, agrupada por tipo.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { CarFront, Search, Shield, Target, UsersRound, X } from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { normalize, onlyDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

type Hit = {
  group: "Clientes" | "Veículos" | "Apólices" | "Leads";
  id: string;
  title: string;
  sub: string;
  go: () => void;
};
const icons = { Clientes: UsersRound, Veículos: CarFront, Apólices: Shield, Leads: Target };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !/input|textarea|select/i.test((e.target as HTMLElement).tagName))
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:border-primary/40 sm:w-72 lg:w-96"
        title="Busca global"
      >
        <Search size={17} />
        <span className="hidden sm:inline">Buscar nome, CPF, placa, apólice…</span>
        <kbd className="ml-auto hidden rounded border px-1.5 text-[10px] lg:inline">/</kbd>
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
          <Dialog.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[100dvh] w-full flex-col bg-card shadow-2xl outline-none sm:top-[10vh] sm:max-h-[75vh] sm:max-w-xl sm:rounded-lg"
          >
            <Dialog.Title className="sr-only">Busca global</Dialog.Title>
            {open && <SearchBody close={() => setOpen(false)} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function SearchBody({ close }: { close: () => void }) {
  const { ws, get, openRecord } = useWorkspace();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo<Hit[]>(() => {
    const text = normalize(q.trim());
    const digits = onlyDigits(q);
    const plate = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (text.length < 2) return [];
    const matchText = (...vals: (string | null | undefined)[]) =>
      vals.some((v) => normalize(v).includes(text));
    const matchDigits = (...vals: (string | null | undefined)[]) =>
      digits.length >= 3 && vals.some((v) => onlyDigits(v).includes(digits));
    const out: Hit[] = [];
    for (const c of ws.clientes)
      if (
        matchText(c.nome, c.nome_fantasia, c.email) ||
        matchDigits(c.documento, c.whatsapp, c.telefone)
      )
        out.push({
          group: "Clientes",
          id: c.id,
          title: c.nome,
          sub: [c.documento, c.cidade].filter(Boolean).join(" · "),
          go: () => navigate({ to: "/clientes/$id", params: { id: c.id } }),
        });
    for (const v of ws.veiculos)
      if (
        (plate.length >= 3 && v.placa.includes(plate)) ||
        matchText(v.modelo, v.marca) ||
        matchDigits(v.renavam, v.chassi)
      )
        out.push({
          group: "Veículos",
          id: v.id,
          title: `${v.placa} · ${v.marca} ${v.modelo}`,
          sub: get.clienteNome(v.cliente_id),
          go: () => openRecord("veiculo", v.id),
        });
    for (const a of ws.apolices)
      if (matchText(a.numero) || matchDigits(a.numero))
        out.push({
          group: "Apólices",
          id: a.id,
          title: `${a.numero} · ${a.seguradora}`,
          sub: get.clienteNome(a.cliente_id),
          go: () => openRecord("apolice", a.id),
        });
    for (const l of ws.leads)
      if (matchText(l.nome, l.email) || matchDigits(l.documento, l.whatsapp, l.telefone))
        out.push({
          group: "Leads",
          id: l.id,
          title: l.nome,
          sub: `${l.status} · ${l.origem}`,
          go: () => openRecord("lead", l.id),
        });
    const byGroup = (g: Hit["group"]) => out.filter((h) => h.group === g).slice(0, 6);
    return [
      ...byGroup("Clientes"),
      ...byGroup("Veículos"),
      ...byGroup("Apólices"),
      ...byGroup("Leads"),
    ];
  }, [q, ws, get, navigate, openRecord]);

  useEffect(() => setActive(0), [q]);
  const pick = (h: Hit) => {
    close();
    // abre a ficha depois que o diálogo de busca terminar de fechar
    setTimeout(h.go, 0);
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b px-4">
        <Search size={18} className="text-muted-foreground" />
        <input
          ref={inputRef}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
            if (e.key === "Enter" && hits[active]) pick(hits[active]);
          }}
          placeholder="Nome, CPF/CNPJ, placa, telefone ou nº da apólice"
          className="h-14 flex-1 bg-transparent text-base outline-none"
        />
        <Dialog.Close
          className="grid size-9 place-items-center rounded-md hover:bg-muted"
          title="Fechar"
        >
          <X size={18} />
        </Dialog.Close>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {q.trim().length < 2 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Digite ao menos 2 caracteres.
          </p>
        ) : hits.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum resultado para “{q}”.
          </p>
        ) : (
          (["Clientes", "Veículos", "Apólices", "Leads"] as const).map((g) => {
            const group = hits.filter((h) => h.group === g);
            if (!group.length) return null;
            const Icon = icons[g];
            return (
              <div key={g} className="mb-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {g}
                </p>
                {group.map((h) => {
                  const i = hits.indexOf(h);
                  return (
                    <button
                      key={h.group + h.id}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(h)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left",
                        i === active && "bg-muted",
                      )}
                    >
                      <Icon size={16} className="shrink-0 text-celeste" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{h.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {h.sub}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
