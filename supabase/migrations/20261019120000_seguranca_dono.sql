-- Segurança dos dados das corretoras perante o dono da plataforma:
--  * remove o "backup de tudo" (exportava os clientes de todas as corretoras);
--  * cria o registro de acessos do dono, que não pode ser alterado nem apagado;
--  * cada corretora vê o que o dono fez na conta dela.

DROP FUNCTION IF EXISTS public.dono_backup_plataforma();

CREATE TABLE IF NOT EXISTS public.dono_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  acao text NOT NULL,
  -- sem chave estrangeira e sem a coluna empresa_id: o registro continua mesmo se a corretora
  -- for excluída (a exclusão de conta apaga as tabelas que têm empresa_id)
  corretora_id uuid,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dono_acessos_empresa ON public.dono_acessos (corretora_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dono_acessos_data ON public.dono_acessos (created_at DESC);

ALTER TABLE public.dono_acessos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dono_acessos FROM anon, authenticated;
GRANT SELECT ON public.dono_acessos TO authenticated;
DROP POLICY IF EXISTS dono_acessos_da_corretora ON public.dono_acessos;
CREATE POLICY dono_acessos_da_corretora ON public.dono_acessos FOR SELECT TO authenticated
  USING (corretora_id IS NOT NULL AND corretora_id = app_private.my_empresa_id());

-- Só acrescenta: ninguém altera nem apaga (nem com a chave de serviço).
CREATE OR REPLACE FUNCTION app_private.dono_acessos_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O registro de acessos não pode ser alterado nem apagado.';
END $$;
DROP TRIGGER IF EXISTS imutavel ON public.dono_acessos;
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON public.dono_acessos
  FOR EACH ROW EXECUTE FUNCTION app_private.dono_acessos_imutavel();
DROP TRIGGER IF EXISTS imutavel_truncate ON public.dono_acessos;
CREATE TRIGGER imutavel_truncate BEFORE TRUNCATE ON public.dono_acessos
  FOR EACH STATEMENT EXECUTE FUNCTION app_private.dono_acessos_imutavel();

-- Alterações de assinatura feitas pelo dono ficam registradas.
CREATE OR REPLACE FUNCTION public.dono_alterar_assinatura(_empresa uuid, _acao text, _dias int DEFAULT 0)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.sou_dono() THEN
    RAISE EXCEPTION 'Acesso restrito ao dono da plataforma.';
  END IF;
  INSERT INTO public.assinaturas (empresa_id, status, teste_ate)
  VALUES (_empresa, 'teste', current_date)
  ON CONFLICT (empresa_id) DO NOTHING;

  IF _acao = 'estender' THEN
    IF _dias IS NULL OR _dias < 1 OR _dias > 365 THEN
      RAISE EXCEPTION 'Informe de 1 a 365 dias.';
    END IF;
    UPDATE public.assinaturas
       SET teste_ate = greatest(teste_ate, current_date) + _dias,
           status = CASE WHEN status IN ('teste', 'pendente', 'cancelada', 'atrasada') AND mp_status IS DISTINCT FROM 'authorized'
                         THEN CASE WHEN status = 'pendente' THEN 'pendente' ELSE 'teste' END
                         ELSE status END
     WHERE empresa_id = _empresa;
  ELSIF _acao = 'isentar' THEN
    UPDATE public.assinaturas SET status = 'isenta' WHERE empresa_id = _empresa;
  ELSIF _acao = 'remover_isencao' THEN
    UPDATE public.assinaturas
       SET status = CASE WHEN mp_status = 'authorized' THEN 'ativa' ELSE 'teste' END,
           teste_ate = greatest(teste_ate, current_date + 7)
     WHERE empresa_id = _empresa AND status = 'isenta';
  ELSE
    RAISE EXCEPTION 'Ação inválida.';
  END IF;

  INSERT INTO public.dono_acessos (user_id, email, acao, corretora_id, detalhes)
  SELECT auth.uid(), u.email::text, 'assinatura_' || _acao, _empresa,
         CASE WHEN _acao = 'estender' THEN jsonb_build_object('dias', _dias) ELSE '{}'::jsonb END
    FROM (SELECT 1) x LEFT JOIN auth.users u ON u.id = auth.uid();
END $$;

REVOKE ALL ON FUNCTION public.dono_alterar_assinatura(uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dono_alterar_assinatura(uuid, text, int) TO authenticated;
