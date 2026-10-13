import { businessSchema,expenseSchema,monthSchema,getBusiness,saveBusiness,addExpense,profitability } from './expenses';
import { Router } from 'express';
import * as store from './db';
import { extractRecipe } from './extract';
import { ocrImage } from './ocr';
import { explainDish, aiStatus } from './explain';
import { natUnit, simulateDish } from '../src/lib/calc';
import { validDate, queryDays } from '../src/lib/dates';
import { auth, requireAccount, sameOrigin } from './auth';
import {
  ah, handle, settingsSchema, ingredientCreateSchema, ingredientPatchSchema,
  dishSchema, simulateSchema, extractSchema, extractImageSchema, saleSchema, salesImportSchema, resetSchema,
} from './validate';

export const api = Router();


api.use('/auth', auth);
api.use(sameOrigin, requireAccount);
api.get('/business', (_req,res)=>res.json(getBusiness()));
api.put('/business',handle(businessSchema),(req,res)=>res.json(saveBusiness(req.body)));
api.get('/expenses', (req,res)=>{const month=monthSchema.safeParse(req.query.month);if(!month.success)return res.status(400).json({error:'Select a valid month (YYYY-MM)'});res.json(profitability(month.data));});
api.post('/expenses',handle(expenseSchema),(req,res)=>res.status(201).json(addExpense(req.body)));
api.put('/expenses/:id',handle(expenseSchema),(req,res)=>{
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid expense id'});
 getBusiness();const e=req.body;const result=store.db.prepare('UPDATE operating_expenses SET date=?,category=?,kind=?,amount=?,note=? WHERE id=?').run(e.date,e.category,e.kind,e.amount,e.note,id);
 if(!result.changes)return res.status(404).json({error:'Expense not found'});res.json({...e,id});
});

api.get('/health', (_req, res) => res.json({ ok: true, service: 'marginmind-api', time: new Date().toISOString() }));

api.get('/bootstrap', ah(async (_req: any, res: any) => {
  res.json({ settings: store.getSettings(), ings: store.getIngredients(), dishes: store.getDishes() });
}));

/* ---------- settings ---------- */
api.get('/settings', ah(async (_req: any, res: any) => res.json(store.getSettings())));
api.patch('/settings', handle(settingsSchema), ah(async (req: any, res: any) => {
  const settings = store.saveSettings(req.body);
  // classification thresholds changed → return fresh analysis so the client updates immediately
  const a = store.menuAnalysis();
  res.json({ settings, analysis: { rows: a.rows, popT: a.popT, marT: a.marT, avgCm: a.avgCm, avgUnits: a.avgUnits, totals: a.totals } });
}));

/* ---------- ingredients ---------- */
api.get('/ingredients', ah(async (_req: any, res: any) => res.json(store.getIngredients())));

api.post('/ingredients', handle(ingredientCreateSchema), ah(async (req: any, res: any) => {
  const id = req.body.id || req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (store.db.prepare('SELECT 1 FROM ingredients WHERE id = ?').get(id)) return res.status(409).json({ error: `Ingredient "${id}" already exists` });
  res.status(201).json(store.insertIngredient({ ...req.body, id }));
}));

api.patch('/ingredients/:id', handle(ingredientPatchSchema), ah(async (req: any, res: any) => {
  const before = store.db.prepare('SELECT * FROM ingredients WHERE id = ?').get(req.params.id) as any;
  if (!before) return res.status(404).json({ error: `Ingredient "${req.params.id}" not found` });
  if (req.body.unit) {
    const usedBy = store.getDishes().filter((d) => d.recipe.some((r: any) => r.ing === req.params.id && r.unit !== natUnit({ ...before, unit: req.body.unit })));
    if (usedBy.length && req.body.unit !== before.unit) {
      return res.status(409).json({ error: `Cannot change unit — recipes use "${natUnit(before)}" quantities in: ${usedBy.map((d) => d.name).join(', ')}` });
    }
  }
  const updated = store.updateIngredient(req.params.id, req.body) as any;

  // automatic recalculation: every dish using this ingredient is costed fresh from the DB
  const analysis = store.menuAnalysis();
  const affected = analysis.rows
    .filter((d) => d.recipe.some((r: any) => r.ing === req.params.id))
    .map((row) => ({
      dishId: row.id, name: row.name, newCost: row.cost, newFoodCostPct: row.fcPct,
      newContributionPerUnit: row.cm, negativeMargin: row.cm < 0,
    }));
  const negative = affected.filter((a) => a.negativeMargin);
  res.json({
    ingredient: updated, priceChanged: updated.price !== before.price,
    affectedDishes: affected, affectedCount: affected.length,
    negativeMarginAlerts: negative,
    warning: negative.length ? `${negative.length} dish${negative.length > 1 ? 'es' : ''} now LOSE money per plate: ${negative.map((n) => n.name).join(', ')}` : null,
  });
}));

