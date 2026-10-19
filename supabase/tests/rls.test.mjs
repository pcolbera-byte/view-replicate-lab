// Testes do banco: aplica TODAS as migrações num Postgres local (PGlite) que simula o ambiente
// Supabase (auth.uid(), papéis authenticated/anon, storage) e verifica isolamento por corretora,
// perfis, convites, parcelas, comissões, renovação, conversão de lead e dados demo.
//
// Aplica as migrações em ordem, como estão nesta pasta.
// Como rodar (na raiz do projeto):
//   npm i --no-save @electric-sql/pglite
//   node supabase/tests/rls.test.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const db = new PGlite();
const MIG = new URL('../migrations', import.meta.url).pathname;
const stub = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA public, auth, storage TO authenticated, anon;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated;
`;
await db.exec(stub);
for (const f of fs.readdirSync(MIG).sort()) {
  try { await db.exec(fs.readFileSync(`${MIG}/${f}`, 'utf8')); console.log('OK', f); }
  catch (e) { console.error('FAIL', f, e.message); process.exit(1); }
}

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
async function signup(email, meta = {}) {
  const r = await db.query(`INSERT INTO auth.users(email, raw_user_meta_data) VALUES ($1,$2) RETURNING id`, [email, meta]);
  return r.rows[0].id;
}
async function as(uid, sql, params = []) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${uid}',false); SET ROLE authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec('RESET ROLE'); }
}
async function fails_(uid, sql, params = []) { try { await as(uid, sql, params); return null; } catch (e) { return e.message; } }
async function fails_db(sql) { try { await db.query(sql); return null; } catch (e) { return e.message; } }

console.log('\n# Cadastro e empresa');
const admA = await signup('ana@a.com', { nome: 'Ana' });
const admB = await signup('bia@b.com', { nome: 'Bia' });
const pa = (await db.query('SELECT * FROM profiles WHERE id=$1', [admA])).rows[0];
const pb = (await db.query('SELECT * FROM profiles WHERE id=$1', [admB])).rows[0];
ok(pa && pb && pa.empresa_id !== pb.empresa_id, 'cada cadastro sem convite cria corretora própria');
ok((await db.query('SELECT count(*)::int n FROM mensagens WHERE empresa_id=$1', [pa.empresa_id])).rows[0].n === 5, 'mensagens padrão criadas');
ok((await db.query(`SELECT role FROM user_roles WHERE user_id=$1`, [admA])).rows[0].role === 'admin', 'primeiro usuário é admin');

// Os testes de valores abaixo partem de imposto zero; o bloco do imposto testa os 2%.
await db.query('UPDATE empresas SET imposto_comissao=0');

console.log('\n# Convite');
await as(admA, `INSERT INTO convites(empresa_id,email,nome,role) VALUES ($1,'Carlos@A.com','Carlos','corretor')`, [pa.empresa_id]);
const corA = await signup('carlos@a.com');
const pc = (await db.query('SELECT * FROM profiles WHERE id=$1', [corA])).rows[0];
ok(pc.empresa_id === pa.empresa_id && pc.nome === 'Carlos', 'convidado entra na corretora de quem convidou');
ok((await db.query(`SELECT role FROM user_roles WHERE user_id=$1`, [corA])).rows[0].role === 'corretor', 'convidado recebe perfil do convite');
ok(!!(await fails_(admB, `INSERT INTO convites(empresa_id,email) VALUES ($1,'x@x.com')`, [pa.empresa_id])), 'não convida para outra corretora');
ok(!!(await fails_(corA, `INSERT INTO convites(empresa_id,email) VALUES ($1,'y@y.com')`, [pa.empresa_id])), 'corretor não cria convites');

console.log('\n# Isolamento');
const c = (await as(admA, `INSERT INTO clientes(empresa_id,nome) VALUES ($1,'Cliente A') RETURNING id`, [pa.empresa_id])).rows[0].id;
ok((await as(admB, `SELECT * FROM clientes`)).rows.length === 0, 'B não vê clientes de A');
ok(!!(await fails_(admB, `INSERT INTO clientes(empresa_id,nome) VALUES ($1,'x')`, [pa.empresa_id])), 'B não insere na empresa de A');
ok((await as(corA, `SELECT * FROM clientes`)).rows.length === 1, 'corretor vê clientes da própria corretora');
const cB = (await as(admB, `INSERT INTO clientes(empresa_id,nome) VALUES ($1,'Cliente B') RETURNING id`, [pb.empresa_id])).rows[0].id;
const vB = (await as(admB, `INSERT INTO veiculos(empresa_id,cliente_id,placa) VALUES ($1,$2,'BBB1B11') RETURNING id`, [pb.empresa_id, cB])).rows[0].id;
const v = (await as(admA, `INSERT INTO veiculos(empresa_id,cliente_id,placa) VALUES ($1,$2,'AAA1A11') RETURNING id`, [pa.empresa_id, c])).rows[0].id;
const c2 = (await as(admA, `INSERT INTO clientes(empresa_id,nome) VALUES ($1,'Outro A') RETURNING id`, [pa.empresa_id])).rows[0].id;
ok(!!(await fails_(admA, `INSERT INTO apolices(empresa_id,cliente_id,veiculo_id,seguradora,numero,inicio,vencimento) VALUES ($1,$2,$3,'X','1','2026-01-01','2027-01-01')`, [pa.empresa_id, c2, v])), 'apólice não aceita veículo de outro cliente (bug da política antiga corrigido)');
ok(!!(await fails_(admA, `INSERT INTO apolices(empresa_id,cliente_id,veiculo_id,seguradora,numero,inicio,vencimento) VALUES ($1,$2,$3,'X','1','2026-01-01','2027-01-01')`, [pa.empresa_id, c, vB])), 'apólice não aceita veículo de outra corretora');

console.log('\n# Apólice, parcelas, comissões, renovação');
const ap = (await as(corA, `INSERT INTO apolices(empresa_id,cliente_id,veiculo_id,seguradora,numero,inicio,vencimento,premio,premio_liquido,comissao_percentual,parcelas_qtd,responsavel_id) VALUES ($1,$2,$3,'Porto','P-1','2026-01-10','2027-01-10',1000,1000,15,3,$4) RETURNING id`, [pa.empresa_id, c, v, corA])).rows[0].id;
const n = (await as(corA, `SELECT gerar_parcelas($1) n`, [ap])).rows[0].n;
const parc = (await db.query(`SELECT valor FROM parcelas WHERE apolice_id=$1 ORDER BY numero`, [ap])).rows.map(r => Number(r.valor));
ok(n === 3 && parc.join() === '333.33,333.33,333.34', 'parcelas geradas somando o prêmio: ' + parc.join(' + '));
const com = (await db.query(`SELECT sum(valor)::numeric s FROM comissoes WHERE apolice_id=$1`, [ap])).rows[0].s;
ok(Number(com) === 150, 'comissões previstas = 15% do prêmio');
ok(!!(await fails_(corA, `SELECT gerar_parcelas($1)`, [ap])), 'não gera parcelas duplicadas');
ok(!!(await fails_(admB, `SELECT gerar_parcelas($1)`, [ap])), 'outra corretora não gera parcelas');
ok((await as(corA, `SELECT * FROM comissoes`)).rows.length === 3, 'corretor vê as próprias comissões');
const ap2 = (await as(admA, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,premio,comissao_percentual,responsavel_id) VALUES ($1,$2,'Porto','P-2','2026-01-10','2027-01-10',500,10,$3) RETURNING id`, [pa.empresa_id, c, admA])).rows[0].id;
await as(admA, `SELECT gerar_parcelas($1)`, [ap2]);
ok((await as(corA, `SELECT * FROM comissoes`)).rows.length === 3, 'corretor não vê comissões de outro responsável');
ok((await as(admA, `SELECT * FROM comissoes`)).rows.length === 4, 'admin vê todas as comissões');
ok((await as(corA, `UPDATE comissoes SET status='Recebida' RETURNING id`)).rows.length === 0, 'corretor não baixa comissão');
const ren = (await as(corA, `INSERT INTO apolices(empresa_id,cliente_id,veiculo_id,seguradora,numero,inicio,vencimento,premio,apolice_anterior_id) VALUES ($1,$2,$3,'Porto','P-1R','2027-01-10','2028-01-10',1100,$4) RETURNING id`, [pa.empresa_id, c, v, ap])).rows[0].id;
const old = (await db.query(`SELECT status, renovacao_status FROM apolices WHERE id=$1`, [ap])).rows[0];
ok(ren && old.status === 'Renovada' && old.renovacao_status === 'Renovada', 'nova apólice vinculada marca a anterior como renovada');
ok(!!(await fails_(corA, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,apolice_anterior_id) VALUES ($1,$2,'X','dup','2027-01-10','2028-01-10',$3)`, [pa.empresa_id, c, ap])), 'não permite renovação duplicada');

console.log('\n# Lead → cliente');
const lead = (await as(corA, `INSERT INTO leads(empresa_id,nome,documento) VALUES ($1,'Lead X','12.345.678/0001-95') RETURNING id`, [pa.empresa_id])).rows[0].id;
await as(corA, `INSERT INTO historico_contatos(empresa_id,lead_id,descricao,usuario_id) VALUES ($1,$2,'primeiro contato',$3)`, [pa.empresa_id, lead, corA]);
const novo = (await as(corA, `SELECT converter_lead($1) id`, [lead])).rows[0].id;
const cli = (await db.query(`SELECT tipo FROM clientes WHERE id=$1`, [novo])).rows[0];
const hist = (await db.query(`SELECT count(*)::int n FROM historico_contatos WHERE cliente_id=$1`, [novo])).rows[0].n;
ok(cli.tipo === 'PJ' && hist === 2, 'conversão cria cliente PJ e preserva histórico');
ok((await as(corA, `SELECT converter_lead($1) id`, [lead])).rows[0].id === novo, 'reconversão devolve o mesmo cliente');

console.log('\n# Perfis e exclusão');
ok((await as(corA, `DELETE FROM clientes WHERE id=$1 RETURNING id`, [c2])).rows.length === 0, 'corretor não exclui cliente');
ok((await as(admA, `DELETE FROM clientes WHERE id=$1 RETURNING id`, [c2])).rows.length === 1, 'admin exclui cliente');
ok(!!(await fails_(corA, `SELECT definir_usuario($1,'admin',true)`, [corA])), 'corretor não se promove');
ok(!!(await fails_(corA, `UPDATE profiles SET ativo=true WHERE id=$1`, [corA])), 'usuário não altera o próprio status');
ok(!!(await fails_(admB, `SELECT definir_usuario($1,'corretor',false)`, [corA])), 'admin de outra corretora não altera usuário');
await as(admA, `SELECT definir_usuario($1,'corretor',false)`, [corA]);
ok((await as(corA, `SELECT * FROM clientes`)).rows.length === 0, 'usuário desativado perde acesso aos dados');
await as(admA, `SELECT definir_usuario($1,'corretor',true)`, [corA]);
ok(!!(await fails_(corA, `UPDATE empresas SET nome='hack'`)) || (await as(corA, `UPDATE empresas SET nome='hack' RETURNING id`)).rows.length === 0, 'corretor não altera dados da empresa');
ok((await as(admA, `UPDATE empresas SET nome='Corretora A', dias_alerta_renovacao=45 RETURNING id`)).rows.length === 1, 'admin altera dados da empresa');

console.log('\n# Atividades');
const acts = (await as(corA, `SELECT descricao FROM atividades ORDER BY created_at`)).rows.map(r => r.descricao);
ok(acts.some(a => a.startsWith('Novo cliente')) && acts.some(a => a.includes('→ Renovada')), 'log registra criação e mudanças de status (' + acts.length + ' eventos)');
ok((await as(admB, `SELECT empresa_id FROM atividades`)).rows.every(r => r.empresa_id === pb.empresa_id), 'atividades isoladas por corretora');

console.log('\n# Documentos (storage)');
ok(!(await fails_(corA, `INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('documentos',$1,$2)`, [pa.empresa_id + '/abc-apolice.pdf', corA])), 'upload na pasta da própria corretora');
ok(!!(await fails_(corA, `INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('documentos',$1,$2)`, [pb.empresa_id + '/x.pdf', corA])), 'upload bloqueado na pasta de outra corretora');
ok((await as(admB, `SELECT * FROM storage.objects`)).rows.length === 0, 'B não lê arquivos de A');
ok(!(await fails_(corA, `INSERT INTO documentos(empresa_id,cliente_id,nome,caminho,enviado_por) VALUES ($1,$2,'apolice.pdf',$3,$4)`, [pa.empresa_id, c, pa.empresa_id + '/abc-apolice.pdf', corA])), 'metadados do documento gravados');
ok(!!(await fails_(corA, `INSERT INTO documentos(empresa_id,nome,caminho,enviado_por) VALUES ($1,'x',$2,$3)`, [pa.empresa_id, pb.empresa_id + '/x.pdf', corA])), 'metadado com caminho de outra corretora é recusado');

console.log('\n# Produtores e rateio');
const prodCasa = (await as(admA, `INSERT INTO produtores(empresa_id,nome,tipo) VALUES ($1,'Corretora A','Corretora') RETURNING id`, [pa.empresa_id])).rows[0].id;
const prodCarlos = (await as(admA, `INSERT INTO produtores(empresa_id,nome,usuario_id) VALUES ($1,'Carlos',$2) RETURNING id`, [pa.empresa_id, corA])).rows[0].id;
const prodB = (await as(admB, `INSERT INTO produtores(empresa_id,nome) VALUES ($1,'Produtor B') RETURNING id`, [pb.empresa_id])).rows[0].id;
ok(!!(await fails_(corA, `INSERT INTO produtores(empresa_id,nome) VALUES ($1,'X')`, [pa.empresa_id])), 'corretor não cadastra produtor');
ok((await as(corA, `SELECT * FROM produtores`)).rows.length === 2, 'corretor vê os produtores da corretora');
ok((await as(admB, `SELECT * FROM produtores`)).rows.length === 1, 'produtores isolados por corretora');
ok(!!(await fails_(admA, `INSERT INTO produtores(empresa_id,nome,usuario_id) VALUES ($1,'Y',$2)`, [pa.empresa_id, admB])), 'não vincula usuário de outra corretora');
ok(!!(await fails_(admA, `INSERT INTO clientes(empresa_id,nome,produtor_id) VALUES ($1,'Z',$2)`, [pa.empresa_id, prodB])), 'cliente não aceita produtor de outra corretora');
const cliP = (await as(corA, `INSERT INTO clientes(empresa_id,nome,produtor_id) VALUES ($1,'Cliente do Carlos',$2) RETURNING id`, [pa.empresa_id, prodCarlos])).rows[0].id;
const apR = (await as(admA, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,premio,premio_liquido,comissao_percentual,parcelas_qtd,produtor_id,responsavel_id) VALUES ($1,$2,'HDI','R-1','2026-01-01','2027-01-01',1200,1200,20,2,$3,$4) RETURNING id`, [pa.empresa_id, cliP, prodCarlos, admA])).rows[0].id;
await as(corA, `INSERT INTO apolice_rateio(empresa_id,apolice_id,produtor_id,percentual) VALUES ($1,$2,$3,50),($1,$2,$4,50)`, [pa.empresa_id, apR, prodCasa, prodCarlos]);
ok(!!(await fails_(corA, `INSERT INTO apolice_rateio(empresa_id,apolice_id,produtor_id,percentual) VALUES ($1,$2,$3,10)`, [pa.empresa_id, apR, prodB])), 'rateio não aceita produtor de outra corretora');
await as(admA, `SELECT gerar_parcelas($1)`, [apR]);
const rat = (await db.query(`SELECT produtor_id, sum(valor)::numeric s, count(*)::int n FROM comissoes WHERE apolice_id=$1 GROUP BY produtor_id`, [apR])).rows;
ok(rat.length === 2 && rat.every((r) => Number(r.s) === 120 && r.n === 2), 'comissão (R$ 240) dividida 50/50 por parcela entre os produtores');
const vis = (await as(corA, `SELECT produtor_id FROM comissoes WHERE apolice_id=$1`, [apR])).rows;
ok(vis.length === 2 && vis.every((r) => r.produtor_id === prodCarlos), 'produtor com login vê só a sua parte da comissão');
ok((await as(admA, `SELECT * FROM comissoes WHERE apolice_id=$1`, [apR])).rows.length === 4, 'admin vê todas as partes');
ok((await as(admB, `SELECT * FROM apolice_rateio`)).rows.length === 0, 'rateio isolado por corretora');

