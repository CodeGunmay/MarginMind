import hospitalityDefaults from './hospitality-defaults.json';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { ENV } from './env';
import { seedData } from '../src/data/seed';
import { analyze, trendFor } from '../src/lib/calc';
import { businessDate, daysAgo } from '../src/lib/dates';
import { tenantScope } from './tenant';

const file = path.resolve(process.cwd(), ENV.DATABASE_FILE);
fs.mkdirSync(path.dirname(file), { recursive: true });

const legacyDb = new Database(file);
// All request queries resolve to that account's database, including after asynchronous AI calls.
export const db = new Proxy(legacyDb, { get(_target, key) {
  const connection = tenantScope.getStore() || legacyDb;
  const value = (connection as any)[key];
  return typeof value === 'function' ? value.bind(connection) : value;
}});

const tenantConnections = new Map<string, Database.Database>();
export function restaurantDb(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid restaurant identity');
  const existing=tenantConnections.get(id); if(existing)return existing;
  const directory=path.join(path.dirname(file),'restaurants');fs.mkdirSync(directory,{recursive:true});
  const connection=new Database(path.join(directory,id+'.db'));
  connection.pragma('journal_mode = WAL');connection.pragma('foreign_keys = ON');
  const schemas=legacyDb.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT IN ('users','sessions','otps','auth_migrations','otp_phone_created') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,rowid").all() as {sql:string}[];
  for(const {sql} of schemas)connection.exec(sql.replace(/^CREATE TABLE /,'CREATE TABLE IF NOT EXISTS ').replace(/^CREATE INDEX /,'CREATE INDEX IF NOT EXISTS '));
  tenantConnections.set(id,connection);
  tenantScope.run(connection,()=>seedIfEmpty(false,true));
  return connection;
}
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  restaurant TEXT NOT NULL,
  location TEXT NOT NULL,
  currency TEXT NOT NULL,
  taxPct REAL NOT NULL,
  foodCostTarget REAL NOT NULL,
  popThreshold REAL,
  marginThreshold REAL
);
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('kg','L','pc')),
  price REAL NOT NULL CHECK (price >= 0),
  prev REAL NOT NULL DEFAULT 0,
  cat TEXT NOT NULL DEFAULT 'Pantry'
);
CREATE TABLE IF NOT EXISTS dishes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cat TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  servings REAL NOT NULL DEFAULT 1,
  wastage REAL NOT NULL DEFAULT 0,
  gasCost REAL NOT NULL DEFAULT 0,
  garnishCost REAL NOT NULL DEFAULT 0,
  packagingCost REAL NOT NULL DEFAULT 0,
  units REAL NOT NULL DEFAULT 0,
  prevUnits REAL NOT NULL DEFAULT 0,
  descr TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS recipe_items (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  dishId TEXT NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  ingredientId TEXT REFERENCES ingredients(id) ON DELETE SET NULL,
  qty REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'g',
  name TEXT,
  fixedCost REAL
);
CREATE TABLE IF NOT EXISTS sales_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dishId TEXT NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  units REAL NOT NULL,
  revenue REAL NOT NULL,
  contribution REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',   -- 'demo' = generated seeded data, 'manual'/'csv' = real entries
  UNIQUE (dishId, date)
);
CREATE INDEX IF NOT EXISTS idx_recipe_dish ON recipe_items(dishId);
CREATE INDEX IF NOT EXISTS idx_sales_dish ON sales_daily(dishId, date);
`);

/* lightweight migrations for databases created by earlier versions */
function ensureColumn(table: string, col: string, ddl: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!cols.some((c) => c.name === col)) { db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`); return true; }
  return false;
}
ensureColumn('dishes', 'gasCost', 'gasCost REAL NOT NULL DEFAULT 0');
ensureColumn('dishes', 'garnishCost', 'garnishCost REAL NOT NULL DEFAULT 0');
ensureColumn('dishes', 'packagingCost', 'packagingCost REAL NOT NULL DEFAULT 0');
// earlier versions only ever stored the generated baseline → mark legacy rows as demo (never as real)
ensureColumn('sales_daily', 'source', "source TEXT NOT NULL DEFAULT 'demo'");
db.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
if (!(db.prepare(`SELECT v FROM meta WHERE k='sales_demo_marked'`).get())) {
  // one-time: the sales API did not exist before this version, so every existing row is generated demo data
  db.exec(`UPDATE sales_daily SET source='demo'`);
  db.prepare(`INSERT INTO meta (k, v) VALUES ('sales_demo_marked', '1')`).run();
}

