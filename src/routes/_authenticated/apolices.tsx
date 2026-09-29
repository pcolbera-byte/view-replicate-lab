import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/apolices')({
 head: () => ({meta:[{title:'Apólices — Corretor360 Auto'},{name:'description',content:'Gerencie as apólices da sua carteira.'},{property:'og:title',content:'Apólices — Corretor360 Auto'},{property:'og:description',content:'Gerencie as apólices da sua carteira.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="apolices"/>,
});
