// Regras de produtor compartilhadas pelas listas (filtros, colunas e relatórios).
import type { Workspace } from "@/lib/data/workspace";
import type { Apolice } from "@/lib/data/types";

export const SEM_PRODUTOR = "__sem__";

/** Opções do filtro "Produtor" (inclui "Sem produtor"). Vazio se a migração não foi aplicada. */
export function produtorOptions(ws: Workspace): { value: string; label: string }[] {
  if (!ws.temProdutores || !ws.produtores.length) return [];
  return [
    ...ws.produtores
      .filter((p) => p.ativo)
      .map((p) => ({ value: p.id, label: p.tipo === "Corretora" ? `${p.nome} (casa)` : p.nome })),
    { value: SEM_PRODUTOR, label: "Sem produtor" },
  ];
}

/** Um registro pertence ao filtro se o produtor for o principal. */
export function matchProdutor(produtorId: string | null | undefined, filtro: string): boolean {
  if (!filtro) return true;
  if (filtro === SEM_PRODUTOR) return !produtorId;
  return produtorId === filtro;
}

/** Na apólice, conta também quem participa do rateio da comissão. */
export function apoliceDoProdutor(
  a: Pick<Apolice, "id" | "produtor_id">,
  filtro: string,
  rateio: (id: string) => { produtor_id: string }[],
): boolean {
  if (!filtro) return true;
  if (filtro === SEM_PRODUTOR) return !a.produtor_id;
  return a.produtor_id === filtro || rateio(a.id).some((r) => r.produtor_id === filtro);
}

/** Participação (0–1) do produtor na apólice: pelo rateio ou 100% se for o principal. */
export function participacao(
  a: Pick<Apolice, "id" | "produtor_id">,
  produtorId: string,
  rateio: (id: string) => { produtor_id: string; percentual: number }[],
): number {
  const r = rateio(a.id);
  if (r.length) return (r.find((x) => x.produtor_id === produtorId)?.percentual ?? 0) / 100;
  return a.produtor_id === produtorId ? 1 : 0;
}