const todayIso = businessDate;
const isoDaysAgo = daysAgo;

/** dish popularity is derived from PERSISTED SALES: rolling 30d vs prior 30d */
export function recomputeDishUnits(dishId: string) {
  const units = (db.prepare(`SELECT COALESCE(SUM(units),0) AS u FROM sales_daily WHERE dishId=? AND date > ?`).get(dishId, isoDaysAgo(30)) as any).u;
  const prevUnits = (db.prepare(`SELECT COALESCE(SUM(units),0) AS u FROM sales_daily WHERE dishId=? AND date <= ? AND date > ?`).get(dishId, isoDaysAgo(30), isoDaysAgo(60)) as any).u;
  db.prepare('UPDATE dishes SET units=?, prevUnits=? WHERE id=?').run(units, prevUnits, dishId);
  return { units, prevUnits };
}

export function seedIfEmpty(force = false, empty = false) {
  const has = db.prepare('SELECT COUNT(*) AS c FROM settings').get() as any;
  if (!force && has.c > 0) return false;
  const seed = seedData();
  const tx = db.transaction(() => {
    db.exec('DELETE FROM sales_daily; DELETE FROM recipe_items; DELETE FROM dishes; DELETE FROM ingredients;');
    if (has.c === 0) {
      const s = seed.settings;
      db.prepare('INSERT INTO settings (id, restaurant, location, currency, taxPct, foodCostTarget, popThreshold, marginThreshold) VALUES (?,?,?,?,?,?,?,?)')
        .run(1, s.restaurant, s.location, s.currency, s.taxPct, s.foodCostTarget, s.popThreshold, s.marginThreshold);
    }
    if (empty) return;
    const insIng = db.prepare('INSERT INTO ingredients (id, name, unit, price, prev, cat) VALUES (?,?,?,?,?,?)');
    for (const i of seed.ings) insIng.run(i.id, i.name, i.unit, i.price, i.prev, i.cat);
    const insDish = db.prepare('INSERT INTO dishes (id, name, cat, price, servings, wastage, gasCost, garnishCost, packagingCost, units, prevUnits, descr) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    const insItem = db.prepare('INSERT INTO recipe_items (dishId, ingredientId, qty, unit, name, fixedCost) VALUES (?,?,?,?,?,?)');
    for (const d of seed.dishes) {
      insDish.run(d.id, d.name, d.cat, d.price, d.servings, d.wastage, d.gasCost ?? 0, d.garnishCost ?? 0, d.packagingCost ?? 0, d.units, d.prevUnits, d.desc);
      for (const r of d.recipe) insItem.run(d.id, r.ing ?? null, r.qty, r.unit, r.name ?? null, r.fixedCost ?? null);
    }
    const { rows } = analyze(seed.dishes, seed.ings, seed.settings);
    const insSale = db.prepare(`INSERT INTO sales_daily (dishId, date, units, revenue, contribution, source) VALUES (?,?,?,?,?,'demo')`);
    for (const d of rows) for (const p of trendFor(d, d.cm, 90)) insSale.run(d.id, p.date, p.units, p.revenue, p.contribution);
    // keep dishes.units consistent with the generated baseline
    for (const d of seed.dishes) recomputeDishUnits(d.id);
  });
  tx();
  return true;
}

// Existing unclaimed source data is preserved, but never served to a new account.
seedIfEmpty(false, true);

// keep popularity (rolling 30/60-day windows) fresh for any DB on every boot
for (const d of db.prepare('SELECT id FROM dishes').all() as any[]) recomputeDishUnits(d.id);

/* ---------------- queries ---------------- */

export function getSettings() {
  const settings=db.prepare('SELECT restaurant, location, currency, taxPct, foodCostTarget, popThreshold, marginThreshold FROM settings WHERE id = 1').get() as any;
  const exists=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='business_context'").get();
  const profile=exists?db.prepare('SELECT priceSensitivity FROM business_context WHERE id=1').get() as any:null;
  return {...settings,maxSuggestedPriceIncreasePct:(hospitalityDefaults.sensitivity as any)[profile?.priceSensitivity||'medium'].maxPriceIncreasePct};
}

export function saveSettings(patch: Record<string, any>) {
  const cur = getSettings();
  const next = { ...cur, ...patch };
  db.prepare('UPDATE settings SET restaurant=?, location=?, currency=?, taxPct=?, foodCostTarget=?, popThreshold=?, marginThreshold=? WHERE id=1')
    .run(next.restaurant, next.location, next.currency, next.taxPct, next.foodCostTarget, next.popThreshold ?? null, next.marginThreshold ?? null);
  return getSettings();
}

export function getIngredients() {
  return db.prepare('SELECT id, name, unit, price, prev, cat FROM ingredients ORDER BY name').all() as any[];
}

export function getDishes() {
  const dishes = db.prepare('SELECT id, name, cat, price, servings, wastage, gasCost, garnishCost, packagingCost, units, prevUnits, descr FROM dishes ORDER BY name').all() as any[];
  const items = db.prepare('SELECT dishId, ingredientId AS ing, qty, unit, name, fixedCost FROM recipe_items ORDER BY rowid').all() as any[];
  const byDish = new Map<string, any[]>();
  for (const it of items) {
    if (!byDish.has(it.dishId)) byDish.set(it.dishId, []);
    const row: any = { qty: it.qty, unit: it.unit };
    if (it.ing != null) row.ing = it.ing;
    if (it.name != null) row.name = it.name;
    if (it.fixedCost != null) row.fixedCost = it.fixedCost;
    byDish.get(it.dishId)!.push(row);
  }
  return dishes.map((d) => ({ ...d, desc: d.descr, recipe: byDish.get(d.id) || [] }));
}

export function getDish(id: string) {
  return getDishes().find((d) => d.id === id);
}

export function upsertDish(d: any) {
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO dishes (id, name, cat, price, servings, wastage, gasCost, garnishCost, packagingCost, units, prevUnits, descr)
                VALUES (@id,@name,@cat,@price,@servings,@wastage,@gasCost,@garnishCost,@packagingCost,@units,@prevUnits,@desc)
                ON CONFLICT(id) DO UPDATE SET name=@name, cat=@cat, price=@price, servings=@servings,
                  wastage=@wastage, gasCost=@gasCost, garnishCost=@garnishCost, packagingCost=@packagingCost,
                  units=@units, prevUnits=@prevUnits, descr=@desc`).run({
      id: d.id, name: d.name, cat: d.cat, price: d.price, servings: d.servings, wastage: d.wastage,
      gasCost: d.gasCost ?? 0, garnishCost: d.garnishCost ?? 0, packagingCost: d.packagingCost ?? 0,
      units: d.units ?? 0, prevUnits: d.prevUnits ?? 0, desc: d.desc ?? '',
    });
    db.prepare('DELETE FROM recipe_items WHERE dishId = ?').run(d.id);
    const ins = db.prepare('INSERT INTO recipe_items (dishId, ingredientId, qty, unit, name, fixedCost) VALUES (?,?,?,?,?,?)');
    for (const r of d.recipe) ins.run(d.id, r.ing ?? null, r.qty, r.unit, r.name ?? null, r.fixedCost ?? null);
    recomputeDishUnits(d.id);
  });
  tx();
  return getDish(d.id);
}

export function deleteDish(id: string) {
  return db.prepare('DELETE FROM dishes WHERE id = ?').run(id).changes;
}

export function insertIngredient(i: any) {
  const id = i.id || i.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  db.prepare('INSERT INTO ingredients (id, name, unit, price, prev, cat) VALUES (?,?,?,?,?,?)')
    .run(id, i.name, i.unit, i.price, i.prev ?? i.price, i.cat ?? 'Pantry');
  return db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
}

export function updateIngredient(id: string, patch: any) {
  db.prepare(`UPDATE ingredients SET
      name = COALESCE(@name, name),
      cat = COALESCE(@cat, cat),
      unit = COALESCE(@unit, unit),
      prev = CASE WHEN @price IS NOT NULL AND @price != price THEN price ELSE prev END,
      price = COALESCE(@price, price)
    WHERE id = @id`).run({ id, name: patch.name ?? null, cat: patch.cat ?? null, unit: patch.unit ?? null, price: patch.price ?? null });
  return db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
}

export function deleteIngredient(id: string) {
  return db.prepare('DELETE FROM ingredients WHERE id = ?').run(id).changes;
}

export function getSales(dishId: string, days: number) {
  return db.prepare('SELECT date, units, revenue, contribution, source FROM sales_daily WHERE dishId = ? AND date > ? AND date <= ? ORDER BY date')
    .all(dishId, isoDaysAgo(days), todayIso()) as any[];
}

export function demoRowsFor(dishId: string): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM sales_daily WHERE dishId = ? AND source = 'demo'`).get(dishId) as any).c;
}

