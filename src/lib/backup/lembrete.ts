// Lembrete de backup: guarda neste navegador quando foi o último backup baixado e de quanto
// em quanto tempo avisar. O arquivo fica no computador onde foi baixado, então o controle
// por navegador é o que faz sentido.

const k = (tipo: string, empresa: string) => `corretix-${tipo}-${empresa}`;
const EVENTO = "corretix-backup";

function ler(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* navegador sem armazenamento: só não lembra */
  }
  window.dispatchEvent(new Event(EVENTO));
}

export const FREQUENCIAS = [
  { dias: 1, rotulo: "Todo dia" },
  { dias: 7, rotulo: "Toda semana" },
  { dias: 15, rotulo: "A cada 15 dias" },
  { dias: 30, rotulo: "Todo mês" },
  { dias: 0, rotulo: "Não lembrar" },
] as const;
export const FREQUENCIA_PADRAO = 7;

export const ultimoBackup = (empresa: string) => ler(k("ultimo-backup", empresa));
export const marcarBackup = (empresa: string) =>
  gravar(k("ultimo-backup", empresa), new Date().toISOString());

export function frequenciaBackup(empresa: string): number {
  const v = Number(ler(k("backup-frequencia", empresa)));
  return ler(k("backup-frequencia", empresa)) !== null && Number.isFinite(v)
    ? v
    : FREQUENCIA_PADRAO;
}
export const definirFrequencia = (empresa: string, dias: number) =>
  gravar(k("backup-frequencia", empresa), String(dias));

/** "Lembrar amanhã". */
export const adiarLembrete = (empresa: string, horas = 24) =>
  gravar(k("backup-adiado", empresa), new Date(Date.now() + horas * 3600_000).toISOString());

export type Lembrete = { nunca: true } | { nunca: false; dias: number };

/** Se é hora de lembrar do backup (null = não precisa). */
export function precisaLembrar(empresa: string, agora = Date.now()): Lembrete | null {
  const freq = frequenciaBackup(empresa);
  if (!freq) return null;
  const adiado = ler(k("backup-adiado", empresa));
  if (adiado && Date.parse(adiado) > agora) return null;
  const ultimo = ultimoBackup(empresa);
  if (!ultimo) return { nunca: true };
  const dias = Math.floor((agora - Date.parse(ultimo)) / 86_400_000);
  return dias >= freq ? { nunca: false, dias } : null;
}

/** Reage a mudanças (backup feito, frequência alterada) nesta e em outras abas. */
export function aoMudarBackup(fn: () => void) {
  window.addEventListener(EVENTO, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENTO, fn);
    window.removeEventListener("storage", fn);
  };
}