console.log('\n# Endossos');
const apE = (await as(admA, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,premio,comissao_percentual,parcelas_qtd,responsavel_id,ramo) VALUES ($1,$2,'Allianz','E-1','2026-02-01','2027-02-01',1200,10,4,$3,'Residencial') RETURNING id`, [pa.empresa_id, c, corA])).rows[0].id;
await as(admA, `SELECT gerar_parcelas($1)`, [apE]);
const e1 = (await as(corA, `SELECT registrar_endosso($1,'Inclusão','END-1','2026-03-01','2026-03-01',240,24,'Inclusão de cobertura de vendaval') id`, [apE])).rows[0].id;
const comE = (await db.query(`SELECT valor, endosso_id, responsavel_id FROM comissoes WHERE endosso_id=$1`, [e1])).rows;
ok(comE.length === 1 && Number(comE[0].valor) === 24 && comE[0].responsavel_id === corA, 'endosso gera a comissão da diferença');
ok((await as(admB, `SELECT * FROM endossos`)).rows.length === 0, 'B não vê endossos de A');
ok(!!(await fails_(admB, `SELECT registrar_endosso($1,'Inclusão')`, [apE])), 'B não endossa apólice de A');
ok(!!(await fails_(admB, `INSERT INTO endossos(empresa_id,apolice_id,tipo) VALUES ($1,$2,'Inclusão')`, [pb.empresa_id, apE])), 'endosso não aponta para apólice de outra corretora');
ok(!!(await fails_(corA, `INSERT INTO endossos(empresa_id,apolice_id,tipo) VALUES ($1,$2,'Qualquer')`, [pa.empresa_id, apE])), 'tipo de endosso validado');
ok((await as(corA, `DELETE FROM endossos WHERE id=$1 RETURNING id`, [e1])).rows.length === 0, 'corretor não exclui endosso');
await as(admA, `SELECT registrar_endosso($1,'Cancelamento','END-2','2026-04-15','2026-04-15',-600,-60,'Venda do imóvel')`, [apE]);
const apEc = (await db.query(`SELECT status FROM apolices WHERE id=$1`, [apE])).rows[0];
const parcE = (await db.query(`SELECT status, count(*)::int n FROM parcelas WHERE apolice_id=$1 GROUP BY status ORDER BY status`, [apE])).rows.map((r) => `${r.status}:${r.n}`).join(',');
const comCanc = (await db.query(`SELECT count(*)::int n FROM comissoes WHERE apolice_id=$1 AND status='Cancelada'`, [apE])).rows[0].n;
ok(apEc.status === 'Cancelada' && parcE === 'Cancelado:1,Pendente:3' && comCanc === 2, `cancelamento cancela apólice, parcelas (${parcE}) e comissões futuras (${comCanc})`);
ok(!!(await fails_(admA, `SELECT registrar_endosso($1,'Inclusão')`, [apE])), 'não endossa apólice cancelada');
ok(!!(await fails_(admA, `UPDATE comissoes SET endosso_id=$1 WHERE apolice_id=$2`, [e1, ap])), 'comissão não aponta para endosso de outra apólice');
await as(admA, `DELETE FROM endossos WHERE id=$1`, [e1]);
ok((await db.query(`SELECT count(*)::int n FROM comissoes WHERE endosso_id=$1`, [e1])).rows[0].n === 0, 'excluir endosso remove a comissão dele');

console.log('\n# Endosso de troca de veículo');
const apT = (await as(admA, `INSERT INTO apolices(empresa_id,cliente_id,veiculo_id,seguradora,numero,inicio,vencimento,premio,comissao_percentual,parcelas_qtd,franquia) VALUES ($1,$2,$3,'Porto','T-1','2026-01-10','2027-01-10',2400,10,2,3000) RETURNING id`, [pa.empresa_id, c, v])).rows[0].id;
await as(admA, `SELECT gerar_parcelas($1)`, [apT]);
const vNovo = (await as(admA, `INSERT INTO veiculos(empresa_id,cliente_id,placa,marca,modelo) VALUES ($1,$2,'NEW1A23','Honda','Civic') RETURNING id`, [pa.empresa_id, c])).rows[0].id;
const vOutroCli = (await as(admA, `INSERT INTO veiculos(empresa_id,cliente_id,placa) VALUES ($1,$2,'OUT1A23') RETURNING id`, [pa.empresa_id, cliP])).rows[0].id;
ok(!!(await fails_(corA, `SELECT registrar_endosso($1,'Troca de veículo')`, [apT])), 'troca de veículo exige o novo veículo');
ok(!!(await fails_(corA, `SELECT registrar_endosso(_apolice=>$1,_tipo=>'Troca de veículo',_veiculo=>$2)`, [apT, vOutroCli])), 'troca não aceita veículo de outro cliente');
ok(!!(await fails_(admB, `SELECT registrar_endosso(_apolice=>$1,_tipo=>'Troca de veículo',_veiculo=>$2)`, [apT, vNovo])), 'B não troca veículo de apólice de A');
const eT = (await as(corA, `SELECT registrar_endosso(_apolice=>$1,_tipo=>'Troca de veículo',_numero=>'T-E1',_data=>'2026-05-02',_inicio=>'2026-05-02',_premio=>300,_comissao=>30,_forma=>'Cartão de crédito',_parcelas=>3,_vencimento=>'2026-05-20',_veiculo=>$2,_dados=>'{"franquia_nova":3500,"cep_pernoite":"01310-100"}'::jsonb) id`, [apT, vNovo])).rows[0].id;
const apTr = (await db.query(`SELECT veiculo_id, franquia FROM apolices WHERE id=$1`, [apT])).rows[0];
const eTr = (await db.query(`SELECT veiculo_id, veiculo_anterior_id, forma_pagamento, parcelas_qtd, dados FROM endossos WHERE id=$1`, [eT])).rows[0];
ok(apTr.veiculo_id === vNovo && Number(apTr.franquia) === 3500, 'apólice passa a ter o novo veículo e a nova franquia');
ok(eTr.veiculo_anterior_id === v && eTr.forma_pagamento === 'Cartão de crédito' && Number(eTr.dados.franquia_anterior) === 3000 && eTr.dados.cep_pernoite === '01310-100', 'endosso guarda veículo anterior, forma de pagamento e outros dados');
const pT = (await db.query(`SELECT numero, valor::text, vencimento::text v FROM parcelas WHERE endosso_id=$1 ORDER BY numero`, [eT])).rows;
ok(pT.length === 3 && pT.map((r) => r.numero).join() === '3,4,5' && pT.map((r) => r.valor).join() === '100.00,100.00,100.00' && pT[0].v === '2026-05-20' && pT[2].v === '2026-07-20', 'diferença parcelada em 3x depois das parcelas da apólice');
await as(admA, `DELETE FROM endossos WHERE id=$1`, [eT]);
const apTd = (await db.query(`SELECT veiculo_id, franquia FROM apolices WHERE id=$1`, [apT])).rows[0];
ok(apTd.veiculo_id === v && Number(apTd.franquia) === 3000 && (await db.query(`SELECT count(*)::int n FROM parcelas WHERE apolice_id=$1`, [apT])).rows[0].n === 2, 'excluir o endosso devolve veículo, franquia e remove as parcelas dele');

console.log('\n# Comissão sobre o prêmio líquido');
ok(Number((await db.query(`SELECT aliquota_iof('Auto') a`)).rows[0].a) === 7.38 && Number((await db.query(`SELECT aliquota_iof('Vida') a`)).rows[0].a) === 0.38, 'alíquotas de IOF por ramo');
// Informado: líquido 1000 + adicional 50 + custo 0 + IOF 77,49 = 1127,49; comissão 15% sobre 1000
const apL = (await as(admA, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,premio,premio_liquido,adicional_fracionamento,iof,comissao_percentual,parcelas_qtd,ramo) VALUES ($1,$2,'Porto','L-1','2026-01-10','2027-01-10',1127.49,1000,50,77.49,15,2,'Auto') RETURNING id`, [pa.empresa_id, c])).rows[0].id;
await as(admA, `SELECT gerar_parcelas($1)`, [apL]);
const cL = (await db.query(`SELECT sum(valor)::numeric s FROM comissoes WHERE apolice_id=$1`, [apL])).rows[0].s;
const pL = (await db.query(`SELECT sum(valor)::numeric s FROM parcelas WHERE apolice_id=$1`, [apL])).rows[0].s;
ok(Number(cL) === 150 && Number(pL) === 1127.49, `comissão sobre o líquido (${cL}) e parcelas sobre o total (${pL})`);
// Sem líquido informado: deriva do total tirando o IOF de 7,38%
const apD = (await as(admA, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,premio,comissao_percentual,parcelas_qtd,ramo) VALUES ($1,$2,'Porto','L-2','2026-01-10','2027-01-10',1073.80,10,1,'Auto') RETURNING id`, [pa.empresa_id, c])).rows[0].id;
await as(admA, `SELECT gerar_parcelas($1)`, [apD]);
ok(Number((await db.query(`SELECT sum(valor)::numeric s FROM comissoes WHERE apolice_id=$1`, [apD])).rows[0].s) === 100, 'sem líquido informado: total 1.073,80 → líquido 1.000 → comissão 100');
// Recalcular: comissão antiga calculada sobre o total
await db.query(`UPDATE comissoes SET valor=107.38 WHERE apolice_id=$1`, [apD]);
ok(!!(await fails_(corA, `SELECT recalcular_comissoes($1)`, [apD])), 'só o administrador recalcula');
ok((await as(admA, `SELECT recalcular_comissoes() n`)).rows[0].n >= 1 && Number((await db.query(`SELECT valor FROM comissoes WHERE apolice_id=$1`, [apD])).rows[0].valor) === 100, 'recalcular corrige a comissão prevista para o líquido');
const recebida = (await db.query(`SELECT id FROM comissoes WHERE apolice_id=$1 ORDER BY parcela LIMIT 1`, [apL])).rows[0].id;
await db.query(`UPDATE comissoes SET status='Recebida', valor=1 WHERE id=$1`, [recebida]);
await as(admA, `SELECT recalcular_comissoes($1)`, [apL]);
ok(Number((await db.query(`SELECT valor FROM comissoes WHERE id=$1`, [recebida])).rows[0].valor) === 1, 'comissão já recebida não é alterada');
ok((await as(admB, `SELECT recalcular_comissoes($1) n`, [apL])).rows[0].n === 0, 'B não recalcula apólice de A');

console.log('\n# Imposto sobre a comissão');
ok(Number((await db.query(`SELECT column_default FROM information_schema.columns WHERE table_name='empresas' AND column_name='imposto_comissao'`)).rows[0].column_default) === 2, 'imposto padrão de 2%');
await as(admA, `UPDATE empresas SET imposto_comissao=2 WHERE id=$1`, [pa.empresa_id]);
const apI = (await as(admA, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,premio,premio_liquido,comissao_percentual,parcelas_qtd,ramo) VALUES ($1,$2,'Porto','I-1','2026-01-10','2027-01-10',1073.80,1000,15,1,'Auto') RETURNING id`, [pa.empresa_id, c])).rows[0].id;
await as(admA, `SELECT gerar_parcelas($1)`, [apI]);
ok(Number((await db.query(`SELECT sum(valor)::numeric s FROM comissoes WHERE apolice_id=$1`, [apI])).rows[0].s) === 147, 'comissão 15% de 1.000 menos 2% de imposto = 147');
await as(admA, `UPDATE empresas SET imposto_comissao=5 WHERE id=$1`, [pa.empresa_id]);
await as(admA, `SELECT recalcular_comissoes($1)`, [apI]);
ok(Number((await db.query(`SELECT sum(valor)::numeric s FROM comissoes WHERE apolice_id=$1`, [apI])).rows[0].s) === 142.5, 'mudando para 5%, o recálculo dá 142,50');
ok(!!(await fails_(admA, `UPDATE empresas SET imposto_comissao=150 WHERE id=$1`, [pa.empresa_id])), 'imposto fora da faixa é recusado');
await as(admA, `UPDATE empresas SET imposto_comissao=0 WHERE id=$1`, [pa.empresa_id]);

