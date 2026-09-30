import { createFileRoute } from "@tanstack/react-router";
import { H2, LegalLayout, Ul } from "@/features/legal/legal-layout";
import { LEGAL } from "@/lib/legal";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacidade")({
  head: () => pageHead("Política de privacidade", "Como o CorretorOne trata os dados pessoais."),
  component: Privacidade,
});

function Privacidade() {
  const L = LEGAL;
  return (
    <LegalLayout title="Política de privacidade">
      <p>
        Esta política explica como o {L.produto}, oferecido por {L.responsavel} ({L.documento}),
        trata os dados pessoais de quem usa o aplicativo, de acordo com a Lei Geral de Proteção de
        Dados (Lei 13.709/2018 — LGPD).
      </p>
      <H2>Quem é responsável por quais dados</H2>
      <Ul>
        <li>
          <strong>Dados da sua conta</strong> (nome, e-mail, telefone e senha): o {L.produto} é o
          controlador.
        </li>
        <li>
          <strong>Dados que a corretora cadastra</strong> (clientes, veículos, apólices, sinistros,
          documentos): a corretora é a controladora e o {L.produto} atua como operador, tratando
          esses dados apenas para prestar o serviço contratado.
        </li>
      </Ul>
      <H2>Dados que coletamos</H2>
      <Ul>
        <li>Cadastro do usuário: nome, e-mail, telefone e nome da corretora.</li>
        <li>
          Dados inseridos pela corretora: dados de clientes e leads (nome, CPF/CNPJ, contatos,
          endereço), veículos, apólices, parcelas, comissões, sinistros, anotações e arquivos.
        </li>
        <li>Registros técnicos de acesso (data, hora e ações no sistema), para segurança.</li>
      </Ul>
      <H2>Para que usamos</H2>
      <Ul>
        <li>Permitir o acesso e o funcionamento do sistema de gestão da corretora.</li>
        <li>Enviar avisos do próprio serviço (renovações, senha, convites).</li>
        <li>Garantir a segurança, prevenir fraudes e cumprir obrigações legais.</li>
      </Ul>
      <p>Não vendemos dados pessoais e não usamos os dados das corretoras para publicidade.</p>
      <H2>Compartilhamento</H2>
      <p>
        Os dados ficam em provedores de infraestrutura em nuvem contratados para hospedar o serviço
        (banco de dados, autenticação e armazenamento de arquivos), sob obrigações de sigilo e
        segurança. Podemos compartilhar dados quando exigido por lei ou por ordem de autoridade.
      </p>
      <H2>Segurança e isolamento</H2>
      <p>
        Cada corretora só acessa os próprios dados (isolamento no banco de dados). O acesso é
        protegido por senha e a comunicação é criptografada (HTTPS).
      </p>
      <H2>Por quanto tempo guardamos</H2>
      <p>
        Enquanto a conta estiver ativa. Ao excluir a conta, os dados são apagados, salvo o que a lei
        obrigar a guardar.
      </p>
      <H2>Seus direitos</H2>
      <p>
        Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar
        consentimentos. Clientes de uma corretora devem procurar primeiro a própria corretora, que é
        a controladora dos dados deles.
      </p>
      <p>
        Para excluir sua conta, use{" "}
        <strong>Configurações → Minha conta → Excluir minha conta</strong> ou veja a página{" "}
        <a href="/excluir-conta" className="text-celeste underline">
          Excluir conta
        </a>
        .
      </p>
      <H2>Contato</H2>
      <p>
        Dúvidas e pedidos sobre privacidade: <strong>{L.email}</strong>.
      </p>
    </LegalLayout>
  );
}
