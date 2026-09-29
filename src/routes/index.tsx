import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/')({
  beforeLoad: () => { throw redirect({to:'/dashboard'}); },
  head: () => ({meta:[{title:'Corretor360 Auto — Gestão da corretora'},{name:'description',content:'Organize clientes, veículos, apólices e renovações em um só lugar.'},{property:'og:title',content:'Corretor360 Auto — Gestão da corretora'},{property:'og:description',content:'Organize clientes, veículos, apólices e renovações em um só lugar.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
});