console.log('\n# Ramos e coberturas');
await as(corA, `UPDATE apolices SET dados_ramo='{"endereco":"Rua A, 1","tipo_imovel":"Casa"}' WHERE id=$1`, [apE]);
ok((await db.query(`SELECT dados_ramo->>'tipo_imovel' t FROM apolices WHERE id=$1`, [apE])).rows[0].t === 'Casa', 'dados do ramo gravados na apólice');
await as(corA, `INSERT INTO apolice_coberturas(empresa_id,apolice_id,nome,limite,franquia) VALUES ($1,$2,'Incêndio',500000,'Não há'),($1,$2,'Vendaval',50000,'R$ 1.000')`, [pa.empresa_id, apE]);
ok((await as(corA, `SELECT * FROM apolice_coberturas WHERE apolice_id=$1`, [apE])).rows.length === 2, 'corretor cadastra coberturas');
ok((await as(admB, `SELECT * FROM apolice_coberturas`)).rows.length === 0, 'B não vê coberturas de A');
ok(!!(await fails_(admB, `INSERT INTO apolice_coberturas(empresa_id,apolice_id,nome) VALUES ($1,$2,'X')`, [pb.empresa_id, apE])), 'cobertura não aponta para apólice de outra corretora');

console.log('\n# Conciliação de comissões');
const prevs = (await db.query(`SELECT id, valor FROM comissoes WHERE apolice_id=$1 AND status='Prevista' ORDER BY parcela`, [ap])).rows;
const itens = JSON.stringify([{ comissao_id: prevs[0].id, valor: Number(prevs[0].valor) }, { comissao_id: prevs[1].id, valor: 49.9 }]);
ok(!!(await fails_(corA, `SELECT baixar_comissoes_conciliadas('Porto','extrato.csv','2026-03-10',3,99.9,$1::jsonb)`, [itens])), 'corretor não concilia');
const itensB = JSON.stringify([{ comissao_id: prevs[0].id, valor: 1 }]);
ok(!!(await fails_(admB, `SELECT baixar_comissoes_conciliadas('Porto','x.csv','2026-03-10',1,1,$1::jsonb)`, [itensB])), 'B não dá baixa em comissão de A');
const conc = (await as(admA, `SELECT baixar_comissoes_conciliadas('Porto','extrato.csv','2026-03-10',3,99.9,$1::jsonb) id`, [itens])).rows[0].id;
const baix = (await db.query(`SELECT status, valor_recebido, data_recebida::text d FROM comissoes WHERE conciliacao_id=$1 ORDER BY parcela`, [conc])).rows;
const cRow = (await db.query(`SELECT baixadas, valor_baixado FROM conciliacoes WHERE id=$1`, [conc])).rows[0];
ok(baix.length === 2 && baix.every((r) => r.status === 'Recebida' && r.d === '2026-03-10') && Number(baix[1].valor_recebido) === 49.9, 'baixa em lote com o valor do extrato');
ok(cRow.baixadas === 2 && Number(cRow.valor_baixado) === Number(prevs[0].valor) + 49.9, 'conciliação registra totais');
ok((await as(corA, `SELECT * FROM conciliacoes`)).rows.length === 0 && (await as(admB, `SELECT * FROM conciliacoes`)).rows.length === 0, 'conciliações só para o administrador da corretora');
ok((await as(admA, `SELECT desfazer_conciliacao($1) n`, [conc])).rows[0].n === 2 && (await db.query(`SELECT count(*)::int n FROM comissoes WHERE id=ANY($1) AND status='Prevista' AND valor_recebido IS NULL`, [[prevs[0].id, prevs[1].id]])).rows[0].n === 2, 'desfazer conciliação volta as comissões para Prevista');

