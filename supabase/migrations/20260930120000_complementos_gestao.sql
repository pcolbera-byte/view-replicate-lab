-- =====================================================================
-- Complementos da gestão da corretora (aditiva e idempotente)
-- A migração 20260930011427 (reescrita pelo Lovable a partir da 20260929210000) tem um erro
-- na regra de renovação de apólices e não incluiu:
--   * o registro automático de atividades (painel "Atividades recentes" + log de alterações)
--   * as funções de gerar/limpar dados de demonstração (Configurações → Dados de demonstração)
-- Pode ser aplicada com segurança mesmo que parte disso já exista.
-- =====================================================================

-- ---------- Correção: renovação de apólice bloqueada ------------------
-- Na versão aplicada, "a.id = apolice_anterior_id" dentro da subconsulta lia a coluna da
-- apólice ANTERIOR (a), e não da nova, então nenhuma renovação passava. Qualificado com "apolices.".
DROP POLICY IF EXISTS apolices_insert ON public.apolices;
DROP POLICY IF EXISTS apolices_update ON public.apolices;
CREATE POLICY apolices_insert ON public.apolices FOR INSERT TO authenticated WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id())
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.cliente_id = apolices.cliente_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (seguradora_id IS NULL OR EXISTS (SELECT 1 FROM public.seguradoras s WHERE s.id = seguradora_id AND s.empresa_id = app_private.my_empresa_id()))
  AND (apolices.apolice_anterior_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolices.apolice_anterior_id AND a.empresa_id = app_private.my_empresa_id() AND a.id <> apolices.id)));
CREATE POLICY apolices_update ON public.apolices FOR UPDATE TO authenticated USING (empresa_id = app_private.my_empresa_id()) WITH CHECK (empresa_id = app_private.my_empresa_id()
  AND EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND c.empresa_id = app_private.my_empresa_id())
  AND (veiculo_id IS NULL OR EXISTS (SELECT 1 FROM public.veiculos v WHERE v.id = veiculo_id AND v.cliente_id = apolices.cliente_id AND v.empresa_id = app_private.my_empresa_id()))
  AND (seguradora_id IS NULL OR EXISTS (SELECT 1 FROM public.seguradoras s WHERE s.id = seguradora_id AND s.empresa_id = app_private.my_empresa_id()))
  AND (apolices.apolice_anterior_id IS NULL OR EXISTS (SELECT 1 FROM public.apolices a WHERE a.id = apolices.apolice_anterior_id AND a.empresa_id = app_private.my_empresa_id() AND a.id <> apolices.id)));

-- ---------- Log de atividades ------------------------------------------
CREATE OR REPLACE FUNCTION app_private.registrar_atividade() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j jsonb := to_jsonb(NEW); v_acao text; v_desc text;
BEGIN
  IF COALESCE((j->>'is_demo')::boolean, false) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criado';
  ELSIF (to_jsonb(OLD)->>'status') IS DISTINCT FROM (j->>'status') THEN
    v_acao := 'status';
  ELSE
    RETURN NEW;
  END IF;
  v_desc := CASE TG_TABLE_NAME
    WHEN 'clientes' THEN 'Novo cliente: ' || (j->>'nome')
    WHEN 'leads' THEN CASE WHEN v_acao = 'criado' THEN 'Novo lead: ' || (j->>'nome') ELSE 'Lead ' || (j->>'nome') || ' → ' || (j->>'status') END
    WHEN 'veiculos' THEN 'Veículo cadastrado: ' || COALESCE(j->>'marca','') || ' ' || COALESCE(j->>'modelo','') || ' · ' || (j->>'placa')
    WHEN 'apolices' THEN CASE WHEN v_acao = 'criado' THEN 'Apólice cadastrada: ' || (j->>'numero') || ' · ' || (j->>'seguradora') ELSE 'Apólice ' || (j->>'numero') || ' → ' || (j->>'status') END
    WHEN 'sinistros' THEN CASE WHEN v_acao = 'criado' THEN 'Sinistro aberto: ' || (j->>'tipo') ELSE 'Sinistro atualizado → ' || (j->>'status') END
    WHEN 'documentos' THEN 'Documento adicionado: ' || (j->>'nome')
    ELSE TG_TABLE_NAME
  END;
  INSERT INTO public.atividades(empresa_id, usuario_id, entidade, entidade_id, acao, descricao)
  VALUES ((j->>'empresa_id')::uuid, auth.uid(), TG_TABLE_NAME, (j->>'id')::uuid, v_acao, v_desc);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.registrar_atividade() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS registrar_atividade ON public.clientes;
