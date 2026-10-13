import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
(globalThis as any).localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
(globalThis as any).window={localStorage:(globalThis as any).localStorage,matchMedia:()=>({matches:false}),innerWidth:1280};
const {AppProvider}=await import('../src/store/AppContext');
let failed=0;
for(const [route,page] of [['/','Dashboard'],['/menu','MenuIntelligence'],['/costing','RecipeCosting'],['/sales','SalesAnalytics'],['/ingredients','Ingredients'],['/ai','Recommendations'],['/simulator','Simulator'],['/reports','Reports'],['/settings','Settings'],['/expenses','Expenses'],['/action-plan','ActionPlan'],['/dish/chicken-burger','DishDetail']]){
 try{const {default:Page}=await import('../src/pages/'+page);const html=renderToString(<MemoryRouter initialEntries={[route]}><AppProvider><Routes><Route path={page==='DishDetail'?'/dish/:id':'*'} element={<Page/>}/></Routes></AppProvider></MemoryRouter>);console.log(JSON.stringify({route,pass:html.length>0,bytes:html.length}));}
 catch(e:any){failed++;console.log(JSON.stringify({route,pass:false,error:e.message}));}
}
process.exitCode=failed?1:0;