console.log('\n# Repasse a produtores');
const comCarlos = (await db.query(`SELECT id, valor FROM comissoes WHERE apolice_id=$1 AND produtor_id=$2 ORDER BY parcela`, [apR, prodCarlos])).rows;
const itRep = JSON.stringify(comCarlos.map((x) => ({ comissao_id: x.id, base: Number(x.valor), percentual: 50 })));
ok(!!(await fails_(corA, `SELECT gerar_repasse($1,'2026-03-01',$2::jsonb)`, [prodCarlos, itRep])), 'corretor não gera repasse');
ok(!!(await fails_(admB, `SELECT gerar_repasse($1,'2026-03-01',$2::jsonb)`, [prodB, itRep])), 'B não repassa comissões de A');
const rep = (await as(admA, `SELECT gerar_repasse($1,'2026-03-20',$2::jsonb,'março') id`, [prodCarlos, itRep])).rows[0].id;
const repRow = (await db.query(`SELECT valor, competencia::text c, status FROM repasses WHERE id=$1`, [rep])).rows[0];
const esperado = comCarlos.reduce((t, x) => t + Math.round(Number(x.valor) * 50) / 100, 0);
ok(Math.abs(Number(repRow.valor) - esperado) < 0.01 && repRow.c === '2026-03-01' && repRow.status === 'Aberto', `repasse com total ${repRow.valor} na competência ${repRow.c}`);
ok(!!(await fails_(admA, `SELECT gerar_repasse($1,'2026-04-01',$2::jsonb)`, [prodCarlos, itRep])), 'a mesma comissão não é repassada duas vezes');
ok((await as(corA, `SELECT * FROM repasses`)).rows.length === 1 && (await as(corA, `SELECT * FROM repasse_itens`)).rows.length === comCarlos.length, 'produtor com login vê o próprio repasse');
ok((await fails_(corA, `UPDATE repasses SET status='Pago' WHERE id=$1`, [rep])) !== null || (await db.query(`SELECT status FROM repasses WHERE id=$1`, [rep])).rows[0].status === 'Aberto', 'produtor não marca repasse como pago');
await as(admA, `UPDATE repasses SET status='Pago', pago_em='2026-04-05', forma_pagamento='PIX' WHERE id=$1`, [rep]);
ok((await db.query(`SELECT status FROM repasses WHERE id=$1`, [rep])).rows[0].status === 'Pago', 'administrador marca repasse como pago');
ok((await as(admB, `SELECT * FROM repasses`)).rows.length === 0, 'B não vê repasses de A');
ok(!!(await fails_(admB, `INSERT INTO repasses(empresa_id,produtor_id,competencia) VALUES ($1,$2,'2026-01-01')`, [pb.empresa_id, prodCarlos])), 'repasse não aponta para produtor de outra corretora');
// dados de B para o teste de exclusão de conta (cadeia de chaves estrangeiras)
const apB = (await as(admB, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,premio,comissao_percentual,produtor_id) VALUES ($1,$2,'X','B-1','2026-01-01','2027-01-01',500,10,$3) RETURNING id`, [pb.empresa_id, cB, prodB])).rows[0].id;
await as(admB, `SELECT gerar_parcelas($1, 1)`, [apB]);
await as(admB, `SELECT registrar_endosso($1,'Inclusão','1','2026-02-01',NULL,10,1)`, [apB]);
const comB = (await db.query(`SELECT id, valor FROM comissoes WHERE apolice_id=$1 AND endosso_id IS NULL`, [apB])).rows[0];
await as(admB, `SELECT gerar_repasse($1,'2026-02-01',$2::jsonb)`, [prodB, JSON.stringify([{ comissao_id: comB.id, base: Number(comB.valor), percentual: 30 }])]);

console.log('\n# Dados de demonstração');
ok(!!(await fails_(corA, `SELECT gerar_dados_demo()`)), 'corretor não gera demo');
await as(admA, `SELECT gerar_dados_demo()`);
const cnt = async t => (await as(admA, `SELECT count(*)::int n FROM ${t} WHERE is_demo`)).rows[0].n;
const counts = { clientes: await cnt('clientes'), veiculos: await cnt('veiculos'), apolices: await cnt('apolices'), leads: await cnt('leads'), tarefas: await cnt('tarefas'), sinistros: await cnt('sinistros'), parcelas: await cnt('parcelas'), comissoes: await cnt('comissoes') };
ok(counts.clientes === 5 && counts.veiculos === 8 && counts.apolices === 6 && counts.leads === 4 && counts.sinistros === 2 && counts.tarefas === 5, 'demo criado: ' + JSON.stringify(counts));
ok((await as(admB, `SELECT count(*)::int n FROM clientes`)).rows[0].n === 1, 'demo não vaza para outra corretora');
ok(!!(await fails_(admA, `SELECT gerar_dados_demo()`)), 'demo não duplica');
await as(admA, `SELECT limpar_dados_demo()`);
ok((await cnt('clientes')) + (await cnt('apolices')) + (await cnt('parcelas')) === 0, 'limpeza remove todos os dados demo');
ok((await as(admA, `SELECT count(*)::int n FROM clientes`)).rows[0].n === 3, 'limpeza preserva dados reais');
// Usuário trabalhou em cima dos dados de demonstração: tarefa, contato, apólice, endosso e
// uma renovação real de apólice demo. A limpeza precisa funcionar mesmo assim.
await as(admA, `SELECT gerar_dados_demo()`);
const dc = (await db.query(`SELECT id FROM clientes WHERE empresa_id=$1 AND is_demo LIMIT 1`, [pa.empresa_id])).rows[0].id;
const da = (await db.query(`SELECT id, cliente_id FROM apolices WHERE empresa_id=$1 AND is_demo AND status='Vigente' LIMIT 1`, [pa.empresa_id])).rows[0];
await as(admA, `INSERT INTO tarefas(empresa_id,cliente_id,titulo,data) VALUES ($1,$2,'real',current_date)`, [pa.empresa_id, dc]);
await as(admA, `INSERT INTO historico_contatos(empresa_id,cliente_id,tipo,data,descricao) VALUES ($1,$2,'WhatsApp',current_date,'real')`, [pa.empresa_id, dc]);
await as(admA, `INSERT INTO veiculos(empresa_id,cliente_id,placa) VALUES ($1,$2,'REA1L11')`, [pa.empresa_id, dc]);
await as(admA, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,premio) VALUES ($1,$2,'X','REAL-DEMO','2026-01-01','2027-01-01',100)`, [pa.empresa_id, dc]);
await as(admA, `SELECT registrar_endosso($1,'Inclusão','E9','2026-03-01',NULL,10,1)`, [da.id]);
await as(admA, `INSERT INTO apolices(empresa_id,cliente_id,seguradora,numero,inicio,vencimento,premio,apolice_anterior_id) VALUES ($1,$2,'X','RENOV-REAL','2027-01-01','2028-01-01',100,$3)`, [pa.empresa_id, c, da.id]);
await as(admA, `SELECT limpar_dados_demo()`);
ok((await cnt('clientes')) === 0 && (await db.query(`SELECT count(*)::int n FROM apolices WHERE numero='REAL-DEMO'`)).rows[0].n === 0, 'limpeza remove o que foi criado em cima dos clientes de demonstração');
const renov = (await db.query(`SELECT apolice_anterior_id FROM apolices WHERE numero='RENOV-REAL'`)).rows[0];
ok(renov && renov.apolice_anterior_id === null, 'apólice real que renovava uma demo fica, sem o vínculo');
ok((await as(admA, `SELECT count(*)::int n FROM clientes`)).rows[0].n === 3, 'clientes reais preservados');

