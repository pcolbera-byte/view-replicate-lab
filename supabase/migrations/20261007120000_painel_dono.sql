-- Painel do dono do Corretix: visão de todas as corretoras clientes e da assinatura de cada uma.
-- Só quem está em plataforma_donos acessa; tudo passa por funções que conferem isso.
-- Para se tornar dono (uma vez, no SQL editor):
--   insert into public.plataforma_donos (user_id)
--   select id from auth.users where email = 'SEU-EMAIL' on conflict do nothing;

CREATE TABLE IF NOT EXISTS public.plataforma_donos (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plataforma_donos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plataforma_donos FROM anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.sou_dono() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.plataforma_donos WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.sou_dono() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_private.sou_dono()
$$;

CREATE OR REPLACE FUNCTION public.dono_corretoras()
RETURNS TABLE (
  empresa_id uuid,
  nome text,
  criada_em timestamptz,
  status text,
  teste_ate date,
  pago_ate date,
  proxima_cobranca date,
  valor numeric,
  ultimo_pagamento_em timestamptz,
  admin_nome text,
  admin_email text,
  usuarios int,
  clientes int,
  apolices int,
  ultimo_acesso timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.sou_dono() THEN
    RAISE EXCEPTION 'Acesso restrito ao dono da plataforma.';
  END IF;
  RETURN QUERY
  SELECT e.id, e.nome, e.created_at,
         COALESCE(a.status, 'isenta'), a.teste_ate, a.pago_ate, a.proxima_cobranca, a.valor,
         a.ultimo_pagamento_em,
         adm.nome, adm.email,
         (SELECT count(*)::int FROM public.profiles p WHERE p.empresa_id = e.id),
         (SELECT count(*)::int FROM public.clientes c WHERE c.empresa_id = e.id),
         (SELECT count(*)::int FROM public.apolices ap WHERE ap.empresa_id = e.id),
         (SELECT max((to_jsonb(u) ->> 'last_sign_in_at')::timestamptz)
            FROM auth.users u JOIN public.profiles p ON p.id = u.id WHERE p.empresa_id = e.id)
    FROM public.empresas e
    LEFT JOIN public.assinaturas a ON a.empresa_id = e.id
    LEFT JOIN LATERAL (
      SELECT p.nome, p.email FROM public.profiles p
        JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'admin'
       WHERE p.empresa_id = e.id
       ORDER BY p.created_at LIMIT 1
    ) adm ON true
   ORDER BY e.created_at DESC;
END $$;

-- acao: 'estender' (dias de teste a mais), 'isentar', 'remover_isencao'
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
END $$;

REVOKE ALL ON FUNCTION public.sou_dono() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dono_corretoras() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dono_alterar_assinatura(uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sou_dono() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dono_corretoras() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dono_alterar_assinatura(uuid, text, int) TO authenticated;
