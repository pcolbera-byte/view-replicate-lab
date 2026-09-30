# Vigentt nas lojas (Google Play e App Store)

O aplicativo das lojas é uma "casca" nativa feita com **Capacitor** que abre o Vigentt
publicado no Lovable. Vantagem: tudo o que você publicar no Lovable aparece no app do celular na
hora, sem mandar versão nova para as lojas. Só é preciso enviar nova versão quando mudar ícone,
nome, permissões ou esta pasta.

A compilação é feita no **Codemagic** (serve para iOS sem ter Mac). O arquivo de configuração é o
`codemagic.yaml` na raiz do repositório. As pastas `android/` e `ios/` são geradas na hora da
compilação, por isso não ficam no GitHub.

## 1. Antes de tudo

1. **Publique o app no Lovable** (botão Publish) e, de preferência, ligue um domínio próprio
   (ex.: `app.vigentt.com.br`). Anote o endereço.
2. **Identificador do app**: `br.com.vigentt.app` (em `capacitor.config.ts` e `codemagic.yaml`).
   Se tiver outro domínio, troque nos dois arquivos **antes** da primeira publicação. Depois não
   muda mais.
3. **Preencha `src/lib/legal.ts`** (nome/razão social, CPF/CNPJ, e-mail e cidade). Esses dados
   aparecem nas páginas públicas exigidas pelas lojas:
   - Política de privacidade: `https://SEU-ENDERECO/privacidade`
   - Termos de uso: `https://SEU-ENDERECO/termos`
   - Exclusão de conta: `https://SEU-ENDERECO/excluir-conta`
4. **Banco de dados**: aplique no SQL editor do Lovable Cloud o arquivo
   `supabase/migrations/20260930180000_excluir_conta.sql` (botão "Excluir minha conta", exigido
   pelas duas lojas).

## 2. Codemagic

1. Entre em codemagic.io com o GitHub e adicione o repositório `view-replicate-lab`.
2. **Environment variables** → crie o grupo `vigentt` com:
   - `VIGENTT_URL` = endereço publicado (ex.: `https://app.vigentt.com.br`)
   - `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` = JSON da conta de serviço do Google Play (marcar como secreto)
   - `APP_STORE_APPLE_ID` = número do app no App Store Connect (aparece em Informações do app)
3. **Code signing identities → Android keystores**: envie (ou gere) a keystore de upload com o nome
   de referência `vigentt_keystore`. Guarde uma cópia da keystore e das senhas em lugar seguro.
4. **Integrations → App Store Connect**: adicione a chave de API com o nome `Vigentt`.
5. Rode os workflows **Android — Google Play** e **iOS — App Store**.
   - Android vai para a faixa de **teste interno** como rascunho.
   - iOS vai para o **TestFlight**.

A versão exibida nas lojas fica em `APP_VERSION` no `codemagic.yaml`; o número de compilação sobe
sozinho.

## 3. Google Play Console

- Conta de desenvolvedor (taxa única de US$ 25).
- Crie o app "Vigentt", idioma português (Brasil), tipo **App**, **Gratuito** (a cobrança da
  assinatura é feita fora do app — ver seção 5).
- Ficha da loja: textos abaixo, ícone `branding/loja/play-icone-512.png`, gráfico de destaque
  `branding/loja/play-destaque-1024x500.png` e ao menos 2 capturas de tela do celular.
- Segurança dos dados: coleta nome, e-mail e telefone (conta) e dados informados pelo usuário;
  criptografados em trânsito; o usuário pode pedir a exclusão (link `/excluir-conta`).
- Acesso ao app: informe o e-mail e a senha de uma **conta de demonstração** (crie uma corretora de
  teste e use Configurações → Dados de demonstração).
- Contas pessoais novas precisam de **teste fechado com 12 testadores por 14 dias** antes de ir
  para produção.

## 4. App Store Connect

- Apple Developer Program (US$ 99/ano). Crie o app com o Bundle ID `br.com.vigentt.app`.
- Ícone: `branding/loja/app-store-icone-1024.png` (já sem transparência).
- Capturas: iPhone 6,9" (1320×2868) — pode usar o simulador do Codemagic ou um iPhone.
- Privacidade: URL `/privacidade`; "Dados vinculados ao usuário": informações de contato e
  conteúdo do usuário; sem rastreamento.
- Revisão: preencha "Informações de acesso" com a conta de demonstração e explique que é um
  sistema de gestão para corretoras de seguros (uso profissional).
- Atenção à diretriz 4.2 (apps que só "embrulham" um site): o Vigentt tem funções próprias,
  login, dados e uso profissional, o que costuma ser aceito, mas a Apple pode pedir ajustes.

## 5. Venda (assinatura)

Recomendado: vender a assinatura **pelo site** (corretora contrata e paga fora do app) e deixar o
app das lojas **gratuito, apenas para entrar**, sem botão de compra nem preço dentro do app. É o
modelo de sistemas B2B e evita a comissão das lojas. Confira as regras vigentes de pagamento da
Apple (3.1) e do Google antes de publicar.

## Textos para as lojas

**Nome:** Vigentt — Gestão de Seguros

**Descrição curta (até 80 caracteres):**
Carteira, renovações e comissões da sua corretora de seguros no celular.

**Descrição completa:**
O Vigentt organiza a rotina da corretora de seguros em um só lugar.

• Clientes, veículos e apólices com histórico completo
• Renovações do mês: veja o que vence, o que já foi renovado e o que falta
• Avisos de renovação com mensagem pronta para WhatsApp
• Parcelas, comissões e rateio entre produtores
• Leads e funil de vendas, agenda e tarefas
• Sinistros com acompanhamento de cada etapa
• Relatórios de produção, renovação e comissões por produtor
• Importação da base do Mais Corret
• Usuários com perfil de administrador ou corretor; dados isolados por corretora

Feito para corretores e corretoras que querem parar de perder renovações e ter a carteira na mão,
no computador e no celular.
