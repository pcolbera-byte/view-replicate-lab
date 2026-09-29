import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/comissoes')({
 head: () => ({meta:[{title:'Comissões — Corretor360 Auto'},{name:'description',content:'Visualize comissões estimadas da carteira.'},{property:'og:title',content:'Comissões — Corretor360 Auto'},{property:'og:description',content:'Visualize comissões estimadas da carteira.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="comissoes"/>,
});