CREATE TRIGGER registrar_atividade AFTER INSERT ON public.clientes FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
DROP TRIGGER IF EXISTS registrar_atividade ON public.leads;
CREATE TRIGGER registrar_atividade AFTER INSERT OR UPDATE OF status ON public.leads FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
DROP TRIGGER IF EXISTS registrar_atividade ON public.veiculos;
CREATE TRIGGER registrar_atividade AFTER INSERT ON public.veiculos FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
DROP TRIGGER IF EXISTS registrar_atividade ON public.apolices;
CREATE TRIGGER registrar_atividade AFTER INSERT OR UPDATE OF status ON public.apolices FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
DROP TRIGGER IF EXISTS registrar_atividade ON public.sinistros;
CREATE TRIGGER registrar_atividade AFTER INSERT OR UPDATE OF status ON public.sinistros FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();
DROP TRIGGER IF EXISTS registrar_atividade ON public.documentos;
CREATE TRIGGER registrar_atividade AFTER INSERT ON public.documentos FOR EACH ROW EXECUTE FUNCTION app_private.registrar_atividade();


-- ---------- Dados de demonstração ------------------------------------
CREATE OR REPLACE FUNCTION public.limpar_dados_demo() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e uuid := app_private.my_empresa_id();
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem limpar os dados de demonstração.'; END IF;
  DELETE FROM public.comissoes WHERE empresa_id = e AND is_demo;
  DELETE FROM public.parcelas WHERE empresa_id = e AND is_demo;
  DELETE FROM public.historico_contatos WHERE empresa_id = e AND is_demo;
  DELETE FROM public.tarefas WHERE empresa_id = e AND is_demo;
  DELETE FROM public.sinistros WHERE empresa_id = e AND is_demo;
  DELETE FROM public.condutores WHERE empresa_id = e AND is_demo;
  UPDATE public.apolices SET apolice_anterior_id = NULL WHERE empresa_id = e AND is_demo;
  DELETE FROM public.apolices WHERE empresa_id = e AND is_demo;
  DELETE FROM public.veiculos WHERE empresa_id = e AND is_demo;
  DELETE FROM public.leads WHERE empresa_id = e AND is_demo;
  DELETE FROM public.clientes WHERE empresa_id = e AND is_demo;
EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION 'Há registros reais vinculados a dados de demonstração. Desvincule-os antes de limpar.';
END $$;
REVOKE ALL ON FUNCTION public.limpar_dados_demo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limpar_dados_demo() TO authenticated;

CREATE OR REPLACE FUNCTION public.gerar_dados_demo() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e uuid := app_private.my_empresa_id(); u uuid := auth.uid();
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid;
  v1 uuid; v2 uuid; v3 uuid; v4 uuid; v5 uuid; v6 uuid; v7 uuid; v8 uuid;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid; a6 uuid;
  s_porto uuid; s_allianz uuid; s_tokio uuid; s_hdi uuid; s_azul uuid;
  l1 uuid; d date := CURRENT_DATE;