/** record a sale; first real entry replaces the generated demo baseline for that dish */
export function recordSale(dishId: string, date: string, units: number, source: 'manual' | 'csv') {
  const dish = getDish(dishId);
  const cmRow = menuAnalysis().rows.find((r) => r.id === dishId);
  const cm = cmRow ? cmRow.cm : 0;
  let replacedDemo = 0;
  const tx = db.transaction(() => {
    replacedDemo = demoRowsFor(dishId);
    if (replacedDemo) db.prepare(`DELETE FROM sales_daily WHERE dishId = ? AND source = 'demo'`).run(dishId);
    db.prepare(`INSERT INTO sales_daily (dishId, date, units, revenue, contribution, source)
                VALUES (?,?,?,?,?,?)
                ON CONFLICT(dishId, date) DO UPDATE SET units=excluded.units, revenue=excluded.revenue,
                  contribution=excluded.contribution, source=excluded.source`)
      .run(dishId, date, units, units * dish.price, units * cm, source);
    recomputeDishUnits(dishId);
  });
  tx();
  return { replacedDemoBaseline: replacedDemo > 0, demoRowsRemoved: replacedDemo, ...recomputeDishUnits(dishId) };
}

export function deleteSale(dishId: string, date: string) {
  const changes = db.prepare('DELETE FROM sales_daily WHERE dishId = ? AND date = ?').run(dishId, date).changes;
  if (changes) recomputeDishUnits(dishId);
  return changes;
}

