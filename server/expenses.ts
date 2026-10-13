import { z } from "zod";
import defaults from "./hospitality-defaults.json";
import { db, getSettings, saveSettings } from "./db";
import { businessDate, validDate } from "../src/lib/dates";

export const businessSchema = z.object({
  businessType: z.enum([
    "stall",
    "cafe",
    "qsr",
    "restaurant",
    "hotel-restaurant",
    "cloud-kitchen",
    "other",
  ]),
  location: z.string().trim().min(2).max(160),
  areaType: z.enum(["college", "market", "office", "tourist"]).optional(),
  customerSegment: z
    .enum(["students", "families", "office-workers", "tourists"])
    .optional(),
  priceSensitivity: z.enum(["low", "medium", "high"]).optional(),
});
export function businessDefaults(profile: any) {
  return {
    foodCostTarget: Math.max(
      5,
      Math.min(
        70,
        (defaults.foodCostTargetByType as any)[profile.businessType] +
          (defaults.areaTargetAdjustment as any)[profile.areaType] +
          (defaults.segmentTargetAdjustment as any)[profile.customerSegment],
      ),
    ),
    ...(defaults.sensitivity as any)[profile.priceSensitivity],
  };
}
export const expenseSchema = z.object({
  date: z
    .string()
    .refine(validDate, "Enter a real date")
    .refine((s) => s <= businessDate(), "Future expenses cannot be recorded"),
  category: z.enum([
    "Rent",
    "Salaries",
    "Electricity",
    "Water",
    "Fuel",
    "Maintenance",
    "Delivery commissions",
    "Other",
  ]),
  kind: z.enum(["fixed", "variable"]),
  amount: z.number().positive().max(100000000),
  note: z.string().trim().max(300).default(""),
});
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
function init() {
  db.exec(`CREATE TABLE IF NOT EXISTS business_profile(id INTEGER PRIMARY KEY CHECK(id=1),businessType TEXT NOT NULL,location TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS operating_expenses(id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT NOT NULL,category TEXT NOT NULL,kind TEXT NOT NULL,amount REAL NOT NULL,note TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS expenses_date ON operating_expenses(date);`);
}
export function getBusiness() {
  init();
  db.exec(
    "CREATE TABLE IF NOT EXISTS business_context(id INTEGER PRIMARY KEY CHECK(id=1),areaType TEXT NOT NULL,customerSegment TEXT NOT NULL,priceSensitivity TEXT NOT NULL)",
  );
  const profile = {
    businessType: "other",
    location: getSettings().location || "",
    ...(db
      .prepare("SELECT businessType,location FROM business_profile WHERE id=1")
      .get() as any),
    areaType: "market",
    customerSegment: "families",
    priceSensitivity: "medium",
    ...(db
      .prepare(
        "SELECT areaType,customerSegment,priceSensitivity FROM business_context WHERE id=1",
      )
      .get() as any),
  };
  return { ...profile, defaults: businessDefaults(profile) };
}
export function saveBusiness(value: z.infer<typeof businessSchema>) {
  const before = getBusiness(),
    profile = { ...before, ...value };
  db.transaction(() => {
    db.prepare(
      "INSERT INTO business_profile(id,businessType,location) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET businessType=excluded.businessType,location=excluded.location",
    ).run(profile.businessType, profile.location);
    db.prepare(
      "INSERT INTO business_context VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET areaType=excluded.areaType,customerSegment=excluded.customerSegment,priceSensitivity=excluded.priceSensitivity",
    ).run(profile.areaType, profile.customerSegment, profile.priceSensitivity);
    saveSettings({
      location: profile.location,
      ...(value.areaType || value.customerSegment || value.priceSensitivity
        ? { foodCostTarget: businessDefaults(profile).foodCostTarget }
        : {}),
    });
  })();
  return getBusiness();
}
export function addExpense(value: z.infer<typeof expenseSchema>) {
  init();
  const r = db
    .prepare(
      "INSERT INTO operating_expenses(date,category,kind,amount,note) VALUES (?,?,?,?,?)",
    )
    .run(value.date, value.category, value.kind, value.amount, value.note);
  return { ...value, id: Number(r.lastInsertRowid) };
}
export function profitability(month: string) {
  init();
  const start = month + "-01";
  const [y, m] = month.split("-").map(Number);
  const end =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const expenses = db
    .prepare(
      "SELECT * FROM operating_expenses WHERE date>=? AND date<? ORDER BY date DESC,id DESC",
    )
    .all(start, end) as any[];
  const sales = db
    .prepare(
      "SELECT COALESCE(SUM(revenue),0) revenue,COALESCE(SUM(contribution),0) contribution,COALESCE(SUM(units),0) units FROM sales_daily WHERE date>=? AND date<? AND source IN ('manual','csv')",
    )
    .get(start, end) as any;
  const fixed = expenses
      .filter((e) => e.kind === "fixed")
      .reduce((s, e) => s + e.amount, 0),
    variable = expenses
      .filter((e) => e.kind === "variable")
      .reduce((s, e) => s + e.amount, 0),
    total = fixed + variable;
  const rate =
    sales.revenue > 0 ? (sales.contribution - variable) / sales.revenue : null;
  const rows = db
    .prepare(
      "SELECT s.dishId,COALESCE(d.name,s.dishId) name,SUM(s.units) units,SUM(s.revenue) revenue,SUM(s.contribution) contribution FROM sales_daily s LEFT JOIN dishes d ON d.id=s.dishId WHERE s.date>=? AND s.date<? AND s.source IN ('manual','csv') GROUP BY s.dishId",
    )
    .all(start, end) as any[];
  return {
    month,
    expenses,
    ...sales,
    directCosts: sales.revenue - sales.contribution,
    fixed,
    variable,
    total,
    estimatedOperatingProfit: sales.contribution - total,
    breakEvenRevenue: rate !== null && rate > 0 ? fixed / rate : null,
    breakEvenReason:
      rate === null
        ? "Record sales to estimate break-even."
        : rate <= 0
          ? "Recorded contribution after variable expenses is not positive."
          : null,
    allocationMethod: "Share of recorded revenue",
    allocatedDishes: rows.map((r) => ({
      ...r,
      allocatedExpense:
        sales.revenue > 0 ? (total * r.revenue) / sales.revenue : 0,
      estimatedProfit:
        sales.revenue > 0
          ? r.contribution - (total * r.revenue) / sales.revenue
          : null,
    })),
  };
}