api.delete('/ingredients/:id', ah(async (req: any, res: any) => {
  const used = store.getDishes().filter((d) => d.recipe.some((r: any) => r.ing === req.params.id)).length;
  if (used) return res.status(409).json({ error: `Cannot delete — used by ${used} dish${used === 1 ? '' : 'es'}` });
  const changes = store.deleteIngredient(req.params.id);
  if (!changes) return res.status(404).json({ error: 'Ingredient not found' });
  res.json({ ok: true });
}));

/* ---------- dishes ---------- */
api.get('/dishes', ah(async (_req: any, res: any) => res.json(store.getDishes())));

api.get('/dishes/:id', ah(async (req: any, res: any) => {
  const d = store.getDish(req.params.id);
  if (!d) return res.status(404).json({ error: `Dish "${req.params.id}" not found` });
  res.json(d);
}));

/** server-side unit consistency check: recipe unit must match ingredient pricing unit (kg→g, L→ml, pc→pc) */
function validateRecipeUnits(body: any): string[] {
  const ings = new Map(store.getIngredients().map((i) => [i.id, i]));
  const problems: string[] = [];
  if(!body.recipe.length)problems.push('Add at least one costed ingredient before saving a dish');
  if(!(body.price>0))problems.push('Enter a positive selling price');
  for (const r of body.recipe) {
    if(!(r.qty>0))problems.push('Recipe quantities must be greater than zero');
    if (!r.ing) {if(!(r.fixedCost>0))problems.push('Enter an actual cost for custom items');continue;}
    const ing = ings.get(r.ing);
    if (!ing) { problems.push(`recipe references unknown ingredient "${r.ing}"`); continue; }
    if(!(ing.price>0))problems.push(`Enter a purchase price for ${ing.name}`);
    const want = natUnit(ing);
    if (r.unit !== want) problems.push(`"${r.ing}" is priced per ${ing.unit} — recipe qty must be in ${want} (got "${r.unit}")`);
  }
  return problems;
}

api.post('/dishes', handle(dishSchema), ah(async (req: any, res: any) => {
  if (store.getDish(req.body.id)) return res.status(409).json({ error: `Dish "${req.body.id}" already exists` });
  const problems = validateRecipeUnits(req.body);
  if (problems.length) return res.status(400).json({ error: 'Invalid recipe units', details: problems.map((p) => ({ field: 'recipe', message: p })) });
  res.status(201).json(store.upsertDish(req.body));
}));

api.put('/dishes/:id', handle(dishSchema), ah(async (req: any, res: any) => {
  if (req.params.id !== req.body.id) return res.status(400).json({ error: 'URL id and body id must match' });
  if (!store.getDish(req.params.id)) return res.status(404).json({ error: `Dish "${req.params.id}" not found` });
  const problems = validateRecipeUnits(req.body);
  if (problems.length) return res.status(400).json({ error: 'Invalid recipe units', details: problems.map((p) => ({ field: 'recipe', message: p })) });
  res.json(store.upsertDish(req.body));
}));

api.delete('/dishes/:id', ah(async (req: any, res: any) => {
  const changes = store.deleteDish(req.params.id);
  if (!changes) return res.status(404).json({ error: `Dish "${req.params.id}" not found` });
  res.json({ ok: true });
}));

