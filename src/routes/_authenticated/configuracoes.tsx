import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/configuracoes')({
 head: () => ({meta:[{title:'Configurações — Corretor360 Auto'},{name:'description',content:'Gerencie os dados da corretora.'},{property:'og:title',content:'Configurações — Corretor360 Auto'},{property:'og:description',content:'Gerencie os dados da corretora.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="configuracoes"/>,
});
