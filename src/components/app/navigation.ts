import {
  AlertCircle,
  CalendarDays,
  CarFront,
  Crown,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  Shield,
  Target,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  short?: string | undefined;
  icon: typeof LayoutDashboard;
  group: "Relacionamento" | "Carteira" | "Operação" | "Gestão";
  /** Só aparece para o dono da plataforma. */
  dono?: boolean | undefined;
};

export const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Painel",
    short: "Início",
    icon: LayoutDashboard,
    group: "Relacionamento",
  },
  { to: "/leads", label: "Leads", icon: Target, group: "Relacionamento" },
  { to: "/clientes", label: "Clientes", icon: UsersRound, group: "Relacionamento" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, group: "Relacionamento" },
  { to: "/veiculos", label: "Veículos", icon: CarFront, group: "Carteira" },
  { to: "/apolices", label: "Apólices", icon: Shield, group: "Carteira" },
  { to: "/renovacoes", label: "Renovações", icon: RefreshCw, group: "Carteira" },
  { to: "/sinistros", label: "Sinistros", icon: AlertCircle, group: "Operação" },
  { to: "/comissoes", label: "Comissões", icon: Wallet, group: "Gestão" },
  { to: "/relatorios", label: "Relatórios", icon: TrendingUp, group: "Gestão" },
  { to: "/configuracoes", label: "Configurações", icon: Settings2, group: "Gestão" },
  { to: "/dono", label: "Painel do dono", icon: Crown, group: "Gestão", dono: true },
];

/** Itens de menu visíveis para o usuário. */
export const navPara = (souDono: boolean) => NAV.filter((n) => !n.dono || souDono);

export const MOBILE_TABS = ["/dashboard", "/leads", "/clientes", "/agenda"];
