import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/leads')({
 head: () => ({meta:[{title:'Leads — Corretor360 Auto'},{name:'description',content:'Acompanhe as oportunidades da corretora.'},{property:'og:title',content:'Leads — Corretor360 Auto'},{property:'og:description',content:'Acompanhe as oportunidades da corretora.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="leads"/>,
});
