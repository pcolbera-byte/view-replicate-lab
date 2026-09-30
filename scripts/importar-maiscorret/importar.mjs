#!/usr/bin/env node
// Importa a base do Mais Corret (.mdb do Access) para o Corretor360.
//
//   Simular (não grava nada, gera relatório e prévias em ./previa):
//     node importar.mjs caminho/da/base.mdb --simular
//
//   Importar de verdade (entra com o seu login de ADMINISTRADOR; respeita o RLS):
//     SUPABASE_URL=... SUPABASE_KEY=... node importar.mjs caminho/da/base.mdb --email voce@corretora.com
//     (a senha é pedida no terminal; também aceita a variável SENHA)
//
// Pode ser executado mais de uma vez: os IDs são derivados dos códigos do sistema antigo,
// então registros já importados são ignorados (nada é duplicado nem sobrescrito).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import MDBReader from 'mdb-reader';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
if (!file || !fs.existsSync(file)) {
  console.error('Uso: node importar.mjs base.mdb [--simular] [--email admin@corretora.com]');
  process.exit(1);
}
const SIMULAR = flag('simular');
const TODAY = new Date().toISOString().slice(0, 10);
const NOW = new Date().toISOString();
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ------------------------------------------------------------------ leitura
const reader = new MDBReader(fs.readFileSync(file));
const table = (name) => (reader.getTableNames().includes(name) ? reader.getTable(name).getData() : []);
const T = {
  clientes: table('clientes'), fones: table('telefonecliente'), enderecos: table('enderecocliente'), internet: table('internetcliente'),
  pastas: table('seg_pastas'), propostas: table('seg_proposta'), itensauto: table('itensauto'), parcelas: table('parcelas'),
  comissoes: table('comissao_parcelas'), seguradoras: table('seguradoras'), produtores: table('produtores'),
  tipoEndosso: table('tap_tipoendosso'), motivos: table('tap_nrenovacao'), acoes: table('acao'),
};

