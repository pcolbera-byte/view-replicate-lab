import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/sinistros')({
 head: () => ({meta:[{title:'Sinistros — Corretor360 Auto'},{name:'description',content:'Acompanhe as ocorrências dos clientes.'},{property:'og:title',content:'Sinistros — Corretor360 Auto'},{property:'og:description',content:'Acompanhe as ocorrências dos clientes.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="sinistros"/>,
});