export function salesSummary(days: number) {
  const from = isoDaysAgo(days);
  const series = db.prepare(`SELECT date, SUM(units) AS units, SUM(revenue) AS revenue, SUM(contribution) AS contribution
                             FROM sales_daily WHERE date > ? GROUP BY date ORDER BY date`).all(from) as any[];
  const demoDishes = (db.prepare(`SELECT COUNT(DISTINCT dishId) AS c FROM sales_daily WHERE source='demo'`).get() as any).c;
  const totals = db.prepare(`SELECT COALESCE(SUM(units),0) AS units, COALESCE(SUM(revenue),0) AS revenue, COALESCE(SUM(contribution),0) AS contribution
                             FROM sales_daily WHERE date > ?`).get(from) as any;
  return { days, from, series, totals, demoDishes };
}

export function menuAnalysis(days = 30) {
  const dishes = getDishes();
  const current = new Map((db.prepare(`SELECT dishId, SUM(units) units, SUM(revenue) revenue, SUM(contribution) contribution FROM sales_daily WHERE date > ? AND date <= ? GROUP BY dishId`).all(isoDaysAgo(days), todayIso()) as any[]).map(r => [r.dishId, r]));
  const previous = new Map((db.prepare(`SELECT dishId, SUM(units) units, SUM(revenue) revenue, SUM(contribution) contribution FROM sales_daily WHERE date > ? AND date <= ? GROUP BY dishId`).all(isoDaysAgo(days*2), isoDaysAgo(days)) as any[]).map(r => [r.dishId, r]));
  const a = analyze(dishes.map(d => ({...d, units: current.get(d.id)?.units || 0, prevUnits: previous.get(d.id)?.units || 0})), getIngredients(), getSettings());
  a.rows = a.rows.map(r => ({...r, revenue: current.get(r.id)?.revenue || 0, contribution: current.get(r.id)?.contribution || 0, prevRevenue: previous.get(r.id)?.revenue || 0, prevContribution: previous.get(r.id)?.contribution || 0}));
  const sum = (key: string) => a.rows.reduce((total, row) => total + (row as any)[key], 0);
  const revenue=sum('revenue'), contribution=sum('contribution'), prevRevenue=sum('prevRevenue'), prevContribution=sum('prevContribution');
  a.totals = {...a.totals, revenue, contribution, prevRevenue, prevContribution,
    avgFC: revenue ? (revenue-contribution)/revenue*100 : 0,
    prevAvgFC: prevRevenue ? (prevRevenue-prevContribution)/prevRevenue*100 : 0,
    avgCmPct: revenue ? contribution/revenue*100 : 0};
  return a;
}

export const helpers = { todayIso, isoDaysAgo };
