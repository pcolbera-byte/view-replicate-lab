import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/renovacoes')({
 head: () => ({meta:[{title:'Renovações — Corretor360 Auto'},{name:'description',content:'Acompanhe os vencimentos das apólices.'},{property:'og:title',content:'Renovações — Corretor360 Auto'},{property:'og:description',content:'Acompanhe os vencimentos das apólices.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="renovacoes"/>,
});
