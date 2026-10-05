# Cobrança da assinatura pelo site (Mercado Pago)

Como funciona:

- Toda corretora nova ganha **14 dias grátis** sem cartão.
- O administrador assina em **Configurações → Assinatura**: o app abre o checkout do Mercado Pago
  (cartão de crédito, cobrança mensal automática). Se assinar durante o teste, a 1ª cobrança só
  acontece no fim dele.
- O Mercado Pago avisa o app (webhook) a cada mudança; a situação também é conferida quando o
  cliente volta do checkout.
- Teste vencido ou pagamento não regularizado: o sistema mostra a tela de assinatura (os dados
  continuam guardados). Cancelada: o acesso segue até o fim do mês pago. Tolerância de 5 dias.
- Corretoras que já existiam quando a cobrança foi ligada ficam **isentas** (a sua).
- O app das lojas não mostra preço nem botão de compra.

Valor e nome do plano: `src/lib/plano.ts` (vale para novas assinaturas).

## Passo a passo

1. **Banco**: cole no SQL editor do Lovable Cloud o arquivo
   `supabase/migrations/20260930200000_assinaturas.sql` (ou o pacote enviado na conversa).
2. **Mercado Pago** (mercadopago.com.br/developers → Suas integrações → Criar aplicação,
   produto "Assinaturas"):
   - Copie o **Access Token** de produção (para testar antes, use as credenciais de teste).
3. **Lovable → Cloud → Secrets**, crie:
   - `MERCADOPAGO_ACCESS_TOKEN` = Access Token
   - `MERCADOPAGO_WEBHOOK_SECRET` = assinatura secreta do webhook (passo 4)
4. **Webhooks** na aplicação do Mercado Pago:
   - URL de produção: `https://corretix.com.br/api/mercadopago`
   - Eventos: **Planos e assinaturas** (assinatura e pagamento recorrente)
   - Copie a "assinatura secreta" para o segredo `MERCADOPAGO_WEBHOOK_SECRET`.
5. Publique no Lovable e faça uma assinatura de teste com uma corretora nova.

Liberar uma corretora sem cobrança (ex.: conta de demonstração para as lojas), no SQL editor:

```sql
update public.assinaturas set status = 'isenta'
where empresa_id = (select empresa_id from public.profiles p
                    join auth.users u on u.id = p.id where u.email = 'demo@exemplo.com');
```
