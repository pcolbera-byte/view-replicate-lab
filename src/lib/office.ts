import { supabase } from '@/integrations/supabase/client';

export type Table = 'clientes' | 'leads' | 'veiculos' | 'apolices' | 'tarefas' | 'sinistros' | 'historico_contatos';
export type Row = Record<string, any>;
export const tables: Table[] = ['clientes','leads','veiculos','apolices','tarefas','sinistros','historico_contatos'];
export async function loadOffice() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sua sessão terminou. Entre novamente.');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
  if (profileError || !profile) throw new Error('Não foi possível carregar sua corretora.');
  const results = await Promise.all(tables.map(async table => {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return [table, data ?? []] as const;
  }));
  return { user: auth.user, profile, records: Object.fromEntries(results) as Record<Table, Row[]> };
}
export async function saveRecord(table: Table, values: Row, empresaId: string, id?: string) {
  const payload = { ...values, empresa_id: empresaId };
  const query = id ? supabase.from(table).update(payload).eq('id', id) : supabase.from(table).insert(payload);
  const { error } = await query;
  if (error) throw error;
}
export async function updateRecord(table: Table, id: string, values: Row) {
  const { error } = await supabase.from(table).update(values).eq('id', id);
  if (error) throw error;
}
export function money(value: number | string | null | undefined) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value || 0)); }
export function dateBR(value?: string) { return value ? new Date(value+'T12:00:00').toLocaleDateString('pt-BR') : '—'; }
export function whatsapp(phone?: string, message?: string) { const digits = (phone || '').replace(/\D/g,''); return digits ? `https://wa.me/${digits.startsWith('55') ? digits : '55'+digits}?text=${encodeURIComponent(message || 'Olá! Tudo bem?')}` : undefined; }