BEGIN
  IF NOT app_private.is_admin() THEN RAISE EXCEPTION 'Apenas administradores podem gerar dados de demonstração.'; END IF;
  IF EXISTS (SELECT 1 FROM public.clientes WHERE empresa_id = e AND is_demo) THEN RAISE EXCEPTION 'Os dados de demonstração já existem.'; END IF;

  INSERT INTO public.seguradoras(empresa_id, nome) VALUES (e,'Porto Seguro'),(e,'Allianz'),(e,'Tokio Marine'),(e,'HDI'),(e,'Azul Seguros') ON CONFLICT (empresa_id, nome) DO NOTHING;
  SELECT id INTO s_porto FROM public.seguradoras WHERE empresa_id = e AND nome = 'Porto Seguro';
  SELECT id INTO s_allianz FROM public.seguradoras WHERE empresa_id = e AND nome = 'Allianz';
  SELECT id INTO s_tokio FROM public.seguradoras WHERE empresa_id = e AND nome = 'Tokio Marine';
  SELECT id INTO s_hdi FROM public.seguradoras WHERE empresa_id = e AND nome = 'HDI';
  SELECT id INTO s_azul FROM public.seguradoras WHERE empresa_id = e AND nome = 'Azul Seguros';

  INSERT INTO public.clientes(empresa_id,tipo,nome,documento,whatsapp,telefone,email,cidade,estado,bairro,responsavel_id,is_demo) VALUES (e,'PF','[DEMO] Mariana Costa','123.456.789-09','11987654321','1133334444','mariana@exemplo.com','São Paulo','SP','Moema',u,true) RETURNING id INTO c1;
  INSERT INTO public.clientes(empresa_id,tipo,nome,documento,whatsapp,email,cidade,estado,bairro,responsavel_id,is_demo) VALUES (e,'PF','[DEMO] Ricardo Almeida','987.654.321-00','11976543210','ricardo@exemplo.com','Santo André','SP','Centro',u,true) RETURNING id INTO c2;
  INSERT INTO public.clientes(empresa_id,tipo,nome,nome_fantasia,documento,responsavel_nome,whatsapp,email,cidade,estado,responsavel_id,is_demo) VALUES (e,'PJ','[DEMO] Transportes Horizonte Ltda','Horizonte Log','12.345.678/0001-95','Paulo Mendes','11965432109','frota@exemplo.com','Guarulhos','SP',u,true) RETURNING id INTO c3;
  INSERT INTO public.clientes(empresa_id,tipo,nome,documento,whatsapp,email,cidade,estado,responsavel_id,is_demo) VALUES (e,'PF','[DEMO] Fernanda Lima','456.789.123-45','21998765432','fernanda@exemplo.com','Rio de Janeiro','RJ',u,true) RETURNING id INTO c4;
  INSERT INTO public.clientes(empresa_id,tipo,nome,documento,whatsapp,email,cidade,estado,responsavel_id,is_demo) VALUES (e,'PF','[DEMO] João Pereira','321.654.987-11','31987651234','joao@exemplo.com','Belo Horizonte','MG',u,true) RETURNING id INTO c5;

  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,local_guarda,is_demo) VALUES (e,c1,'BRA2E19','Toyota','Corolla XEi',2022,2023,2023,142000,'Automóvel','Flex','Particular','Garagem fechada',true) RETURNING id INTO v1;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c2,'FTR4B21','Honda','HR-V EXL',2021,2021,2021,118000,'Automóvel','Flex','Particular',true) RETURNING id INTO v2;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c3,'QWE1A23','Volkswagen','Delivery 11.180',2020,2020,2020,265000,'Caminhão','Diesel','Comercial',true) RETURNING id INTO v3;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c3,'RTY5C67','Fiat','Fiorino Endurance',2023,2023,2023,98000,'Automóvel','Flex','Comercial',true) RETURNING id INTO v4;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c4,'KJH8D90','Jeep','Compass Longitude',2022,2022,2022,155000,'Automóvel','Flex','Particular',true) RETURNING id INTO v5;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c4,'MNB3F45','Honda','CG 160 Titan',2023,2024,2024,19500,'Moto','Flex','Particular',true) RETURNING id INTO v6;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c5,'PLO9G87','Hyundai','HB20 Comfort',2020,2021,2021,72000,'Automóvel','Flex','Aplicativo',true) RETURNING id INTO v7;
  INSERT INTO public.veiculos(empresa_id,cliente_id,placa,marca,modelo,ano_fabricacao,ano_modelo,ano,valor_fipe,tipo,combustivel,uso,is_demo) VALUES (e,c1,'ZXC6H54','Renault','Kwid Zen',2021,2022,2022,58000,'Automóvel','Flex','Particular',true) RETURNING id INTO v8;

  INSERT INTO public.condutores(empresa_id,veiculo_id,nome,cpf,cnh,relacao,is_demo) VALUES (e,v1,'[DEMO] Mariana Costa','123.456.789-09','01234567890','Próprio segurado',true),(e,v1,'[DEMO] Lucas Costa','111.222.333-44','09876543210','Cônjuge',true);

  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c1,v1,'Porto Seguro',s_porto,'DEMO-0531.001',d - 360,d + 5,3890,4200,15,'Cartão de crédito',4,u,true) RETURNING id INTO a1;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c2,v2,'Allianz',s_allianz,'DEMO-5177.020',d - 353,d + 12,3120,3600,18,'Boleto',3,u,true) RETURNING id INTO a2;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c3,v3,'Tokio Marine',s_tokio,'DEMO-8820.114',d - 340,d + 25,9850,12000,12,'Débito em conta',6,u,true) RETURNING id INTO a3;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c4,v5,'HDI',s_hdi,'DEMO-3310.557',d - 120,d + 245,4410,5100,15,'Cartão de crédito',10,u,true) RETURNING id INTO a4;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,is_demo) VALUES (e,c5,v7,'Azul Seguros',s_azul,'DEMO-7702.009',d - 320,d + 45,2680,2900,20,'Boleto',1,u,true) RETURNING id INTO a5;
  INSERT INTO public.apolices(empresa_id,cliente_id,veiculo_id,seguradora,seguradora_id,numero,inicio,vencimento,premio,franquia,comissao_percentual,forma_pagamento,parcelas_qtd,responsavel_id,status,is_demo) VALUES (e,c1,v8,'Porto Seguro',s_porto,'DEMO-0531.087',d - 370,d - 5,1980,2300,15,'Boleto',1,u,'Vigente',true) RETURNING id INTO a6;

  PERFORM public.gerar_parcelas(a1); PERFORM public.gerar_parcelas(a2); PERFORM public.gerar_parcelas(a3);
  PERFORM public.gerar_parcelas(a4); PERFORM public.gerar_parcelas(a5);
  UPDATE public.parcelas SET status = 'Pago', data_pagamento = vencimento WHERE empresa_id = e AND is_demo AND vencimento < d - 10;
  UPDATE public.comissoes SET status = 'Recebida', data_recebida = data_prevista WHERE empresa_id = e AND is_demo AND data_prevista < d - 5;

  INSERT INTO public.leads(empresa_id,nome,whatsapp,email,cidade,produto,origem,status,responsavel_id,data_entrada,is_demo) VALUES (e,'[DEMO] Camila Rocha','11955554444','camila@exemplo.com','São Paulo','Seguro Auto','Instagram','Novo',u,d,true) RETURNING id INTO l1;
  INSERT INTO public.leads(empresa_id,nome,whatsapp,cidade,produto,origem,status,responsavel_id,data_entrada,is_demo) VALUES
    (e,'[DEMO] Bruno Teixeira','11944443333','Osasco','Seguro Auto','Indicação','Contato',u,d-3,true),
    (e,'[DEMO] Aline Souza','11933332222','São Paulo','Seguro Moto','Google','Proposta',u,d-6,true),
    (e,'[DEMO] Marcos Vieira','19922221111','Campinas','Seguro Auto','Site','Negociação',u,d-9,true);

  INSERT INTO public.tarefas(empresa_id,cliente_id,apolice_id,titulo,tipo,data,horario,prioridade,responsavel_id,is_demo) VALUES
    (e,c1,a1,'Enviar proposta de renovação','Renovação',d,'09:30','Urgente',u,true),
    (e,c2,a2,'Ligar para confirmar dados do veículo','Ligação',d,'11:00','Alta',u,true),
    (e,c3,NULL,'Solicitar CRLV da frota','Documento',d+1,'14:00','Normal',u,true),
    (e,c4,NULL,'Pós-venda: confirmar recebimento da apólice','Pós-venda',d-1,'10:00','Normal',u,true);
  INSERT INTO public.tarefas(empresa_id,lead_id,titulo,tipo,data,horario,prioridade,responsavel_id,is_demo) VALUES (e,l1,'Primeiro contato com lead','WhatsApp',d,'16:00','Alta',u,true);

  INSERT INTO public.historico_contatos(empresa_id,cliente_id,tipo,descricao,usuario_id,data,is_demo) VALUES
    (e,c1,'WhatsApp','Cliente solicitou renovação.',u,d-2,true),
    (e,c1,'Ligação','Apresentada proposta de renovação.',u,d-1,true),
    (e,c3,'E-mail','Enviada relação de documentos da frota.',u,d-4,true);

  INSERT INTO public.sinistros(empresa_id,cliente_id,veiculo_id,apolice_id,tipo,data,protocolo,local,oficina,descricao,status,responsavel_id,is_demo) VALUES
    (e,c2,v2,a2,'Colisão',d-12,'SIN-2026-0441','Av. Industrial, Santo André','Oficina Centro Auto','Colisão traseira em semáforo.','Em reparo',u,true),
    (e,c4,v5,a4,'Vidros',d-3,'SIN-2026-0502','Rio de Janeiro','','Troca de para-brisa.','Documentação',u,true);
END $$;
REVOKE ALL ON FUNCTION public.gerar_dados_demo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_dados_demo() TO authenticated;

