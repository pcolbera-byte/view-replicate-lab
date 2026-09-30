import { createFileRoute } from "@tanstack/react-router";
import { H2, LegalLayout, Ul } from "@/features/legal/legal-layout";
import { LEGAL } from "@/lib/legal";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/excluir-conta")({
  head: () => pageHead("Excluir conta", "Como excluir sua conta do Corretix e os seus dados."),
  component: ExcluirConta,
});

function ExcluirConta() {
  return (
    <LegalLayout title="Excluir conta e dados">
      <H2>Pelo aplicativo</H2>
      <Ul>
        <li>Entre no {LEGAL.produto} com seu e-mail e senha.</li>
        <li>
          Abra <strong>Configurações → Minha conta</strong>.
        </li>
        <li>
          Toque em <strong>Excluir minha conta</strong>, digite EXCLUIR e confirme.
        </li>
      </Ul>
      <H2>O que é apagado</H2>
      <Ul>
        <li>Sua conta de acesso (nome, e-mail, telefone e senha) é apagada na hora.</li>
        <li>
          Se você for o único usuário da corretora, todos os dados dela (clientes, veículos,
          apólices, parcelas, comissões, sinistros, anotações e arquivos) também são apagados, sem
          possibilidade de recuperação.
        </li>
        <li>
          Se houver outros usuários, os registros da corretora continuam disponíveis para eles. O
          único administrador precisa passar a administração a outro usuário antes.
        </li>
      </Ul>
      <H2>Sem acesso ao aplicativo?</H2>
      <p>
        Envie um e-mail para{" "}
        <a
          href={`mailto:${LEGAL.email}?subject=Excluir%20conta`}
          className="font-semibold text-celeste underline"
        >
          {LEGAL.email}
        </a>{" "}
        a partir do endereço cadastrado, com o assunto “Excluir conta”. A exclusão é feita em até 15
        dias e confirmada por e-mail.
      </p>
    </LegalLayout>
  );
}
