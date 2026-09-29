import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/clientes')({
 head: () => ({meta:[{title:'Clientes — Corretor360 Auto'},{name:'description',content:'Consulte e gerencie os clientes da corretora.'},{property:'og:title',content:'Clientes — Corretor360 Auto'},{property:'og:description',content:'Consulte e gerencie os clientes da corretora.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="clientes"/>,
});
