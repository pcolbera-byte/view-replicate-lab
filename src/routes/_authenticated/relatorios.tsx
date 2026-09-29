import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/relatorios')({
 head: () => ({meta:[{title:'Relatórios — Corretor360 Auto'},{name:'description',content:'Consulte os indicadores da corretora.'},{property:'og:title',content:'Relatórios — Corretor360 Auto'},{property:'og:description',content:'Consulte os indicadores da corretora.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="relatorios"/>,
});
