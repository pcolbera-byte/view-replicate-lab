# Importar a base do Mais Corret para o Corretor360

Lê o arquivo do Access do Mais Corret (`.mdb`) e grava na sua corretora do Corretor360,
entrando com o **seu login de administrador**. Os dados passam pelas mesmas regras de segurança
do app: só entram na sua corretora.

## Antes de começar

1. As migrações do banco precisam estar aplicadas no Lovable Cloud, incluindo a `20260930120000_complementos_gestao.sql`.
2. Você precisa ter uma conta de **administrador** no Corretor360 (a primeira conta criada já é).
3. Node.js 18 ou mais novo no computador.

## Passo a passo

Nesta pasta (`scripts/importar-maiscorret`):

```bash
npm install
```

**1. Simule primeiro** (não grava nada; mostra o resumo e gera CSVs de prévia em `./previa`):

```bash
node importar.mjs "C:\caminho\para\Copiamaiscorret_bd.mdb" --simular
```

**2. Importe.** Use a URL e a chave pública do projeto (as mesmas `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY` do `.env` do Lovable):

```bash
# Linux/Mac
SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_KEY="sb_publishable_..." \
  node importar.mjs base.mdb --email voce@corretora.com.br

# Windows (PowerShell)
$env:SUPABASE_URL="https://xxxx.supabase.co"; $env:SUPABASE_KEY="sb_publishable_..."
node importar.mjs base.mdb --email voce@corretora.com.br
```

O script pede a senha, mostra o resumo e pergunta se pode importar. Leva poucos minutos.

**Pode rodar de novo** sem medo: cada registro recebe um identificador fixo derivado do código
do sistema antigo. O que já foi importado é ignorado (nada é duplicado nem sobrescrito, inclusive
o que você já tiver editado no Corretor360).

## Resultado esperado com a base atual

| No Corretor360 | Quantidade | De onde vem |
|---|---|---|
| Seguradoras | 23 | cadastro de seguradoras (reaproveita as que você já tiver com o mesmo nome) |
| Clientes | 727 | clientes + telefones (celular vira WhatsApp) + e-mail + endereço |
| Veículos | 1.043 | itens de auto, sem repetir o mesmo veículo entre renovações; marca deduzida do modelo |
| Apólices | 3.544 | propostas de seguro novo e renovação, com a cadeia de renovações ligada |
| Parcelas | 593 | só as **a vencer** das 196 apólices vigentes |
| Comissões | 46 | só as **a receber** das apólices vigentes |
| Histórico | 416 | endossos (substituição de veículo, alteração de perfil…) e anotações |

Situação das apólices: 196 vigentes, 2.391 renovadas, 783 encerradas, 167 canceladas.

## Decisões tomadas (e por quê)

- **Parcelas e comissões antigas não entram.** O Mais Corret não registrava pagamentos nem
  recebimentos (nenhuma parcela tem data de pagamento). Importar as vencidas faria o app mostrar
  900 parcelas "atrasadas" que provavelmente foram pagas.
- **Endossos e cancelamentos não viram apólices.** Endosso vira uma anotação no histórico do
  cliente, ligada à apólice. Cancelamento marca a apólice como "Cancelada".
- **Apólices "ativas" vencidas há mais de 60 dias** (144) entram como "Encerrada", com a
  observação "vencida sem renovação registrada". As vencidas há menos de 60 dias continuam
  aparecendo em Renovações.
- **Número da apólice:** o Mais Corret quase nunca guardava o número (só 138 de 4.045 têm).
  Nesses casos o número fica `MC-<código>`. Você corrige ao receber a apólice.
- **Produtor** (Diego, Marli…) e código antigo ficam nas observações do cliente e da apólice.
  Quando essas pessoas tiverem usuário no Corretor360, dá para atribuir o responsável.
- **Não importados:** coberturas e cláusulas detalhadas, orçamentos, prospecções de 2014 e os
  caminhos de arquivos (os arquivos estavam no computador antigo, não dentro do `.mdb`).
