import { Dish, Ingredient, SalePoint, Settings } from '../types';

/** Thin typed client for the MarginMind backend API (proxied by Vite under /api). */

async function j<T = any>(r: Response): Promise<T> {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if(r.status===401 && !r.url.includes('/auth/'))window.dispatchEvent(new Event('mm-session-expired'));
    const err: any = new Error(data.error || `Request failed (${r.status})`);
    err.details = data.details;
    err.status = r.status;
    throw err;
  }
  return data as T;
}

const req = (path: string, init?: RequestInit) => fetch(path, {...init, signal: init?.signal || AbortSignal.timeout(path.includes("extract") ? 120000 : 15000)});
const jsonReq = (method: string, path: string, body?: any) =>
  req(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

export interface Bootstrap { settings: Settings; ings: Ingredient[]; dishes: Dish[]; }
export interface ExtractedItem {
  name: string; qty: number; unit: 'g' | 'ml' | 'pc';
  ingredientId?: string | null; estimatedCost?: number | null;
  confidence: 'high' | 'medium' | 'low'; needsConfirmation: boolean; note?: string;
}
export interface AiStatus { llmConfigured: boolean; llmModel: string | null; engine: 'llm' | 'rules'; ocrAvailable: boolean; }

export const api = {
  updateExpense: (id:number,body:any) => jsonReq('PUT','/api/expenses/'+id,body).then(j),
  business: () => req('/api/business').then(j),
  saveBusiness: (body:any) => jsonReq('PUT','/api/business',body).then(j),
  expenses: (month:string) => req('/api/expenses?month='+encodeURIComponent(month)).then(j),
  addExpense: (body:any) => jsonReq('POST','/api/expenses',body).then(j),
  health: () => req('/api/health').then(j),
  bootstrap: () => req('/api/bootstrap').then(j<Bootstrap>),
  analysisMenu: (days=30) => req(`/api/analysis/menu?days=${days}`).then(j),
  saveSettings: (patch: Partial<Settings>) => jsonReq('PATCH', '/api/settings', patch).then(j<{ settings: Settings; analysis: any }>),
  aiStatus: () => req('/api/ai/status').then(j<AiStatus>),
  dishInsight: (id: string) => req(`/api/ai/dish-insight/${id}`).then(j<{ engine: string; why: string; action: string; confidence: string; note?: string }>),
  saveDish: (dish: Dish, isNew: boolean) =>
    (isNew ? jsonReq('POST', '/api/dishes', dish) : jsonReq('PUT', `/api/dishes/${dish.id}`, dish)).then(j<Dish>),
  deleteDish: (id: string) => jsonReq('DELETE', `/api/dishes/${id}`).then(j),
  addIngredient: (i: Partial<Ingredient>) => jsonReq('POST', '/api/ingredients', i).then(j<Ingredient>),
  updateIngredient: (id: string, patch: { price?: number; name?: string; cat?: string }) =>
    jsonReq('PATCH', `/api/ingredients/${id}`, patch).then(j),
  simulate: (body: { dishId: string; days?: number; pricePct?: number; priceAbs?: number | null; inflPct?: number; portionPct?: number; volumePct?: number }) =>
    jsonReq('POST', '/api/simulate', body).then(j),
  extractRecipe: (text: string) => jsonReq('POST', '/api/extract-recipe', { text }).then(j<{ engine: string; items: ExtractedItem[]; warnings: string[] }>),
  extractImage: (imageBase64: string) =>
    jsonReq('POST', '/api/extract-image', { imageBase64 }).then(j<{ engine: string; ocrConfidence: number; rawText: string; items: ExtractedItem[]; warnings: string[] }>),
  addSale: (body: { dishId: string; date: string; units: number }) =>
    jsonReq('POST', '/api/sales', body).then(j<{ ok: boolean; replacedDemoBaseline: boolean; units: number; prevUnits: number; note?: string }>),
  deleteSale: (dishId: string, date: string) => jsonReq('DELETE', `/api/sales/${dishId}/${date}`).then(j),
  dishSales: (dishId: string, days: number) =>
    req(`/api/dishes/${dishId}/sales?days=${days}`).then(j<{ points: SalePoint[]; demoRowsRemaining: number }>),
  salesSummary: (days: number) => req(`/api/sales/summary?days=${days}`).then(j),
  importSales: (csv: string, commit: boolean) => jsonReq('POST', '/api/sales/import', { csv, commit }).then(j),
  reset: (mode: 'demo' | 'empty' = 'demo') => jsonReq('POST', '/api/reset', { mode }).then(j),
};