console.log('\n# Assinatura');
const asA = (await as(admA, `SELECT * FROM assinaturas`)).rows;
ok(asA.length === 1 && asA[0].status === 'teste' && asA[0].empresa_id === pa.empresa_id, 'corretora nova começa em teste grátis');
ok((await db.query(`SELECT (teste_ate - current_date)::int d FROM assinaturas WHERE empresa_id=$1`, [pa.empresa_id])).rows[0].d === 14, 'teste de 14 dias');
ok((await as(corA, `SELECT * FROM assinaturas`)).rows.length === 1, 'corretor vê a assinatura da corretora');
ok(!!(await fails_(admA, `UPDATE assinaturas SET status='ativa'`)), 'usuário não altera a própria assinatura');
ok(!!(await fails_(admA, `INSERT INTO assinaturas(empresa_id,status) VALUES ($1,'isenta')`, [pb.empresa_id])), 'usuário não cria assinatura');
ok((await as(admB, `SELECT * FROM assinaturas WHERE empresa_id=$1`, [pa.empresa_id])).rows.length === 0, 'assinatura isolada por corretora');

console.log('\n# Painel do dono');
ok((await as(admA, `SELECT sou_dono() d`)).rows[0].d === false, 'usuário comum não é dono');
ok(!!(await fails_(admA, `SELECT * FROM dono_corretoras()`)), 'usuário comum não lista corretoras');
ok(!!(await fails_(admA, `SELECT dono_alterar_assinatura($1,'isentar')`, [pa.empresa_id])), 'usuário comum não se isenta');
ok(!!(await fails_(admA, `SELECT * FROM plataforma_donos`)), 'tabela de donos não é legível');
const dono = await signup('dono@corretix.com', { nome: 'Dono' });
await db.query(`INSERT INTO plataforma_donos(user_id) VALUES ($1)`, [dono]);
ok((await as(dono, `SELECT sou_dono() d`)).rows[0].d === true, 'dono reconhecido');
const lista = (await as(dono, `SELECT * FROM dono_corretoras()`)).rows;
const la = lista.find((r) => r.empresa_id === pa.empresa_id);
ok(lista.length >= 3 && la && la.admin_email === 'ana@a.com' && la.clientes === 3 && la.usuarios === 2, 'dono vê todas as corretoras com admin e contagens');
await as(dono, `SELECT dono_alterar_assinatura($1,'estender',10)`, [pa.empresa_id]);
ok((await db.query(`SELECT (teste_ate - current_date)::int d FROM assinaturas WHERE empresa_id=$1`, [pa.empresa_id])).rows[0].d === 24, 'dono estende o teste (+10 dias)');
await as(dono, `SELECT dono_alterar_assinatura($1,'isentar')`, [pa.empresa_id]);
ok((await db.query(`SELECT status FROM assinaturas WHERE empresa_id=$1`, [pa.empresa_id])).rows[0].status === 'isenta', 'dono isenta');
await as(dono, `SELECT dono_alterar_assinatura($1,'remover_isencao')`, [pa.empresa_id]);
ok((await db.query(`SELECT status FROM assinaturas WHERE empresa_id=$1`, [pa.empresa_id])).rows[0].status === 'teste', 'dono remove isenção (volta ao teste)');
ok(!!(await fails_(dono, `SELECT dono_alterar_assinatura($1,'estender',0)`, [pa.empresa_id])), 'dias inválidos recusados');
ok(!!(await fails_(dono, `SELECT dono_backup_plataforma()`)), 'backup de todas as corretoras não existe mais');
await as(dono, `SELECT dono_alterar_assinatura($1,'estender',5)`, [pb.empresa_id]);
const regA = (await as(admA, `SELECT acao, detalhes FROM dono_acessos ORDER BY created_at`)).rows;
ok(regA.length === 3 && regA[0].acao === 'assinatura_estender' && regA[0].detalhes.dias === 10 && regA.some((r) => r.acao === 'assinatura_isentar'), 'corretora vê o que o dono fez na conta dela');
ok((await as(admB, `SELECT acao FROM dono_acessos`)).rows.length === 1, 'cada corretora vê só o registro dela');
ok((await as(corA, `SELECT acao FROM dono_acessos`)).rows.length === 3, 'corretor também vê o registro da corretora');
ok(!!(await fails_(admA, `INSERT INTO dono_acessos(acao, corretora_id) VALUES ('x', $1)`, [pa.empresa_id])), 'usuário não escreve no registro');
ok(!!(await fails_(dono, `DELETE FROM dono_acessos`)), 'dono não apaga o registro pelo app');
ok(/não pode ser alterado/.test(await fails_db(`DELETE FROM dono_acessos`) || ''), 'nem o administrador do banco apaga o registro');
ok(/não pode ser alterado/.test(await fails_db(`UPDATE dono_acessos SET acao='x'`) || ''), 'nem altera o registro');
ok(/não pode ser alterado/.test(await fails_db(`TRUNCATE dono_acessos`) || ''), 'nem esvazia o registro');

