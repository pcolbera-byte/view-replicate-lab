import { createFileRoute } from '@tanstack/react-router';
import { OfficePage } from '@/components/office-app';
export const Route = createFileRoute('/_authenticated/agenda')({
 head: () => ({meta:[{title:'Agenda — Corretor360 Auto'},{name:'description',content:'Organize as tarefas e os contatos.'},{property:'og:title',content:'Agenda — Corretor360 Auto'},{property:'og:description',content:'Organize as tarefas e os contatos.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
 component: () => <OfficePage section="agenda"/>,
});
