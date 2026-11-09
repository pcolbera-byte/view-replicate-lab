// "Consulta offline": um único arquivo .html com todos os dados da corretora e uma tela de
// consulta embutida. Abre em qualquer navegador, sem internet e sem o Corretix no ar, e também
// serve para restaurar (o Corretix aceita este arquivo na restauração).
import type { Workspace } from "@/lib/data/workspace";
import { baixar, montarBackup, nomeArquivo, type Backup } from "./backup";

const ID_DADOS = "corretix-backup";

/** Dados embutidos com segurança dentro de <script type="application/json">. */
function jsonSeguro(b: Backup) {
  return JSON.stringify(b)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function gerarConsultaOffline(b: Backup): string {
  const titulo = `Consulta offline · ${b.empresa_nome}`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(titulo)}</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <div class="marca"><span class="logo">C</span><div><strong>${escHtml(b.empresa_nome)}</strong><small>Consulta offline do Corretix</small></div></div>
  <div class="info" id="info"></div>
</header>
<main>
  <div class="aviso">Cópia gerada em <b id="gerado"></b>. Somente consulta: alterações são feitas no Corretix. Guarde este arquivo em local seguro, porque ele contém os dados dos seus clientes.</div>
  <nav id="abas"></nav>
  <div class="busca"><input id="q" type="search" placeholder="Buscar por nome, CPF/CNPJ, telefone, placa, apólice…" autocomplete="off"><button id="restaurar" type="button" title="Baixa o arquivo .json para restaurar no Corretix">Arquivo para restaurar</button></div>
  <div id="conta" class="conta"></div>
  <div id="lista" class="lista"></div>
</main>
<div id="ficha" class="ficha" hidden><div class="ficha-caixa"><button class="fechar" id="fechar" type="button" aria-label="Fechar">×</button><div id="ficha-conteudo"></div></div></div>
<script type="application/json" id="${ID_DADOS}">${jsonSeguro(b)}</script>
<script>${JS}</script>
</body>
</html>`;
}

/** Lê o backup embutido num arquivo de consulta offline (ou null se não for um). */
export function extrairBackupDoHtml(html: string): unknown {
  const m = html.match(
    new RegExp(`<script type="application/json" id="${ID_DADOS}">([\\s\\S]*?)</script>`),
  );
  if (!m?.[1]) return null;
  return JSON.parse(m[1]);
}

export function baixarConsultaOffline(ws: Workspace) {
  const b = montarBackup(ws);
  baixar(
    new Blob([gerarConsultaOffline(b)], { type: "text/html;charset=utf-8" }),
    nomeArquivo(ws, "html"),
  );
  return b;
}

const CSS = `
:root{--bg:#f3f6fa;--card:#fff;--tx:#14213d;--mut:#5b6b82;--pri:#0f6cbd;--pri2:#0b3a66;--bd:#dfe6ef;--warn:#fff7e6;--warnb:#f0c36d;--ok:#e7f6ec;--okt:#1c7a3e;--bad:#fdecec;--badt:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#0e1622;--card:#152132;--tx:#e6edf6;--mut:#9fb0c6;--pri:#5aa9ec;--pri2:#0b2540;--bd:#26364b;--warn:#2d2614;--warnb:#7a6122;--ok:#14301f;--okt:#7fd59c;--bad:#3a1818;--badt:#f19a9a}}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--tx)}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:14px 20px;background:var(--pri2);color:#fff}
.marca{display:flex;gap:10px;align-items:center}.marca small{display:block;opacity:.75;font-size:12px}
.logo{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:var(--pri);font-weight:800;font-size:18px}
.info{font-size:12px;opacity:.85}
main{max-width:1200px;margin:0 auto;padding:16px}
.aviso{background:var(--warn);border:1px solid var(--warnb);border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:14px}
nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
nav button{border:1px solid var(--bd);background:var(--card);color:var(--tx);border-radius:999px;padding:7px 14px;font:inherit;cursor:pointer}
nav button.ativa{background:var(--pri);border-color:var(--pri);color:#fff;font-weight:600}
nav button span{opacity:.7;margin-left:4px;font-size:12px}
.busca{display:flex;gap:8px;margin-bottom:8px}
.busca input{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--bd);border-radius:10px;background:var(--card);color:var(--tx);font:inherit}
.busca button,.ficha button.acao{border:1px solid var(--bd);background:var(--card);color:var(--tx);border-radius:10px;padding:0 12px;font:inherit;cursor:pointer;white-space:nowrap}
.conta{font-size:12px;color:var(--mut);margin:6px 2px 10px}
.lista{background:var(--card);border:1px solid var(--bd);border-radius:12px;overflow:hidden}
.item{display:grid;grid-template-columns:1fr auto;gap:4px 16px;padding:11px 16px;border-top:1px solid var(--bd);cursor:pointer}
.item:first-child{border-top:0}.item:hover{background:rgba(15,108,189,.06)}
.item .t{font-weight:600}.item .s{color:var(--mut);font-size:12.5px}.item .d{text-align:right;font-size:12.5px;color:var(--mut)}
.vazio{padding:28px;text-align:center;color:var(--mut)}
.tag{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11.5px;font-weight:600;background:var(--bd)}
.tag.ok{background:var(--ok);color:var(--okt)}.tag.bad{background:var(--bad);color:var(--badt)}.tag.warn{background:var(--warn);color:inherit}
.ficha{position:fixed;inset:0;background:rgba(5,12,24,.55);display:flex;justify-content:center;align-items:flex-start;padding:24px 12px;overflow:auto;z-index:10}
.ficha[hidden]{display:none}
.ficha-caixa{position:relative;background:var(--card);border-radius:14px;max-width:880px;width:100%;padding:20px 22px}
.fechar{position:absolute;right:10px;top:8px;border:0;background:none;font-size:26px;color:var(--mut);cursor:pointer}
.ficha h2{margin:0 0 2px;font-size:20px}.ficha h3{margin:20px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--pri)}
dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px 18px;margin:10px 0 0}
dt{font-size:11.5px;color:var(--mut)}dd{margin:0;word-break:break-word}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-top:1px solid var(--bd);vertical-align:top}th{color:var(--mut);font-weight:600;font-size:12px;border-top:0}
td.n{text-align:right;white-space:nowrap}
.tabela{overflow-x:auto}
a{color:var(--pri)}
@media (max-width:640px){.item{grid-template-columns:1fr}.item .d{text-align:left}header{padding:12px 16px}main{padding:12px}}
@media print{header,nav,.busca,.aviso{display:none}.ficha{position:static;background:none;padding:0}}
`;

// Tela de consulta (JavaScript simples, sem bibliotecas, para abrir em qualquer navegador).
const JS = `
(function(){
var B=JSON.parse(document.getElementById('${ID_DADOS}').textContent);
var T=B.tabelas||{};
function L(n){return T[n]||[]}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return '&#'+c.charCodeAt(0)+';'})}
function sem(v){return String(v==null?'':v).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()}
function dig(v){return String(v==null?'':v).replace(/\\D/g,'')}
function data(v){if(!v)return '';var s=String(v).slice(0,10).split('-');return s.length===3?s[2]+'/'+s[1]+'/'+s[0]:String(v)}
function moeda(v){if(v==null||v==='')return '';var n=Number(v);return isNaN(n)?esc(v):n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function hoje(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function dias(v){if(!v)return null;return Math.round((new Date(String(v).slice(0,10)+'T12:00:00')-new Date(hoje()+'T12:00:00'))/864e5)}
var porId={};['clientes','veiculos','apolices','seguradoras','produtores'].forEach(function(t){var m={};L(t).forEach(function(r){m[r.id]=r});porId[t]=m});
function cli(id){return porId.clientes[id]||{}}
function seg(a){return (a.seguradora_id&&porId.seguradoras[a.seguradora_id]&&porId.seguradoras[a.seguradora_id].nome)||a.seguradora||''}
function veic(id){var v=porId.veiculos[id];return v?[v.marca,v.modelo,v.placa].filter(Boolean).join(' · '):''}
function porCampo(t,campo){var m={};L(t).forEach(function(r){var k=r[campo];if(!k)return;(m[k]=m[k]||[]).push(r)});return m}
var vPorCli=porCampo('veiculos','cliente_id'),aPorCli=porCampo('apolices','cliente_id'),pPorAp=porCampo('parcelas','apolice_id'),sPorCli=porCampo('sinistros','cliente_id'),hPorCli=porCampo('historico_contatos','cliente_id'),renovada={};
L('apolices').forEach(function(a){if(a.apolice_anterior_id)renovada[a.apolice_anterior_id]=true});
function vigente(a){return a.status!=='Cancelada'&&a.status!=='Encerrada'}
function statusTag(a){var d=dias(a.vencimento);if(!vigente(a))return '<span class="tag">'+esc(a.status||'')+'</span>';if(d!=null&&d<0)return '<span class="tag bad">Vencida</span>';if(d!=null&&d<=30)return '<span class="tag warn">Vence em '+d+' dia(s)</span>';return '<span class="tag ok">Vigente</span>'}
function tel(c){return [c.telefone,c.whatsapp].filter(Boolean).filter(function(v,i,a){return a.indexOf(v)===i}).join(' / ')}
function textoCli(c){return sem([c.nome,c.nome_fantasia,c.email,c.cidade].join(' '))+' '+[c.documento,c.telefone,c.whatsapp].map(dig).join(' ')+' '+(vPorCli[c.id]||[]).map(function(v){return sem(v.placa)}).join(' ')+' '+(aPorCli[c.id]||[]).map(function(a){return sem(a.numero)}).join(' ')}
var ABAS=[
 {k:'clientes',n:'Clientes',itens:function(){return L('clientes').slice().sort(function(a,b){return sem(a.nome)<sem(b.nome)?-1:1})},
  txt:textoCli,
  html:function(c){var ap=(aPorCli[c.id]||[]).filter(vigente).length;return '<div><div class="t">'+esc(c.nome)+'</div><div class="s">'+esc([c.documento,tel(c),c.email].filter(Boolean).join(' · '))+'</div></div><div class="d">'+((vPorCli[c.id]||[]).length?esc((vPorCli[c.id]||[]).map(function(v){return v.placa}).filter(Boolean).join(', '))+'<br>':'')+ap+' apólice(s) vigente(s)</div>'},
  abrir:function(c){ficha(c.id)}},
 {k:'apolices',n:'Apólices',itens:function(){return L('apolices').slice().sort(function(a,b){return String(b.vencimento||'')<String(a.vencimento||'')?-1:1})},
  txt:function(a){return sem([a.numero,seg(a),a.ramo,cli(a.cliente_id).nome].join(' '))+' '+sem(veic(a.veiculo_id))+' '+dig(cli(a.cliente_id).documento)},
  html:function(a){return '<div><div class="t">'+esc(cli(a.cliente_id).nome||'—')+'</div><div class="s">'+esc([seg(a),a.ramo,a.numero&&('nº '+a.numero),veic(a.veiculo_id)].filter(Boolean).join(' · '))+'</div></div><div class="d">'+statusTag(a)+'<br>'+data(a.inicio)+' a '+data(a.vencimento)+'</div>'},
  abrir:function(a){ficha(a.cliente_id)}},
 {k:'renovacoes',n:'Renovações (90 dias)',itens:function(){return L('apolices').filter(function(a){var d=dias(a.vencimento);return vigente(a)&&!renovada[a.id]&&a.renovacao_status!=='Renovada'&&a.renovacao_status!=='Não renovada'&&d!=null&&d>=-30&&d<=90}).sort(function(a,b){return String(a.vencimento)<String(b.vencimento)?-1:1})},
  txt:function(a){return sem([a.numero,seg(a),a.ramo,cli(a.cliente_id).nome].join(' '))+' '+sem(veic(a.veiculo_id))},
  html:function(a){var c=cli(a.cliente_id);return '<div><div class="t">'+esc(c.nome||'—')+'</div><div class="s">'+esc([tel(c),seg(a),a.ramo,veic(a.veiculo_id)].filter(Boolean).join(' · '))+'</div></div><div class="d">'+statusTag(a)+'<br>vence '+data(a.vencimento)+'</div>'},
  abrir:function(a){ficha(a.cliente_id)}},
 {k:'veiculos',n:'Veículos',itens:function(){return L('veiculos')},
  txt:function(v){return sem([v.placa,v.marca,v.modelo,v.chassi,cli(v.cliente_id).nome].join(' '))},
  html:function(v){return '<div><div class="t">'+esc([v.marca,v.modelo].filter(Boolean).join(' ')||'Veículo')+' · '+esc(v.placa||'sem placa')+'</div><div class="s">'+esc(cli(v.cliente_id).nome||'')+'</div></div><div class="d">'+esc([v.ano_fabricacao,v.ano_modelo].filter(Boolean).join('/')||v.ano||'')+'</div>'},
  abrir:function(v){ficha(v.cliente_id)}}
];
var aba=ABAS[0],LIM=300;
function abas(){document.getElementById('abas').innerHTML=ABAS.map(function(a,i){return '<button type="button" data-i="'+i+'" class="'+(a===aba?'ativa':'')+'">'+esc(a.n)+'<span>'+a.itens().length+'</span></button>'}).join('')}
function lista(){var q=sem(document.getElementById('q').value.trim()),qd=dig(q);var termos=q.split(/\\s+/).filter(Boolean);
 var it=aba.itens();if(termos.length){it=it.filter(function(r){var t=aba.txt(r);return termos.every(function(w){return t.indexOf(w)>=0||(dig(w).length>=3&&t.indexOf(dig(w))>=0)})})}
 void qd;
 document.getElementById('conta').textContent=it.length+' registro(s)'+(it.length>LIM?' · mostrando os '+LIM+' primeiros, refine a busca':'');
 document.getElementById('lista').innerHTML=it.length?it.slice(0,LIM).map(function(r,i){return '<div class="item" data-i="'+i+'">'+aba.html(r)+'</div>'}).join(''):'<div class="vazio">Nada encontrado.</div>';
 lista.atual=it}
function campos(par){return '<dl>'+par.filter(function(p){return p[1]!=null&&p[1]!==''}).map(function(p){return '<div><dt>'+esc(p[0])+'</dt><dd>'+p[1]+'</dd></div>'}).join('')+'</dl>'}
function ficha(id){var c=cli(id);if(!c.id)return;
 var end=[c.endereco,c.numero,c.complemento,c.bairro,c.cidade,c.estado,c.cep].filter(Boolean).join(', ');
 var h='<h2>'+esc(c.nome)+'</h2><div class="s" style="color:var(--mut)">'+esc(c.tipo||'')+(c.nome_fantasia?' · '+esc(c.nome_fantasia):'')+'</div>';
 h+=campos([['CPF/CNPJ',esc(c.documento)],['RG',esc(c.rg)],['Telefone',esc(c.telefone)],['WhatsApp',esc(c.whatsapp)],['E-mail',c.email?'<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>':''],['Nascimento',data(c.data_nascimento)],['Estado civil',esc(c.estado_civil)],['Endereço',esc(end)],['Responsável',esc(c.responsavel_nome)],['Observações',esc(c.observacoes)]]);
 var vs=vPorCli[id]||[];if(vs.length){h+='<h3>Veículos</h3><div class="tabela"><table><tr><th>Veículo</th><th>Placa</th><th>Ano</th><th>Chassi</th><th>Uso</th></tr>'+vs.map(function(v){return '<tr><td>'+esc([v.marca,v.modelo].filter(Boolean).join(' '))+'</td><td>'+esc(v.placa)+'</td><td>'+esc([v.ano_fabricacao,v.ano_modelo].filter(Boolean).join('/')||v.ano||'')+'</td><td>'+esc(v.chassi)+'</td><td>'+esc(v.uso)+'</td></tr>'}).join('')+'</table></div>'}
 var as=(aPorCli[id]||[]).slice().sort(function(a,b){return String(b.vencimento||'')<String(a.vencimento||'')?-1:1});
 if(as.length){h+='<h3>Apólices</h3><div class="tabela"><table><tr><th>Seguradora / ramo</th><th>Nº</th><th>Vigência</th><th>Veículo</th><th class="n">Prêmio</th><th>Situação</th></tr>'+as.map(function(a){var ps=(pPorAp[a.id]||[]).slice().sort(function(x,y){return (x.numero||0)-(y.numero||0)});var pag=ps.filter(function(p){return p.status==='Paga'}).length;return '<tr><td>'+esc(seg(a))+'<br><span style="color:var(--mut)">'+esc(a.ramo||'')+'</span></td><td>'+esc(a.numero)+'</td><td>'+data(a.inicio)+' a '+data(a.vencimento)+'</td><td>'+esc(veic(a.veiculo_id))+'</td><td class="n">'+moeda(a.premio)+(ps.length?'<br><span style="color:var(--mut)">'+pag+'/'+ps.length+' parcela(s) paga(s)</span>':'')+'</td><td>'+statusTag(a)+'</td></tr>'}).join('')+'</table></div>'}
 var ss=sPorCli[id]||[];if(ss.length){h+='<h3>Sinistros</h3><div class="tabela"><table><tr><th>Data</th><th>Tipo</th><th>Protocolo</th><th>Situação</th></tr>'+ss.map(function(s){return '<tr><td>'+data(s.data)+'</td><td>'+esc(s.tipo)+'</td><td>'+esc(s.protocolo)+'</td><td>'+esc(s.status)+'</td></tr>'}).join('')+'</table></div>'}
 var hs=(hPorCli[id]||[]).slice().sort(function(a,b){return String(b.created_at||'')<String(a.created_at||'')?-1:1}).slice(0,20);if(hs.length){h+='<h3>Últimos contatos</h3><div class="tabela"><table>'+hs.map(function(x){return '<tr><td style="white-space:nowrap">'+data(x.data||x.created_at)+'</td><td>'+esc(x.canal||x.tipo||'')+'</td><td>'+esc(x.descricao||x.resumo||x.texto||'')+'</td></tr>'}).join('')+'</table></div>'}
 h+='<p style="margin-top:18px"><button class="acao" type="button" onclick="window.print()" style="padding:8px 12px">Imprimir ficha</button></p>';
 document.getElementById('ficha-conteudo').innerHTML=h;document.getElementById('ficha').hidden=false}
document.getElementById('gerado').textContent=new Date(B.gerado_em).toLocaleString('pt-BR');
document.getElementById('info').textContent=L('clientes').length+' clientes · '+L('apolices').length+' apólices · '+L('veiculos').length+' veículos';
document.getElementById('abas').onclick=function(e){var b=e.target.closest('button');if(!b)return;aba=ABAS[+b.dataset.i];abas();lista()};
document.getElementById('q').oninput=lista;
document.getElementById('lista').onclick=function(e){var d=e.target.closest('.item');if(d)aba.abrir(lista.atual[+d.dataset.i])};
document.getElementById('fechar').onclick=function(){document.getElementById('ficha').hidden=true};
document.getElementById('ficha').onclick=function(e){if(e.target.id==='ficha')this.hidden=true};
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.getElementById('ficha').hidden=true});
document.getElementById('restaurar').onclick=function(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(B)],{type:'application/json'}));a.download=document.title.replace(/[^\\w]+/g,'-').toLowerCase()+'.json';document.body.appendChild(a);a.click();a.remove()};
abas();lista();
})();
`;
