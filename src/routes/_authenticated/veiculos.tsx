import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/veiculos')({
 head: () => ({meta:[{title:'Veículos — Corretor360 Auto'},{name:'description',content:'Consulte os veículos da carteira.'},{property:'og:title',content:'Veículos — Corretor360 Auto'},{property:'og:description',content:'Consulte os veículos da carteira.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="veiculos"/>,
});
