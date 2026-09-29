import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [{title:'Entrar — Corretor360 Auto'},{name:'description',content:'Acesse a gestão segura da sua corretora de seguros.'},{property:'og:title',content:'Entrar — Corretor360 Auto'},{property:'og:description',content:'Acesse a gestão segura da sua corretora de seguros.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}] }),
  component: AuthPage,
});
function AuthPage() {
  const navigate = useNavigate();
  const [mode,setMode] = useState<'login'|'register'|'recover'>('login');
  const [email,setEmail] = useState(''); const [password,setPassword] = useState(''); const [name,setName] = useState('');
  const [busy,setBusy] = useState(false); const [notice,setNotice] = useState('');
  useEffect(() => { supabase.auth.getUser().then(({data}) => { if(data.user) navigate({to:'/dashboard',replace:true}); }); }, [navigate]);
  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setNotice('');
    try {
      if (mode==='recover') { const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/auth'}); if(error) throw error; setNotice('Enviamos as instruções de recuperação para seu e-mail.'); }
      else if(mode==='register') { const {data,error}=await supabase.auth.signUp({email,password,options:{data:{nome:name}}}); if(error) throw error; if(data.session) navigate({to:'/dashboard'}); else setNotice('Confira seu e-mail para confirmar o cadastro antes de entrar.'); }
      else { const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error; navigate({to:'/dashboard'}); }
    } catch(err) { setNotice(err instanceof Error ? err.message : 'Não foi possível continuar.'); } finally { setBusy(false); }
  }
  async function google() { setBusy(true); const result=await lovable.auth.signInWithOAuth('google',{redirect_uri:window.location.origin}); if(result.error){setNotice(result.error.message);setBusy(false);} else if(!result.redirected) navigate({to:'/dashboard'}); }
  return <div className="min-h-screen grid lg:grid-cols-[1fr_1fr] bg-background">
    <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-14"><div className="flex items-center gap-3 font-display font-bold text-xl"><span className="grid place-items-center size-10 rounded-md bg-accent text-primary"><ShieldCheck size={22}/></span> corretor<span className="text-emerald">360</span> <span className="font-normal">auto</span></div><div className="max-w-lg"><p className="text-sm uppercase font-semibold mb-6 opacity-70">Sua operação, em ordem</p><h1 className="text-5xl font-bold leading-tight">Cada cliente importa.<br/>Cada renovação também.</h1><p className="mt-6 text-lg opacity-75">Uma visão clara da carteira, dos contatos e do que precisa da sua atenção.</p></div><p className="text-sm opacity-60">Corretor360 Auto · Gestão de seguros</p></div>
    <div className="flex items-center justify-center px-6 py-16"><div className="w-full max-w-sm"><div className="lg:hidden flex items-center gap-2 font-display font-bold text-xl mb-14"><ShieldCheck className="text-primary"/> corretor360 auto</div><div className="mb-9"><div className="size-12 rounded-md bg-secondary grid place-items-center text-primary mb-7"><LockKeyhole size={22}/></div><h2 className="text-3xl font-display font-bold">{mode==='register'?'Crie sua conta':mode==='recover'?'Recuperar acesso':'Bem-vindo de volta'}</h2><p className="text-muted-foreground mt-2">{mode==='register'?'Comece a organizar sua corretora.':mode==='recover'?'Enviaremos um link para seu e-mail.':'Entre para acompanhar sua carteira.'}</p></div>
    <form onSubmit={submit} className="space-y-4">{mode==='register'&&<label className="block text-sm font-semibold">Seu nome<input required value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full h-11 rounded-md border bg-card px-3" placeholder="Nome completo"/></label>}<label className="block text-sm font-semibold">E-mail<div className="relative mt-2"><Mail className="absolute left-3 top-3.5 text-muted-foreground" size={16}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full h-11 rounded-md border bg-card pl-10 pr-3" placeholder="voce@corretora.com.br"/></div></label>{mode!=='recover'&&<label className="block text-sm font-semibold">Senha<input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full h-11 rounded-md border bg-card px-3" placeholder="Sua senha"/></label>}{notice&&<p role="status" className="text-sm rounded-md bg-secondary p-3">{notice}</p>}<Button disabled={busy} size="lg" className="w-full mt-2">{busy?'Aguarde...':mode==='login'?'Entrar':mode==='register'?'Criar conta':'Enviar link'} <ArrowRight/></Button></form>
    {mode!=='recover'&&<><div className="flex items-center gap-3 my-6 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/> ou <span className="h-px flex-1 bg-border"/></div><Button variant="outline" size="lg" className="w-full" onClick={google} disabled={busy}>Continuar com Google</Button></>}
    <div className="flex justify-between gap-4 mt-7 text-sm"><button className="text-primary font-semibold" onClick={()=>{setNotice('');setMode(mode==='register'?'login':'register')}}>{mode==='register'?'Já tenho conta':'Criar conta'}</button><button className="text-muted-foreground" onClick={()=>{setNotice('');setMode(mode==='recover'?'login':'recover')}}>{mode==='recover'?'Voltar para entrar':'Esqueceu a senha?'}</button></div></div></div></div>;
}
