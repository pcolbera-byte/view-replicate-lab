import { createFileRoute } from "@tanstack/react-router";
import { H2, LegalLayout, Ul } from "@/features/legal/legal-layout";
import { LEGAL } from "@/lib/legal";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/termos")({
  head: () => pageHead("Termos de uso", "Condições de uso do Corretix."),
  component: Termos,
});

function Termos() {
  const L = LEGAL;
  return (
    <LegalLayout title="Termos de uso">
      <p>
        Ao criar uma conta ou usar o {L.produto}, oferecido por {L.responsavel} ({L.documento}),
        você concorda com estes termos.
      </p>
      <H2>O serviço</H2>
      <p>
        O {L.produto} é um sistema de gestão para corretoras de seguros: cadastro de clientes,
        veículos e apólices, controle de renovações, parcelas, sinistros e comissões. Ele não emite
        apólices, não intermedia contratos de seguro e não substitui os sistemas das seguradoras.
      </p>
      <H2>Conta e acesso</H2>
      <Ul>
        <li>Você é responsável por manter sua senha em sigilo e pelas ações feitas com ela.</li>
        <li>
          O administrador da corretora controla quem tem acesso e pode desativar usuários a qualquer
          momento.
        </li>
        <li>Informe dados verdadeiros e mantenha-os atualizados.</li>
      </Ul>
      <H2>Dados cadastrados pela corretora</H2>
      <p>
        A corretora é responsável pelos dados que cadastra e por ter base legal para tratá-los
        (LGPD). O tratamento é descrito na{" "}
        <a href="/privacidade" className="text-celeste underline">
          Política de privacidade
        </a>
        .
      </p>
      <H2>Uso permitido</H2>
      <Ul>
        <li>Não use o serviço para atividades ilegais ou para enviar mensagens não solicitadas.</li>
        <li>Não tente acessar dados de outras corretoras nem burlar a segurança do sistema.</li>
      </Ul>
      <H2>Planos e pagamento</H2>
      <p>
        Condições comerciais (planos, valores e forma de cobrança) são informadas no momento da
        contratação. O cancelamento pode ser feito a qualquer momento, sem multa, e vale para o
        período seguinte.
      </p>
      <H2>Disponibilidade e responsabilidade</H2>
      <p>
        Trabalhamos para manter o serviço disponível e seguro, mas podem ocorrer interrupções para
        manutenção ou por falhas de terceiros. Os prazos de renovação e pagamentos devem ser
        conferidos também junto às seguradoras; o sistema é uma ferramenta de apoio.
      </p>
      <H2>Encerramento</H2>
      <p>
        Você pode excluir sua conta a qualquer momento em Configurações → Minha conta. Podemos
        suspender contas que violem estes termos.
      </p>
      <H2>Foro e contato</H2>
      <p>
        Fica eleito o foro de {L.cidade}. Contato: <strong>{L.email}</strong>.
      </p>
    </LegalLayout>
  );
}