/* ---------- sales: persisted actual data driving popularity & totals ---------- */
api.get('/dishes/:id/sales', ah(async (req: any, res: any) => {
  const days = queryDays(req.query.days);
  const d = store.getDish(req.params.id);
  if (!d) return res.status(404).json({ error: 'Dish not found' });
  res.json({ dishId: d.id, days, points: store.getSales(d.id, days), demoRowsRemaining: store.demoRowsFor(d.id) });
}));

api.post('/sales', handle(saleSchema), ah(async (req: any, res: any) => {
  const { dishId, date, units } = req.body;
  if (!store.getDish(dishId)) return res.status(404).json({ error: `Dish "${dishId}" not found` });
  const today = store.helpers.todayIso();
  if (date > today) return res.status(400).json({ error: 'Sales date cannot be in the future' });
  const r = store.recordSale(dishId, date, units, 'manual');
  res.status(201).json({ ok: true, ...r, note: r.replacedDemoBaseline ? 'Generated demo sales for this dish were replaced by your real data.' : undefined });
}));

api.delete('/sales/:dishId/:date', ah(async (req: any, res: any) => {
  if (!validDate(req.params.date)) return res.status(400).json({ error: 'Invalid date' });
  const changes = store.deleteSale(req.params.dishId, req.params.date);
  if (!changes) return res.status(404).json({ error: 'No sale recorded for that dish/date' });
  res.json({ ok: true, ...store.recomputeDishUnits(req.params.dishId) });
}));

function csvCells(line: string): string[] {
  const cells: string[] = []; let cell='', quoted=false;
  for (let i=0; i<line.length; i++) {
    const ch=line[i];
    if(ch==='"') { if(quoted && line[i+1]==='"'){cell+='"'; i++;} else quoted=!quoted; }
    else if(ch===',' && !quoted){cells.push(cell.trim());cell='';} else cell+=ch;
  }
  if(quoted) throw new Error('Unclosed quoted CSV field');
  cells.push(cell.trim()); return cells;
}
function parseCsv(csv: string): {rows:any[]; errors:any[]} {
  const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());
  const rows:any[]=[], errors:any[]=[], seen=new Set<string>();
  if(!lines.length)return {rows,errors:[{row:1,message:'Empty file'}]};
  let header:string[];
  try{header=csvCells(lines[0]).map(h=>h.toLowerCase());}catch(e:any){return {rows,errors:[{row:1,message:e.message}]};}
  for(const n of ['dish','date','units'])if(!header.includes(n))errors.push({row:1,message:`Missing column "${n}"`});
  if(errors.length)return {rows,errors};
  const dishes=store.getDishes();
  for(let i=1;i<lines.length;i++) {
    try{
      const cells=csvCells(lines[i]), dishRef=(cells[header.indexOf('dish')]||'').toLowerCase(), date=cells[header.indexOf('date')]||'', raw=cells[header.indexOf('units')]||'';
      const dish=dishes.find(d=>d.id===dishRef||d.name.toLowerCase()===dishRef);
      if(!dish)throw new Error(`Unknown dish "${dishRef}"`);
      if(!validDate(date))throw new Error(`Invalid calendar date "${date}"`);
      if(date>store.helpers.todayIso())throw new Error('Sales date cannot be in the future');
      const units=Number(raw);
      if(!raw||!Number.isFinite(units)||units<0||units>1000000)throw new Error('Units must be supplied and between 0 and 1000000');
      const key=dish.id+'|'+date;
      if(seen.has(key))throw new Error('Duplicate dish/date in file — first row retained, this row skipped');
      seen.add(key); rows.push({row:i+1,dishId:dish.id,dishName:dish.name,date,units});
    }catch(e:any){errors.push({row:i+1,message:e.message});}
  }
  return {rows,errors};
}

