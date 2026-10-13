import React,{useEffect,useState} from 'react';
import {ChefHat} from 'lucide-react';
import {useAuth,authRequest} from '../store/AuthContext';
type Mode='signup'|'login'|'forgot';
export default function Welcome(){
 const {setUser}=useAuth();const [mode,setMode]=useState<Mode>('signup');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [challenge,setChallenge]=useState<any>(null),[remaining,setRemaining]=useState(0),[code,setCode]=useState('');
 const [form,setForm]=useState({owner:'',phone:'',password:''});
 useEffect(()=>{if(!challenge)return;const update=()=>setRemaining(Math.max(0,Math.ceil((challenge.resendAt-Date.now())/1000)));update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[challenge]);
 const input='w-full mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-amber-500 outline-none';
 function switchMode(next:Mode){setMode(next);setChallenge(null);setCode('');setError('');setMessage('');setForm(f=>({...f,password:''}));}
 async function send(){const r=await authRequest(mode==='signup'?'signup':'forgot-password',mode==='signup'?form:{phone:form.phone});setChallenge({...r,resendAt:Date.now()+r.resendAfter*1000});setCode('');}
 async function resend(){setBusy(true);setError('');try{await send();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{
  if(mode==='login'){const r=await authRequest('login',{phone:form.phone,password:form.password});setUser(r.user);}
  else if(!challenge)await send();
  else if(mode==='signup'){const r=await authRequest('signup/verify',{challengeId:challenge.challengeId,code});setUser(r.user);}
  else{await authRequest('forgot-password/verify',{challengeId:challenge.challengeId,code,password:form.password});switchMode('login');setMessage('Password reset completed. Sign in with your new password.');}
 }catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <div className="min-h-screen grid lg:grid-cols-2 bg-[#fffdf8]">
 <section className="hidden lg:flex flex-col justify-center p-16 bg-slate-900 text-white"><div className="flex items-center gap-3 text-2xl font-bold"><ChefHat className="text-amber-400"/>MarginMind</div><h1 className="text-5xl font-bold mt-12 leading-tight">Great food.<br/>A healthier<br/><span className="text-amber-400">bottom line.</span></h1><p className="text-slate-300 mt-8 max-w-md">Build your menu from your own recipes, ingredient prices and sales. Make decisions with a clear view of your costs.</p><p className="text-slate-400 mt-8">Your restaurant. Your private workspace.</p></section>
 <section className="flex items-center justify-center px-6 py-12"><div className="w-full max-w-md"><p className="font-bold text-amber-600 mb-6">MarginMind</p><h2 className="text-3xl font-bold">{challenge?'Verify your phone':mode==='signup'?'Create your account':mode==='login'?'Welcome back':'Reset your password'}</h2><p className="mt-3 text-sm text-slate-500">{challenge?`Enter the 6-digit code for ${form.phone}. It expires after 5 minutes.`:mode==='forgot'?'Enter your registered Indian mobile number.':mode==='signup'?'Verify your phone, then add your restaurant details inside your workspace.':'Sign in with your phone number and password.'}</p>
 <form onSubmit={submit} className="mt-7 space-y-5">
 {!challenge&&<>
 {mode==='signup'&&<label className="block text-sm font-semibold">Your name<input className={input} required minLength={2} maxLength={100} autoComplete="name" value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}/></label>}
 <label className="block text-sm font-semibold">Indian mobile number (+91)<input className={input} type="tel" required autoComplete="tel" placeholder="10-digit mobile number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
 </>}
 {challenge&&<><label className="block text-sm font-semibold">Verification code<input className={input} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>{challenge.demoOtp&&<p className="bg-amber-50 text-amber-800 rounded-xl p-3 text-sm">Demo OTP: {challenge.demoOtp} <span className="block text-xs mt-1">Mock SMS only; no message was sent to your phone.</span></p>}<button type="button" disabled={busy||remaining>0} onClick={resend} className="text-sm text-amber-700 disabled:text-slate-400">{remaining>0?`Resend in ${remaining}s`:'Resend OTP'}</button></>}
 {((!challenge&&mode!=='forgot')||(challenge&&mode==='forgot'))&&<label className="block text-sm font-semibold">{mode==='forgot'?'New password':'Password'}<input className={input} type="password" required minLength={10} maxLength={72} autoComplete={mode==='login'?'current-password':'new-password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><span className="text-xs text-slate-400">10–72 characters; maximum 72 UTF-8 bytes.</span></label>}
 {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{message&&<p role="status" className="text-sm text-emerald-700">{message}</p>}
 <button disabled={busy} className="w-full rounded-xl bg-amber-600 text-white font-semibold py-3 disabled:opacity-50">{busy?'Please wait…':mode==='login'?'Sign in':challenge?mode==='signup'?'Verify and create account':'Verify and reset password':'Send OTP'}</button>
 </form><div className="mt-6 flex flex-wrap gap-4 text-sm text-amber-700">{mode!=='login'&&<button onClick={()=>switchMode('login')}>Sign in</button>}{mode!=='signup'&&<button onClick={()=>switchMode('signup')}>Create account</button>}{mode==='login'&&<button onClick={()=>switchMode('forgot')}>Forgot password?</button>}{challenge&&<button onClick={()=>{setChallenge(null);setCode('');setError('');}}>Change phone number</button>}</div>
 </div></section></div>;
}
