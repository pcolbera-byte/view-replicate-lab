import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/dashboard')({
 head: () => ({meta:[{title:'Visão geral — Corretor360 Auto'},{name:'description',content:'Acompanhe sua carteira e as prioridades do dia.'},{property:'og:title',content:'Visão geral — Corretor360 Auto'},{property:'og:description',content:'Acompanhe sua carteira e as prioridades do dia.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="dashboard"/>,
});