api.post('/sales/import', handle(salesImportSchema), ah(async (req: any, res: any) => {
  const { csv, commit } = req.body;
  const { rows, errors } = parseCsv(csv);
  const perDish = new Map<string, number>();
  rows.forEach((r) => perDish.set(r.dishName, (perDish.get(r.dishName) || 0) + r.units));
  const demoReplaced = commit ? [] : [...new Set(rows.map((r) => r.dishId))].filter((id) => store.demoRowsFor(id) > 0).map((id) => store.getDish(id)!.name);
  if (!commit) {
    return res.json({
      dryRun: true, validRows: rows.length, errorRows: errors.length, errors,
      perDish: [...perDish.entries()].map(([dish, units]) => ({ dish, units })),
      demoBaselineWillBeReplaced: demoReplaced,
      note: 'Nothing written yet — review and commit to import.',
    });
  }
  const tx = store.db.transaction(() => { for (const r of rows) store.recordSale(r.dishId, r.date, r.units, 'csv'); });
  tx();
  const analysis = store.menuAnalysis();
  res.json({
    committed: true, imported: rows.length, skipped: errors.length, errors,
    totals: analysis.totals, note: 'Popularity, totals and charts now use the imported sales.',
  });
}));

api.get('/sales/summary', ah(async (req: any, res: any) => {
  const days = queryDays(req.query.days);
  res.json(store.salesSummary(days));
}));

/* ---------- server-side analysis ---------- */
api.get('/analysis/menu', ah(async (req: any, res: any) => {
  const a = store.menuAnalysis(queryDays(req.query.days));
  res.json({ rows: a.rows, popT: a.popT, marT: a.marT, avgCm: a.avgCm, avgUnits: a.avgUnits, totals: a.totals });
}));

api.get('/analysis/dish/:id', ah(async (req: any, res: any) => {
  const a = store.menuAnalysis();
  const row = a.rows.find((r) => r.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'Dish not found' });
  res.json({ dish: row, popT: a.popT, marT: a.marT });
}));

/* ---------- AI: status, grounded insight, extraction ---------- */
api.get('/ai/status', (_req, res) => res.json(aiStatus()));

api.post('/simulate', handle(simulateSchema), ah(async (req: any, res: any) => {
  const a = store.menuAnalysis(req.body.days);
  const d = a.rows.find((r) => r.id === req.body.dishId);
  if (!d) return res.status(404).json({ error: `Dish "${req.body.dishId}" not found` });
  res.json({dishId:d.id, ...simulateDish(d, req.body)});
}));

api.get('/ai/dish-insight/:id', ah(async (req: any, res: any) => {
  const a = store.menuAnalysis();
  const d = a.rows.find((r) => r.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Dish not found' });
  const ctx = { rows: a.rows, ingMap: a.ingMap, ings: store.getIngredients(), settings: store.getSettings(), popT: a.popT, marT: a.marT, avgCm: a.avgCm, avgUnits: a.avgUnits, totals: a.totals };
  res.json(await explainDish(d, ctx));
}));

api.post('/extract-recipe', handle(extractSchema), ah(async (req: any, res: any) => {
  const result = await extractRecipe(req.body.text, store.getIngredients());
  if (!result.items.length) return res.status(422).json({ error: 'No ingredients could be extracted', warnings: result.warnings });
  res.json(result);
}));

api.post('/extract-image', handle(extractImageSchema), ah(async (req: any, res: any) => {
  let ocr: { text: string; confidence: number };
  try {
    ocr = await ocrImage(req.body.imageBase64);
  } catch (e: any) {
    return res.status(503).json({ error: `OCR unavailable: ${e.message}`, engine: 'ocr-unavailable' });
  }
  if (!ocr.text || ocr.text.length < 8) {
    return res.status(422).json({ error: 'No readable text found in the image — try a clearer photo.', engine: 'tesseract-ocr', rawText: ocr.text });
  }
  const parsed = await extractRecipe(ocr.text.replace(/\n+/g, ', '), store.getIngredients());
  res.json({
    engine: 'tesseract-ocr', ocrConfidence: Math.round(ocr.confidence), rawText: ocr.text,
    items: parsed.items.map((i) => ({ ...i, needsConfirmation: true, note: i.note || 'from OCR — verify quantity' })),
    warnings: [...parsed.warnings, 'All OCR-extracted items require confirmation before saving.'],
  });
}));

/* ---------- reset: demo seed OR genuinely empty restaurant ---------- */
api.post('/reset', handle(resetSchema), ah(async (req: any, res: any) => {
  if(req.body.mode !== 'empty')return res.status(400).json({error:'Sample data is not available in restaurant workspaces.'});
  store.seedIfEmpty(true, req.body.mode === 'empty');
  res.json({ ok: true, mode: req.body.mode });
}));