// ------------------------------------------------------------------ utilidades
const iso = (v) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : null);
const txt = (v) => (v == null ? '' : String(v).trim());
const digits = (v) => txt(v).replace(/\D/g, '');
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const title = (s) => txt(s).toLowerCase().replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
function phone(v) {
  let d = digits(v);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return '';
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}
function doc(v) {
  const d = digits(v);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return txt(v);
}
function validCPF(d) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const c = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return c(9) === Number(d[9]) && c(10) === Number(d[10]);
}
function validCNPJ(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const c = (n) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const r = w.reduce((a, x, i) => a + Number(d[i]) * x, 0) % 11; return r < 2 ? 0 : 11 - r; };
  return c(12) === Number(d[12]) && c(13) === Number(d[13]);
}
/** UUID determinístico (v5-like) a partir do código antigo — permite reexecutar sem duplicar. */
let EMPRESA = 'simulacao';
const uid = (kind, key) => {
  const h = crypto.createHash('sha1').update(`maiscorret:${EMPRESA}:${kind}:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// ------------------------------------------------------------------ tabelas de apoio
const ESTADO_CIVIL = { 1: 'Solteiro(a)', 2: 'Casado(a)', 3: 'Divorciado(a)', 4: 'Divorciado(a)', 5: 'Viúvo(a)', 7: 'União estável' };
const COMBUSTIVEL = { 1: 'Etanol', 2: 'Gasolina', 3: 'Diesel', 4: 'GNV', 5: 'Flex', 6: 'Elétrico' };
const USO = { 1: 'Particular', 21: 'Comercial', 3: 'Táxi', 2: 'Comercial', 4: 'Comercial', 5: 'Outro', 8: 'Outro' };
const PAGAMENTO = { 1: 'Carnê', 2: 'Débito em conta', 5: 'Cartão de crédito', 6: 'Boleto' };
const RAMO = {
  'AUTOMÓVEL': 'Auto', 'RASTREADOR + SEGURO': 'Auto', 'RESIDÊNCIA': 'Residencial', 'EMPRESA': 'Empresarial', 'CONDOMÍNIO': 'Condomínio',
  'VIDA': 'Vida', 'SAÚDE': 'Saúde', 'PREVIDÊNCIA PRIVADA': 'Previdência', 'RESPONSABILIDADE CIVIL': 'Responsabilidade civil',
  'RD EQUIPAMENTOS': 'Equipamentos', 'EQUIPAMENTOS PORTATEIS': 'Equipamentos', 'RISCOS DE ENGENHARIA': 'Riscos de engenharia',
  'ALUGUEL': 'Fiança locatícia', 'VIAGEM': 'Viagem', 'ASSISTÊNCIA FUNERAL': 'Funeral', 'CAPITALIZAÇÃO': 'Capitalização', 'CELULAR': 'Celular',
};
const segByCode = new Map(T.seguradoras.map((s) => [s.codseg, s]));
const segTitle = (s) => title(s).replace(/\b(\p{L}{2,3})\b/gu, (w) => (/^(de|da|do|e)$/i.test(w) ? w.toLowerCase() : w.toUpperCase())).replace(/\bItau\b/i, 'Itaú').replace(/\bSul America\b/i, 'SulAmérica');
const segName = (code) => segTitle(segByCode.get(code)?.descricao) || (code ? `Seguradora cód. ${code}` : 'Não informada');
const prodName = new Map(T.produtores.map((p) => [p.codprod, title(p.nome)]));
const endossoTipo = new Map(T.tipoEndosso.map((t) => [t.codtipoendosso, title(t.descricaotipoendosso)]));
const motivo = new Map(T.motivos.map((m) => [m.codigo, title(m.descricao)]));
const pastaById = new Map(T.pastas.map((p) => [p.chavepasta, p]));


// Marca a partir do modelo (o sistema antigo guarda só a descrição)
const MARCAS = {
  Volkswagen: ['gol', 'fox', 'polo', 'voyage', 'saveiro', 'up', 'golf', 'jetta', 'virtus', 'nivus', 't-cross', 'tcross', 'amarok', 'taos', 'tiguan', 'crossfox', 'spacefox', 'parati', 'kombi', 'delivery', 'constellation', 'passat', 'santana', 'quantum', 'bora'],
  Chevrolet: ['onix', 'prisma', 'celta', 'corsa', 'classic', 'agile', 'montana', 'spin', 'cobalt', 'cruze', 'tracker', 's10', 'trailblazer', 'astra', 'vectra', 'meriva', 'zafira', 'captiva', 'equinox', 'blazer', 'kadett', 'monza'],
  Fiat: ['uno', 'palio', 'siena', 'strada', 'mobi', 'argo', 'cronos', 'toro', 'idea', 'punto', 'doblo', 'fiorino', 'grand siena', 'weekend', 'linea', 'bravo', 'stilo', 'pulse', 'fastback', 'ducato', 'freemont', 'tempra', 'marea'],
  Ford: ['ka', 'fiesta', 'focus', 'ecosport', 'ranger', 'fusion', 'courier', 'territory', 'maverick', 'escort', 'edge', 'transit'],
  Renault: ['sandero', 'logan', 'kwid', 'duster', 'captur', 'clio', 'megane', 'symbol', 'oroch', 'fluence', 'master', 'scenic', 'kangoo'],
  Toyota: ['corolla', 'etios', 'yaris', 'hilux', 'sw4', 'rav4', 'camry', 'prius', 'bandeirante'],
  Honda: ['civic', 'fit', 'city', 'hr-v', 'hrv', 'wr-v', 'wrv', 'cr-v', 'crv', 'accord', 'biz', 'cg', 'fan', 'titan', 'pop', 'bros', 'xre', 'cb', 'nxr', 'pcx', 'lead', 'elite', 'twister', 'cbr', 'sahara', 'falcon'],
  Hyundai: ['sonata', 'veracruz', 'hb20', 'creta', 'tucson', 'ix35', 'santa fe', 'azera', 'elantra', 'i30', 'hr', 'veloster'],
  Nissan: ['march', 'versa', 'sentra', 'kicks', 'frontier', 'livina', 'tiida'],
  Iveco: ['daily', 'tector', 'stralis'],
  Jeep: ['renegade', 'compass', 'commander', 'wrangler', 'cherokee'],
  Peugeot: ['206', '207', '208', '2008', '3008', '307', '308', '408', 'partner', 'boxer', 'hoggar'],
  'Citroën': ['c3', 'c4', 'aircross', 'xsara', 'picasso', 'berlingo', 'jumper', 'cactus'],
  Mitsubishi: ['l200', 'pajero', 'asx', 'outlander', 'lancer', 'eclipse'],
  Yamaha: ['factor', 'fazer', 'ybr', 'lander', 'nmax', 'crosser', 'xtz', 'tenere', 'neo', 'mt-03', 'r3'],
  Kia: ['picanto', 'cerato', 'sportage', 'sorento', 'soul', 'bongo'],
  'Caoa Chery': ['tiggo', 'arrizo', 'qq', 'celer'],
  Suzuki: ['jimny', 'vitara', 'swift', 'intruder', 'yes', 'burgman'],
};
const MARCA_NOMES = Object.keys(MARCAS).concat(['GM', 'VW', 'Mercedes-Benz', 'Mercedes', 'BMW', 'Audi', 'Volvo', 'Iveco', 'Scania', 'Land Rover', 'Dafra', 'Shineray', 'Kawasaki', 'Harley-Davidson', 'Troller', 'BYD', 'GWM', 'JAC', 'Lifan', 'Chery']);
const ALIAS = { citroen: 'Citroën', mitsubishy: 'Mitsubishi', 'mercedes benz': 'Mercedes-Benz', gm: 'Chevrolet', vw: 'Volkswagen', mercedes: 'Mercedes-Benz', 'm.benz': 'Mercedes-Benz', mb: 'Mercedes-Benz', chery: 'Caoa Chery' };
function splitBrand(descr) {
  const d = txt(descr).replace(/\s+/g, ' ');
  const low = d.toLowerCase();
  for (const b of [...MARCA_NOMES, ...Object.keys(ALIAS)].sort((a, b) => b.length - a.length)) {
    const bl = b.toLowerCase();
    if (low === bl || low.startsWith(`${bl} `) || low.startsWith(`${bl}-`) || low.startsWith(`${bl}/`)) {
      return { marca: ALIAS[bl] ?? (b === b.toUpperCase() ? b : title(b)), modelo: title(d.slice(b.length).replace(/^[\s\-/]+/, '')) };
    }
  }
  const first = low.split(/[\s.]+/)[0];
  const two = low.split(/\s+/).slice(0, 2).join(' ');
  for (const [marca, modelos] of Object.entries(MARCAS)) if (modelos.includes(first) || modelos.includes(two)) return { marca, modelo: title(d) };
  return { marca: '', modelo: title(d) };
}

// ------------------------------------------------------------------ transformação
const report = { avisos: [], ignorados: {} };
const skip = (what, why) => { const k = `${what}: ${why}`; report.ignorados[k] = (report.ignorados[k] || 0) + 1; };

function build(adminId, existentes = new Map()) {
  const out = { seguradoras: [], clientes: [], veiculos: [], apolices: [], parcelas: [], comissoes: [], historico_contatos: [] };

  // Seguradoras (todas as usadas + cadastradas)
  const segNames = new Set([...T.seguradoras.map((s) => segName(s.codseg)), ...T.propostas.map((p) => segName(p.nomeseguradora))]);
  const segId = new Map();
  for (const nome of segNames) {
    const s = T.seguradoras.find((x) => segName(x.codseg) === nome);
    const ja = existentes.get(nome.toLowerCase());
    const id = ja ?? uid('seguradora', nome);
    segId.set(nome, id);
    if (!ja) out.seguradoras.push({ id, nome, cnpj: doc(s?.cnpj), ativo: true });
  }

  // Clientes
  const cliId = new Map();
  let docInvalido = 0;
  for (const c of T.clientes) {
    const pj = c.pessoa === 2;
    const docRaw = pj ? c.cnpj || c.cpf : c.cpf || c.cnpj;
    const d = digits(docRaw);
    if (d && !(d.length === 11 ? validCPF(d) : d.length === 14 ? validCNPJ(d) : false)) docInvalido++;
    const fones = T.fones.filter((f) => f.codcli === c.codcli).map((f) => ({ tipo: f.codtipotelefone, n: phone(f.telefone) })).filter((f) => f.n);
    const cel = fones.find((f) => f.tipo === 3) ?? fones.find((f) => digits(f.n).length === 11);
    const fixo = fones.find((f) => f !== cel);
    const email = T.internet.filter((i) => i.codcli === c.codcli && (i.codtipointernet === 1 || /@/.test(txt(i.internet)))).map((i) => txt(i.internet).toLowerCase()).find((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) ?? '';
    const end = T.enderecos.filter((e) => e.codcli === c.codcli).sort((a, b) => (b.padrao ?? 0) - (a.padrao ?? 0))[0];
    const obs = [`Importado do Mais Corret (cód. ${c.codcli}).`, c.produtor && prodName.get(c.produtor) ? `Produtor: ${prodName.get(c.produtor)}.` : '', txt(c.numerocnh) ? `CNH ${txt(c.numerocnh)}${iso(c.validadecnh) ? ` (validade ${iso(c.validadecnh)})` : ''}.` : '', txt(c.obs)].filter(Boolean).join(' ');
    const id = uid('cliente', c.codcli);
    cliId.set(c.codcli, id);
    out.clientes.push({
      id, tipo: pj ? 'PJ' : 'PF', nome: title(c.nome) || `Cliente ${c.codcli}`, documento: doc(docRaw),
      rg: c.tipodoc === 1 ? txt(c.numdoc) : '', data_nascimento: pj ? null : iso(c.nascimento), estado_civil: ESTADO_CIVIL[c.ecivil] ?? '',
      responsavel_nome: pj ? title(c.contato) : '', whatsapp: cel?.n ?? '', telefone: fixo?.n ?? '', email,
      cep: end ? (digits(end.cep).length === 8 ? `${digits(end.cep).slice(0, 5)}-${digits(end.cep).slice(5)}` : '') : '',
      endereco: end ? title(`${txt(end.tipologradouro)} ${txt(end.logradouro)}`) : '', numero: end ? txt(end.numero) : '', complemento: end ? title(end.complemento) : '',
      bairro: end ? title(end.bairro) : '', cidade: end ? title(end.cidade) : '', estado: end ? txt(end.estado).toUpperCase().slice(0, 2) : '',
      observacoes: obs, responsavel_id: adminId, created_at: iso(c.datacadastro) ? `${iso(c.datacadastro)}T12:00:00Z` : NOW,
    });
  }
  if (docInvalido) report.avisos.push(`${docInvalido} cliente(s) com CPF/CNPJ inválido — importados assim mesmo; revise na ficha.`);

  // Propostas: separa apólices (novo/renovação), endossos e cancelamentos
  const clienteDaProposta = (p) => cliId.get(pastaById.get(p.chavepasta)?.codcli);
  const principais = [], endossos = [], cancelamentos = [];
  for (const p of T.propostas) {
    if (!clienteDaProposta(p)) { skip('proposta', 'sem cliente vinculado'); continue; }
    if (p.tipoproposta === 2) endossos.push(p);
    else if (p.tipoproposta === 4) cancelamentos.push(p);
    else if (!iso(p.dtiniciovig) || !iso(p.dtfinalvig)) skip('apólice', 'sem datas de vigência');
    else principais.push(p);
  }

  // Veículos: um por cliente+placa (ou chassi/descrição), com os dados mais recentes
  const propostaById = new Map(T.propostas.map((p) => [p.chaveproposta, p]));
  const veicKey = new Map(); // chave → veículo
  const veicDaProposta = new Map(); // chaveproposta → [ids]
  const itens = T.itensauto
    .filter((i) => txt(i.placa) || txt(i.chassi) || txt(i.descr))
    .map((i) => ({ i, p: propostaById.get(i.chaveproposta) }))
    .filter((x) => x.p && clienteDaProposta(x.p))
    .sort((a, b) => (iso(a.p.dtiniciovig) ?? '').localeCompare(iso(b.p.dtiniciovig) ?? ''));
  for (const { i, p } of itens) {
    const cliente = clienteDaProposta(p);
    const placa = txt(i.placa).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    const key = `${cliente}|${placa || digits(i.chassi) || txt(i.chassi).toUpperCase() || `${txt(i.descr).toUpperCase()}|${i.anomod ?? ''}`}`;
    const id = uid('veiculo', key);
    veicKey.set(key, {
      id, cliente_id: cliente, placa, ...(() => { const b = splitBrand(i.descr); return { marca: b.marca, modelo: b.modelo || 'Veículo' }; })(), ano_fabricacao: i.anofab || null, ano_modelo: i.anomod || null, ano: i.anomod || null,
      chassi: txt(i.chassi).toUpperCase(), renavam: digits(i.renavam), combustivel: COMBUSTIVEL[i.combustivel] ?? '', uso: USO[i.uso] ?? (i.uso ? 'Outro' : ''),
      tipo: 'Automóvel', observacoes: 'Importado do Mais Corret.',
    });
    const list = veicDaProposta.get(p.chaveproposta) ?? [];
    if (!list.includes(id)) list.push(id);
    veicDaProposta.set(p.chaveproposta, list);
  }
  out.veiculos = [...veicKey.values()];
  const semPlaca = out.veiculos.filter((v) => !v.placa).length;
  if (semPlaca) report.avisos.push(`${semPlaca} veículo(s) sem placa no sistema antigo (identificados pelo chassi ou modelo) — complete a placa ao editar.`);

  // Apólices, encadeadas por pasta (renovação aponta para a anterior)
  const apoliceId = (p) => uid('apolice', p.chaveproposta);
  const porPasta = new Map();
  for (const p of principais) porPasta.set(p.chavepasta, [...(porPasta.get(p.chavepasta) ?? []), p]);
  const canceladas = new Set();
  for (const c of cancelamentos) {
    const data = iso(c.dtiniciovig) ?? iso(c.dtemissao);
    const alvo = (porPasta.get(c.chavepasta) ?? []).find((p) => data && iso(p.dtiniciovig) <= data && data <= iso(p.dtfinalvig));
    if (alvo) canceladas.add(alvo.chaveproposta); else skip('cancelamento', 'sem apólice correspondente');
  }
  let encerradasSemRegistro = 0;
  for (const [pasta, lista] of porPasta) {
    lista.sort((a, b) => iso(a.dtiniciovig).localeCompare(iso(b.dtiniciovig)) || a.chaveproposta - b.chaveproposta);
    lista.forEach((p, idx) => {
      const pastaRow = pastaById.get(pasta);
      // só é renovação se a apólice anterior não foi cancelada nem encerrada sem renovar
      const prev = idx > 0 ? lista[idx - 1] : null;
      const anterior = prev && !canceladas.has(prev.chaveproposta) && prev.status !== 4 ? prev : null;
      const fim = iso(p.dtfinalvig);
      let status = 'Vigente', renovacao_status = 'Pendente', renovacao_obs = '';
      if (canceladas.has(p.chaveproposta)) { status = 'Cancelada'; renovacao_status = 'Não renovada'; renovacao_obs = 'Cancelada no sistema anterior.'; }
      else if (p.status === 4) { status = 'Encerrada'; renovacao_status = 'Não renovada'; renovacao_obs = motivo.get(p.motivonaorenovar) ?? 'Não renovada (sistema anterior).'; }
      else if (p.status === 2 || idx < lista.length - 1) { status = 'Renovada'; renovacao_status = 'Renovada'; }
      else if (fim < addDays(TODAY, -60)) { status = 'Encerrada'; renovacao_status = 'Não renovada'; renovacao_obs = 'Vencida sem renovação registrada no sistema anterior.'; encerradasSemRegistro++; }
      const veics = veicDaProposta.get(p.chaveproposta) ?? [];
      const parc1 = T.parcelas.find((x) => x.chaveproposta === p.chaveproposta);
      const qtd = Number(p.qtdparcelasseguro) || null;
      const seguradora = segName(p.nomeseguradora);
      const numero = txt(p.napolice) || txt(p.nproposta) || `MC-${p.chaveproposta}`;
      out.apolices.push({
        id: apoliceId(p), cliente_id: clienteDaProposta(p), veiculo_id: veics[0] ?? null, ramo: RAMO[txt(pastaRow?.nomeramo).toUpperCase()] ?? (title(pastaRow?.nomeramo) || 'Outros'),
        seguradora, seguradora_id: segId.get(seguradora), numero, inicio: iso(p.dtiniciovig), vencimento: fim,
        premio: num(p.premiototal) ?? num(p.premioliquido) ?? 0, comissao_percentual: num(p.comissaotrab), forma_pagamento: PAGAMENTO[parc1?.formapag] ?? '',
        parcelas_qtd: qtd && qtd >= 1 && qtd <= 24 ? qtd : null, status, renovacao_status, renovacao_obs,
        apolice_anterior_id: anterior ? apoliceId(anterior) : null, responsavel_id: adminId,
        observacoes: [`Importado do Mais Corret (proposta ${p.chaveproposta}${txt(p.nproposta) ? `, nº proposta ${txt(p.nproposta)}` : ''}).`, p.tipoproposta === 3 ? 'Renovação.' : 'Seguro novo.', prodName.get(p.nomeprodutor) ? `Produtor: ${prodName.get(p.nomeprodutor)}.` : '', veics.length > 1 ? `${veics.length} itens (frota).` : '', txt(p.obs)].filter(Boolean).join(' '),
        created_at: iso(p.dtemissao) ? `${iso(p.dtemissao)}T12:00:00Z` : NOW,
        _geracao: idx,
      });
    });
  }
  if (encerradasSemRegistro) report.avisos.push(`${encerradasSemRegistro} apólice(s) venceram há mais de 60 dias sem renovação registrada no sistema antigo — importadas como "Encerrada".`);
  const vigentes = new Set(out.apolices.filter((a) => a.status === 'Vigente' && a.vencimento >= TODAY).map((a) => a.id));

  // Parcelas e comissões: só das apólices vigentes e só as que ainda vão vencer
  // (o sistema antigo não registrava pagamentos, então as vencidas apareceriam como "atrasadas").
  const byApolice = new Map(out.apolices.map((a) => [a.id, a]));
  const seenParc = new Set();
  for (const x of T.parcelas) {
    const aid = uid('apolice', x.chaveproposta);
    if (!vigentes.has(aid)) continue;
    const venc = iso(x.vencimento);
    if (!venc || venc < TODAY) { skip('parcela de apólice vigente', 'já vencida (pagamento não registrado no sistema antigo)'); continue; }
    const n = Number(x.nparcela) || 0;
    const k = `${aid}|${n}`;
    if (n < 1 || seenParc.has(k)) { skip('parcela', 'número repetido ou inválido'); continue; }
    seenParc.add(k);
    out.parcelas.push({ id: uid('parcela', x.chaveparcela), apolice_id: aid, numero: n, vencimento: venc, valor: num(x.valor) ?? 0, status: 'Pendente', observacoes: 'Importada do Mais Corret.' });
  }
  for (const x of T.comissoes) {
    const aid = uid('apolice', x.chaveproposta);
    if (!vigentes.has(aid)) continue;
    const data = iso(x.data);
    if (!data || data < TODAY) { skip('comissão de apólice vigente', 'data prevista já passou (recebimento não registrado no sistema antigo)'); continue; }
    if (x.status === 2) { skip('comissão', 'cancelada'); continue; }
    const a = byApolice.get(aid);
    out.comissoes.push({
      id: uid('comissao', x.chavecomissao), apolice_id: aid, parcela: Number(x.nparcela) || null, percentual: a?.comissao_percentual ?? null,
      valor: num(x.valor) ?? 0, data_prevista: data, status: x.status === 1 ? 'Recebida' : 'Prevista', data_recebida: x.status === 1 ? iso(x.dtrecebimento) : null,
      responsavel_id: adminId, observacoes: 'Importada do Mais Corret.',
    });
  }

  // Histórico: endossos e ações registradas
  const apoliceNaData = (pasta, data) => (porPasta.get(pasta) ?? []).find((p) => data && iso(p.dtiniciovig) <= data && data <= iso(p.dtfinalvig));
  for (const e of endossos) {
    const data = iso(e.dtemissao) ?? iso(e.dtiniciovig) ?? TODAY;
    const alvo = apoliceNaData(e.chavepasta, iso(e.dtiniciovig) ?? data);
    out.historico_contatos.push({
      id: uid('endosso', e.chaveproposta), cliente_id: clienteDaProposta(e), apolice_id: alvo ? apoliceId(alvo) : null, tipo: 'Outro', data,
      descricao: `Endosso${endossoTipo.get(Number(e.tipoendosso)) ? `: ${endossoTipo.get(Number(e.tipoendosso))}` : ''} — ${segName(e.nomeseguradora)}${txt(e.nendosso) ? ` nº ${txt(e.nendosso)}` : ''}${num(e.premiototal) ? `, prêmio ${num(e.premiototal).toFixed(2).replace('.', ',')}` : ''}. (Importado do Mais Corret.)`,
      usuario_id: adminId,
    });
  }
  for (const a of T.acoes) {
    const cliente = cliId.get(a.codcli);
    const texto = [txt(a.assunto), txt(a.msn)].filter(Boolean).join(' — ');
    if (!cliente || !texto) { skip('ação/agenda', 'sem cliente ou sem texto'); continue; }
    const p = a.cod_proposta ? propostaById.get(a.cod_proposta) : null;
    out.historico_contatos.push({
      id: uid('acao', a.cod_acao), cliente_id: cliente, apolice_id: p && (p.tipoproposta === 1 || p.tipoproposta === 3) && byApolice.has(apoliceId(p)) ? apoliceId(p) : null,
      tipo: 'Outro', data: iso(a.data_envio) ?? iso(a.data_agenda) ?? TODAY, descricao: `${texto} (Importado do Mais Corret.)`, usuario_id: adminId,
    });
  }
  return { out, vigentes: vigentes.size };
}

// ------------------------------------------------------------------ saída
function csv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]).filter((c) => !c.startsWith('_'));
  const esc = (v) => (v == null ? '' : /[",\n;]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
function printSummary(out, vigentes) {
  console.log('\nResumo da importação');
  console.log('────────────────────');
  const st = (s) => out.apolices.filter((a) => a.status === s).length;
  console.log(`Seguradoras ........... ${out.seguradoras.length}`);
  console.log(`Clientes .............. ${out.clientes.length}  (PF ${out.clientes.filter((c) => c.tipo === 'PF').length} · PJ ${out.clientes.filter((c) => c.tipo === 'PJ').length})`);
  console.log(`Veículos .............. ${out.veiculos.length}`);
  console.log(`Apólices .............. ${out.apolices.length}  (vigentes ${vigentes} · renovadas ${st('Renovada')} · encerradas ${st('Encerrada')} · canceladas ${st('Cancelada')})`);
  console.log(`Parcelas a vencer ..... ${out.parcelas.length}`);
  console.log(`Comissões previstas ... ${out.comissoes.length}`);
  console.log(`Histórico (endossos e anotações) ... ${out.historico_contatos.length}`);
  if (report.avisos.length) { console.log('\nAvisos:'); report.avisos.forEach((a) => console.log(`  • ${a}`)); }
  if (Object.keys(report.ignorados).length) { console.log('\nNão importados:'); Object.entries(report.ignorados).forEach(([k, n]) => console.log(`  • ${n} × ${k}`)); }
}

async function ask(q, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
  return new Promise((res) => rl.question(q, (a) => { rl.close(); if (hidden) console.log(); res(a); }));
}

if (SIMULAR) {
  const { out, vigentes } = build(null);
  printSummary(out, vigentes);
  const dir = path.resolve('previa');
  fs.mkdirSync(dir, { recursive: true });
  for (const [k, rows] of Object.entries(out)) fs.writeFileSync(path.join(dir, `${k}.csv`), '﻿' + csv(rows));
  console.log(`\nPrévia gravada em ${dir} (um CSV por tabela). Nada foi enviado ao banco.`);
  process.exit(0);
}

const { createClient } = await import('@supabase/supabase-js');
const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY) { console.error('Defina SUPABASE_URL e SUPABASE_KEY (os mesmos VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY do projeto).'); process.exit(1); }
const email = opt('email') || (await ask('E-mail do administrador: '));
const senha = process.env.SENHA || (await ask('Senha: ', true));
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const { data: login, error: loginErr } = await sb.auth.signInWithPassword({ email, password: senha });
if (loginErr) { console.error('Não foi possível entrar:', loginErr.message); process.exit(1); }
const userId = login.user.id;
const { data: prof } = await sb.from('profiles').select('empresa_id').eq('id', userId).single();
const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', userId);
if (!prof || !roles?.some((r) => r.role === 'admin')) { console.error('Este usuário não é administrador de uma corretora.'); process.exit(1); }
EMPRESA = prof.empresa_id;
const { data: emp } = await sb.from('empresas').select('nome').eq('id', EMPRESA).single();

const { data: segsExist } = await sb.from('seguradoras').select('id,nome');
const { out, vigentes } = build(userId, new Map((segsExist ?? []).map((x) => [x.nome.toLowerCase(), x.id])));
printSummary(out, vigentes);
const ok = flag('sim') || (await ask(`\nImportar para a corretora "${emp?.nome}"? (s/N) `)).trim().toLowerCase().startsWith('s');
if (!ok) { console.log('Cancelado.'); process.exit(0); }

async function send(tabela, rows) {
  // Todas as linhas com as mesmas colunas: no envio em lote, coluna ausente viraria NULL.
  const clean = rows.map((r) => Object.fromEntries(Object.entries({ ...r, empresa_id: EMPRESA }).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, v === undefined ? null : v])));
  const cols = new Set(clean.flatMap((r) => Object.keys(r)));
  if (clean.some((r) => Object.keys(r).length !== cols.size)) throw new Error(`Colunas inconsistentes em ${tabela}`);
  for (let i = 0; i < clean.length; i += 300) {
    const lote = clean.slice(i, i + 300);
    const { error } = await sb.from(tabela).upsert(lote, { onConflict: 'id', ignoreDuplicates: true });
    if (error) {
      // Um lote falhou: tenta um a um para mostrar exatamente qual registro tem problema
      for (const r of lote) {
        const { error: e2 } = await sb.from(tabela).upsert(r, { onConflict: 'id', ignoreDuplicates: true });
        if (e2) console.error(`  ✗ ${tabela} ${r.id}: ${e2.message}`);
      }
    }
    process.stdout.write(`\r  ${tabela}: ${Math.min(i + 300, clean.length)}/${clean.length}`);
  }
  if (clean.length) console.log();
}

console.log('\nEnviando…');
await send('seguradoras', out.seguradoras);
await send('clientes', out.clientes);
await send('veiculos', out.veiculos);
// Apólices em "gerações": cada renovação só entra depois da apólice anterior
const maxGen = Math.max(0, ...out.apolices.map((a) => a._geracao));
for (let g = 0; g <= maxGen; g++) {
  const lote = out.apolices.filter((a) => a._geracao === g);
  if (lote.length) await send('apolices', lote);
}
await send('parcelas', out.parcelas);
await send('comissoes', out.comissoes);
await send('historico_contatos', out.historico_contatos);
console.log('\nImportação concluída. Abra o Corretor360 e confira Clientes, Apólices e Renovações.');
process.exit(0);
