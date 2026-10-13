import React, {createContext, useContext, useEffect, useMemo, useState, useCallback, useRef} from 'react';
import {Dish, Ingredient, Settings} from '../types';
import {seedData} from '../data/seed';
import {analyze} from '../lib/calc';
import {recommendations, profitLeaks, optimizePlan, alertsFor} from '../lib/ai';
import {money, moneyShort} from '../lib/format';
import {api, AiStatus} from '../lib/api';
interface Toast {id:number;msg:string;type:'success'|'info'|'error';}
interface AppState {
  dishes:Dish[];ings:Ingredient[];settings:Settings;demoMode:boolean;connected:boolean;booting:boolean;
  stale:boolean;dataSource:'backend'|'local';aiStatus:AiStatus|null;range:7|30|90;setRange:(n:7|30|90)=>void;
  analyzed:ReturnType<typeof analyze>;recs:ReturnType<typeof recommendations>;leaks:ReturnType<typeof profitLeaks>;
  plan:ReturnType<typeof optimizePlan>;alerts:ReturnType<typeof alertsFor>;toasts:Toast[];
  toast:(s:string,t?:Toast['type'])=>void;money:(n:number)=>string;moneyShort:(n:number)=>string;
  updateIngredient:(id:string,price:number)=>void;addIngredient:(i:Partial<Ingredient>)=>Promise<Ingredient|null>;
  upsertDish:(d:Dish)=>Promise<Dish|null>;deleteDish:(id:string)=>void;updateSettings:(p:Partial<Settings>)=>void;
  setDemoMode:(v:boolean)=>void;resetDemo:(mode?:'demo'|'empty')=>void;refreshBackend:()=>Promise<void>;
}
const AppCtx=createContext<AppState>(null as any);
export const useApp=()=>useContext(AppCtx);
const seed:{dishes:Dish[];ings:Ingredient[];settings:Settings}={dishes:[],ings:[],settings:{restaurant:'',location:'',currency:'₹',taxPct:0,foodCostTarget:30,popThreshold:null,marginThreshold:null}};
export function AppProvider({children}:{children:React.ReactNode}) {
  const [dishes,setDishes]=useState<Dish[]>(seed.dishes), [ings,setIngs]=useState<Ingredient[]>(seed.ings);
  const [settings,setSettings]=useState<Settings>(seed.settings);
  const [range,setRange]=useState<7|30|90>(30), [demoMode,setDemoMode]=useState(true);
  const [connected,setConnected]=useState(false), [booting,setBooting]=useState(true), [stale,setStale]=useState(false);
  const [serverAnalysis,setServerAnalysis]=useState<any>(null), [aiStatus,setAiStatus]=useState<AiStatus|null>(null);
  const [toasts,setToasts]=useState<Toast[]>([]);
  const connectedRef=useRef(false), everConnected=useRef(false), rangeRef=useRef(range), refreshId=useRef(0);
  rangeRef.current=range; connectedRef.current=connected;
  const toast=useCallback((msg:string,type:Toast['type']='success')=>{
    const id=Date.now()+Math.random();setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),4600);
  },[]);
  const failed=useCallback((e:any)=>{
    toast(e.message||'Request failed — changes were not saved.', 'error');
    if(!e.status||e.status>=500){setStale(true);setConnected(false);connectedRef.current=false;}
  },[toast]);
  const refreshBackend=useCallback(async()=>{
    const id=++refreshId.current;
    try {
      const [b,a,status]=await Promise.all([api.bootstrap(),api.analysisMenu(rangeRef.current),api.aiStatus()]);
      if(id!==refreshId.current)return;
      setDishes(b.dishes);setIngs(b.ings);setSettings(b.settings);setServerAnalysis(a);setAiStatus(status);
      everConnected.current=true;connectedRef.current=true;setConnected(true);setStale(false);
    }catch(e:any){if(id===refreshId.current){setConnected(false);connectedRef.current=false;setStale(everConnected.current);}throw e;}
  },[]);
  useEffect(()=>{
    let alive=true;
    refreshBackend().catch(()=>{}).finally(()=>{if(alive)setBooting(false);});
    const timer=setInterval(()=>{
      if(!connectedRef.current)refreshBackend().catch(()=>{});
      else api.health().catch(()=>{setConnected(false);connectedRef.current=false;setStale(true);});
    },10000);
    return()=>{alive=false;clearInterval(timer);refreshId.current++;};
  },[refreshBackend]);
  useEffect(()=>{if(everConnected.current){setStale(true);refreshBackend().catch(failed);}},[range,refreshBackend,failed]);
  const localAnalyzed=useMemo(()=>analyze(demoMode?dishes:[],ings,settings),[dishes,ings,settings,demoMode]);
  const ingMap=useMemo(()=>new Map(ings.map(i=>[i.id,i])),[ings]);
  const analyzed=useMemo(()=>demoMode&&serverAnalysis?{...serverAnalysis,ingMap}:localAnalyzed,[demoMode,serverAnalysis,ingMap,localAnalyzed]);
  const ctx=useMemo(()=>({rows:analyzed.rows,ingMap,ings,settings,popT:analyzed.popT,marT:analyzed.marT,avgCm:analyzed.avgCm,avgUnits:analyzed.avgUnits,totals:analyzed.totals}),[analyzed,ingMap,ings,settings]);
  const recs=useMemo(()=>recommendations(ctx),[ctx]),leaks=useMemo(()=>profitLeaks(ctx),[ctx]),plan=useMemo(()=>optimizePlan(ctx),[ctx]),alerts=useMemo(()=>alertsFor(ctx),[ctx]);
  function canEditLocal(){toast('Connection unavailable. Reconnect before saving your restaurant data.','error');return false;}
  async function afterWrite(message:string){
    try{await refreshBackend();toast(message);}catch{setStale(true);toast('Saved to the database, but refreshing failed. Reconnect to verify the latest data.','error');}
  }
  const upsertDish=useCallback(async(d:Dish):Promise<Dish|null>=>{
    try{
      if(connectedRef.current){const saved=await api.saveDish(d,!dishes.some(x=>x.id===d.id));await afterWrite(`Recipe saved — ${saved.name}.`);return saved;}
      if(!canEditLocal())return null;
      setDishes(p=>p.some(x=>x.id===d.id)?p.map(x=>x.id===d.id?d:x):[...p,d]);toast('Saved in local demo memory only — not persisted.','info');return d;
    }catch(e){failed(e);return null;}
  },[dishes,failed,refreshBackend,toast]);
  const updateIngredient=useCallback((id:string,price:number)=>{void(async()=>{
    try{if(connectedRef.current){const r=await api.updateIngredient(id,{price});await afterWrite('Ingredient price saved; affected dishes recalculated.');if(r.warning)toast(r.warning,'error');}
    else if(canEditLocal()){setIngs(p=>p.map(i=>i.id===id?{...i,prev:i.price,price}:i));toast('Changed locally only — not persisted.','info');}}
    catch(e){failed(e);}
  })();},[failed,refreshBackend,toast]);
  const addIngredient=useCallback(async(i:Partial<Ingredient>)=>{
    try{if(connectedRef.current){const r=await api.addIngredient(i);await afterWrite(`Ingredient saved — ${r.name}.`);return r;}
      if(!canEditLocal())return null;
      const r:Ingredient={id:i.id||'ingredient-'+Date.now(),name:i.name!,unit:i.unit||'kg',price:i.price??0,prev:i.price??0,cat:i.cat||'Pantry'};
      setIngs(p=>[...p,r]);toast('Ingredient added locally only — not persisted.','info');return r;
    }catch(e){failed(e);return null;}
  },[failed,refreshBackend,toast]);
  const deleteDish=useCallback((id:string)=>{void(async()=>{
    try{if(connectedRef.current){await api.deleteDish(id);await afterWrite('Dish removed from database.');}
      else if(canEditLocal()){setDishes(p=>p.filter(d=>d.id!==id));toast('Dish removed locally only.','info');}}
    catch(e){failed(e);}
  })();},[failed,refreshBackend,toast]);
  const pending=useRef<Partial<Settings>>({}),settingsTimer=useRef<ReturnType<typeof setTimeout>|null>(null),settingsRevision=useRef(0);
  const updateSettings=useCallback((patch:Partial<Settings>)=>{
    if(!connectedRef.current&&!canEditLocal())return;
    setSettings(p=>({...p,...patch}));
    if(!connectedRef.current){toast('Settings changed locally only — not persisted.','info');return;}
    pending.current={...pending.current,...patch};const revision=++settingsRevision.current;
    if(settingsTimer.current)clearTimeout(settingsTimer.current);
    settingsTimer.current=setTimeout(async()=>{
      const body=pending.current;pending.current={};
      try{await api.saveSettings(body);if(revision===settingsRevision.current)await refreshBackend();}
      catch(e){failed(e);setStale(true);void refreshBackend().catch(()=>{});}
    },600);
  },[failed,refreshBackend,toast]);
  useEffect(()=>()=>{if(settingsTimer.current)clearTimeout(settingsTimer.current);},[]);
  const resetDemo=useCallback((mode:'demo'|'empty'='empty')=>{void(async()=>{
    try{if(connectedRef.current){await api.reset(mode);setDemoMode(true);await afterWrite(mode==='empty'?'Empty restaurant ready.':'Demo database restored.');}
      else if(canEditLocal()){const s=seedData();setDishes(mode==='demo'?s.dishes:[]);setIngs(mode==='demo'?s.ings:[]);if(mode==='demo')setSettings(s.settings);setDemoMode(true);toast('Reset local demo memory only.','info');}}
    catch(e){failed(e);}
  })();},[failed,refreshBackend,toast]);
  const value:AppState={dishes:demoMode?dishes:[],ings,settings,demoMode,connected,booting,stale,dataSource:'backend',aiStatus,range,setRange,analyzed,recs,leaks,plan,alerts,toasts,toast,money:n=>money(n,settings.currency),moneyShort:n=>moneyShort(n,settings.currency),updateIngredient,addIngredient,upsertDish,deleteDish,updateSettings,setDemoMode,resetDemo,refreshBackend};
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