console.log('\n# Excluir minha conta');
ok(/único administrador/.test(await fails_(admA, `SELECT excluir_minha_conta()`) || ''), 'único admin com outros usuários precisa promover alguém antes');
const r1 = (await as(corA, `SELECT excluir_minha_conta() r`)).rows[0].r;
ok(r1 === 'conta' && (await db.query(`SELECT count(*)::int n FROM auth.users WHERE id=$1`, [corA])).rows[0].n === 0, 'corretor exclui só a própria conta');
ok((await db.query(`SELECT usuario_id FROM produtores WHERE id=$1`, [prodCarlos])).rows[0].usuario_id === null, 'produtor fica sem usuário vinculado');
ok((await as(admA, `SELECT count(*)::int n FROM clientes`)).rows[0].n === 3, 'dados da corretora permanecem');
await as(admB, `SELECT gerar_dados_demo()`);
const empB = pb.empresa_id;
const r2 = (await as(admB, `SELECT excluir_minha_conta() r`)).rows[0].r;
const sobra = (await db.query(`SELECT (SELECT count(*) FROM empresas WHERE id=$1) + (SELECT count(*) FROM clientes WHERE empresa_id=$1) + (SELECT count(*) FROM apolices WHERE empresa_id=$1) + (SELECT count(*) FROM comissoes WHERE empresa_id=$1) AS n`, [empB])).rows[0].n;
ok(r2 === 'conta_e_corretora' && Number(sobra) === 0, 'único usuário apaga a conta e todos os dados da corretora');
ok((await as(admA, `SELECT count(*)::int n FROM clientes`)).rows[0].n === 3, 'outra corretora não é afetada');
ok((await db.query(`SELECT count(*)::int n FROM dono_acessos WHERE corretora_id=$1`, [empB])).rows[0].n === 1, 'registro de acessos fica mesmo após excluir a corretora');
ok(!!(await fails_(null, `SELECT excluir_minha_conta()`)), 'sem login não exclui nada');

console.log(fails ? `\n${fails} FALHA(S)` : '\nTodos os testes passaram.');
process.exit(fails ? 1 : 0);
