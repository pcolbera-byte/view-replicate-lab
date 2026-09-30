// Ações de renovação compartilhadas entre a tela de Renovações, o Dashboard e a ficha da apólice.
import { useWorkspace } from "@/components/app/workspace-context";
import { saveRecord, updateFields } from "@/lib/data/workspace";
import { addYears, todayISO } from "@/lib/format";
import type { Apolice } from "@/lib/data/types";

export function useRenewalActions() {
  const { ws, openForm, run, confirm, get } = useWorkspace();

  /** Abre o cadastro da nova apólice já vinculada à anterior. Ao salvar, a anterior vira "Renovada". */
  function renew(a: Apolice) {
    openForm({
      table: "apolices",
      title: "Registrar apólice renovada",
      initial: {
        cliente_id: a.cliente_id,
        veiculo_id: a.veiculo_id,
        ramo: a.ramo,
        seguradora_id: a.seguradora_id,
        seguradora: a.seguradora,
        inicio: a.vencimento,
        vencimento: addYears(a.vencimento, 1),
        premio: a.premio,
        franquia: a.franquia,
        comissao_percentual: a.comissao_percentual,
        forma_pagamento: a.forma_pagamento,
        parcelas_qtd: a.parcelas_qtd ?? 1,
        responsavel_id: a.responsavel_id ?? ws.userId,
        apolice_anterior_id: a.id,
        status: "Vigente",
        numero: "",
        _gerar_parcelas: true,
      },
    });
  }

  async function markNotRenewed(a: Apolice) {
    const motivo = await confirm({
      title: "Marcar como não renovada?",
      description: `${get.clienteNome(a.cliente_id)} · ${a.seguradora} ${a.numero}. A apólice sai da lista de renovações.`,
      confirmLabel: "Marcar não renovada",
      destructive: true,
      inputLabel: "Motivo (opcional)",
    });
    if (motivo === false) return;
    await run(async () => {
      await updateFields("apolices", a.id, {
        renovacao_status: "Não renovada",
        renovacao_obs: motivo,
      });
      await saveRecord(
        "historico_contatos",
        {
          cliente_id: a.cliente_id,
          apolice_id: a.id,
          tipo: "Outro",
          data: todayISO(),
          descricao: `Renovação não realizada (${a.seguradora} ${a.numero}).${motivo ? ` Motivo: ${motivo}` : ""}`,
          usuario_id: ws.userId,
        },
        ws.empresa.id,
      );
    }, "Renovação marcada como não realizada.");
  }

  async function markNegotiating(a: Apolice) {
    await run(
      () => updateFields("apolices", a.id, { renovacao_status: "Em negociação" }),
      "Renovação em negociação.",
    );
  }

  async function reopen(a: Apolice) {
    await run(
      () => updateFields("apolices", a.id, { renovacao_status: "Pendente", renovacao_obs: "" }),
      "Renovação reaberta.",
    );
  }

  function logContact(a: Apolice) {
    openForm({
      table: "historico_contatos",
      initial: { cliente_id: a.cliente_id, apolice_id: a.id, descricao: "" },
    });
  }

  function createTask(a: Apolice) {
    openForm({
      table: "tarefas",
      initial: {
        cliente_id: a.cliente_id,
        apolice_id: a.id,
        tipo: "Renovação",
        prioridade: "Alta",
        titulo: `Renovação ${a.seguradora} ${a.numero}`,
      },
    });
  }

  return { renew, markNotRenewed, markNegotiating, reopen, logContact, createTask };
}
