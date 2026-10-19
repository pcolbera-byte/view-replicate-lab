// Texto das ações do dono da plataforma, no registro de acessos (que não pode ser apagado).

export function descreverAcessoDono(acao: string, detalhes: unknown): string {
  let d: Record<string, unknown> = {};
  try {
    d = (typeof detalhes === "string" ? JSON.parse(detalhes) : detalhes) ?? {};
  } catch {
    d = {};
  }
  switch (acao) {
    case "ver_painel":
      return "Consultou a lista de corretoras (nome, assinatura e totais, sem dados de clientes)";
    case "exportar_lista":
      return "Exportou a lista de corretoras (sem dados de clientes)";
    case "assinatura_estender":
      return `Estendeu o período de teste em ${Number(d["dias"] ?? 0)} dias`;
    case "assinatura_isentar":
      return "Isentou a assinatura";
    case "assinatura_remover_isencao":
      return "Removeu a isenção da assinatura";
    default:
      return acao;
  }
}
