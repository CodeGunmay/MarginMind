import { z } from "zod";
import { db, getDishes, getIngredients, getSettings } from "./db";
import { getBusiness, profitability, monthSchema } from "./expenses";
import { analyze, recipeCost, natUnit, itemCost } from "../src/lib/calc";
import defaults from "./hospitality-defaults.json";
import type { Dish, Ingredient } from "../src/types";

export const selectionSchema = z.object({
  month: monthSchema,
  selected: z.array(z.string().max(200)).max(1000),
  transferPct: z.number().min(0).max(100).default(defaults.defaultTransferPct),
});
export const stockSchema = z.object({
  ingredientId: z.string().min(1).max(60),
  inStock: z.boolean(),
});
const money = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const cents = (n: number) => Math.round(n * 100) / 100;
function complete(d: Dish, map: Map<string, Ingredient>) {
  return (
    d.price > 0 &&
    d.servings > 0 &&
    d.recipe.length > 0 &&
    d.recipe.every(
      (r) =>
        r.qty > 0 &&
        (r.fixedCost !== undefined
          ? r.fixedCost > 0
          : !!r.ing &&
            !!map.get(r.ing) &&
            map.get(r.ing)!.price > 0 &&
            r.unit === natUnit(map.get(r.ing)!)),
    )
  );
}
export function stockAvailability() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS pantry_availability(ingredientId TEXT PRIMARY KEY,inStock INTEGER NOT NULL)",
  );
  const stock = new Map(
    (db.prepare("SELECT * FROM pantry_availability").all() as any[]).map(
      (r) => [r.ingredientId, !!r.inStock],
    ),
  );
  return getIngredients().map((i) => ({
    ...i,
    inStock: stock.get(i.id) || false,
  }));
}
export function saveStock(value: z.infer<typeof stockSchema>) {
  stockAvailability();
  if (!getIngredients().some((i) => i.id === value.ingredientId)) return false;
  db.prepare(
    "INSERT INTO pantry_availability VALUES (?,?) ON CONFLICT(ingredientId) DO UPDATE SET inStock=excluded.inStock",
  ).run(value.ingredientId, Number(value.inStock));
  return true;
}

export function planRecommendations(month: string) {
  const business = getBusiness(),
    baseline = profitability(month),
    ingredients = getIngredients(),
    map = new Map(ingredients.map((i) => [i.id, i]));
  const sales = new Map(
    baseline.allocatedDishes.map((r: any) => [r.dishId, r]),
  );
  const dishes = getDishes().map((d) => ({
    ...d,
    units: Number((sales.get(d.id) as any)?.units || 0),
  }));
  const analysis = analyze(dishes, ingredients, getSettings());
  const stocked = new Set(
    stockAvailability()
      .filter((i) => i.inStock)
      .map((i) => i.id),
  );
  const actions: any[] = [];
  for (const row of analysis.rows) {
    const record = sales.get(row.id) as any,
      units = row.units;
    if (!complete(row, map)) {
      actions.push({
        id: row.id + ":review",
        dishId: row.id,
        dish: row.name,
        kind: "review",
        category: row.cat,
        selectable: false,
        text: "Complete and verify recipe quantities, ingredient prices and selling price before calculating an action.",
        monthlyImpact: null,
      });
      continue;
    }
    const cost = recipeCost(row, map).perServing;
    const cap = business.defaults.maxPriceIncreasePct;
    const desired = cost / (getSettings().foodCostTarget / 100);
    const newPrice = cents(Math.min(desired, row.price * (1 + cap / 100)));
    const priceAction =
      newPrice > row.price + 0.01
        ? {
            id: row.id + ":price",
            dishId: row.id,
            dish: row.name,
            category: row.cat,
            kind: "price",
            selectable: true,
            newPrice,
            oldPrice: row.price,
            newCost: cost,
            oldCost: cost,
            monthlyUnits: units,
            monthlyImpact: cents((newPrice - row.price) * units),
            text: `Raise price ${money(row.price)} → ${money(newPrice)}; +${money(newPrice - row.price)}/plate, +${money((newPrice - row.price) * units)}/selected month.`,
            note: `Capped at +${cap}%. Assumes unchanged demand; owner approval required.`,
          }
        : null;
    const candidates = row.recipe
      .map((r, index) => ({
        r,
        index,
        cost:
          r.fixedCost === undefined && r.ing
            ? recipeCost(
                {
                  ...row,
                  recipe: [r],
                  gasCost: 0,
                  garnishCost: 0,
                  packagingCost: 0,
                },
                map,
              ).perServing
            : 0,
      }))
      .filter((r) => r.cost > 0 && r.r.unit !== "pc")
      .sort((a, b) => b.cost - a.cost);
    const candidate = candidates[0];
    let recipeAction: any = null;
    if (candidate) {
      const recipe = row.recipe.map((r, i) =>
        i === candidate.index
          ? {
              ...r,
              qty:
                Math.round(
                  r.qty * (1 - defaults.portionReductionPct / 100) * 100,
                ) / 100,
            }
          : r,
      );
      const changedCost = recipeCost({ ...row, recipe }, map).perServing;
      const saving = cost - changedCost;
      const ing = map.get(candidate.r.ing!)!;
      if (saving > 0.001)
        recipeAction = {
          id: row.id + ":recipe",
          dishId: row.id,
          dish: row.name,
          category: row.cat,
          kind: "recipe",
          selectable: true,
          newCost: changedCost,
          oldCost: cost,
          newPrice: row.price,
          recipeIndex: candidate.index,
          newQty: recipe[candidate.index].qty,
          monthlyUnits: units,
          monthlyImpact: cents(saving * units),
          text: `Trial ${ing.name}: ${candidate.r.qty} ${candidate.r.unit} → ${recipe[candidate.index].qty} ${candidate.r.unit} per batch; saves ${money(saving)}/plate, ${money(saving * units)}/selected month.`,
          note: "Taste-test and confirm portion quality first. Savings include recorded yield and wastage; demand held constant.",
        };
    }
    if (business.defaults.preferRecipe) {
      if (recipeAction) actions.push(recipeAction);
      if (priceAction) actions.push(priceAction);
    } else {
      if (priceAction) actions.push(priceAction);
      if (recipeAction) actions.push(recipeAction);
    }
    if (!recipeAction && !priceAction)
      actions.push({
        id: row.id + ":keep",
        dishId: row.id,
        dish: row.name,
        category: row.cat,
        kind: "keep",
        selectable: false,
        monthlyImpact: 0,
        text: `Maintain ${money(row.price)} price and current recipe: ${money(row.price - cost)} contribution/plate; ${units} recorded sales this month.`,
        note: "Monitor demand and supplier costs; no improvement assumed.",
      });
    if (row.cls === "dog" && record) {
      const alternatives = analysis.rows
        .filter(
          (d) =>
            d.id !== row.id &&
            d.cat === row.cat &&
            complete(d, map) &&
            d.cm > row.cm &&
            d.price > 0 &&
            d.recipe.length > 0 &&
            d.recipe.filter((r) => r.ing && stocked.has(r.ing)).length /
              d.recipe.length >=
              defaults.minimumStockedIngredientShare &&
            d.recipe.reduce(
              (sum, r) =>
                sum +
                (r.ing && stocked.has(r.ing) ? itemCost(r, map.get(r.ing)) : 0),
              0,
            ) /
              recipeCost(d, map).sub >=
              defaults.minimumStockedIngredientShare,
        )
        .sort((a, b) => b.cm - a.cm)
        .slice(0, 2);
      for (const alternative of alternatives)
        actions.push({
          id: row.id + ":replace:" + alternative.id,
          dishId: row.id,
          dish: row.name,
          category: row.cat,
          kind: "replace",
          selectable: true,
          targetId: alternative.id,
          targetName: alternative.name,
          newCost: alternative.cost,
          newPrice: alternative.price,
          oldCost: cost,
          monthlyUnits: units,
          monthlyImpact: null,
          text: `Replace ${row.name} with ${alternative.name}: ${money(alternative.price)} price − ${money(alternative.cost)} cost = ${money(alternative.cm)} contribution/plate.`,
          note: `Existing owner recipe in the same category; ≥${Math.round(defaults.minimumStockedIngredientShare * 100)}% of ingredient lines and ingredient cost confirmed in stock. Transfer assumption applies.`,
        });
      actions.push({
        id: row.id + ":remove",
        dishId: row.id,
        dish: row.name,
        category: row.cat,
        kind: "remove",
        selectable: true,
        monthlyUnits: units,
        monthlyImpact: null,
        text: `Trial removal of ${row.name}: ${units} sales and ${money(record.contribution)} contribution in selected month.`,
        note: alternatives.length
          ? "Compare removal with costed replacements below."
          : "No qualifying stocked replacement recipe available. Add costed alternatives or confirm pantry availability.",
      });
    }
  }
  return {
    month,
    business,
    actions,
    baseline,
    defaultTransferPct: defaults.defaultTransferPct,
    notes: [
      "Food cost % includes all direct costs recorded in the recipe, including packaging and energy.",
      "Monthly sales are recorded units, not forecast demand. No automatic menu changes are made.",
      "Replacement recipes come from your menu; stock confirmation is availability, not inventory quantity.",
    ],
  };
}
export function projectPlan(input: z.infer<typeof selectionSchema>) {
  const plan = planRecommendations(input.month),
    unique = [...new Set(input.selected)],
    chosen = unique.map((id) => plan.actions.find((a) => a.id === id));
  if (chosen.some((a) => !a || !a.selectable))
    throw Object.assign(
      new Error("Recommendation is unavailable. Refresh the plan."),
      { status: 400 },
    );
  const changed = new Map<string, any>();
  for (const a of chosen) {
    if (changed.has(a.dishId))
      throw Object.assign(new Error("Choose only one action per dish."), {
        status: 400,
      });
    changed.set(a.dishId, a);
  }
  const dishes = getDishes(),
    map = new Map(getIngredients().map((i) => [i.id, i])),
    actual = new Map(
      plan.baseline.allocatedDishes.map((s: any) => [s.dishId, s]),
    );
  const metrics = (
    revenue: number,
    cost: number,
    units: number,
    fixed: number,
    variable: number,
  ) => ({
    revenue,
    directCosts: cost,
    units,
    foodCostPct: revenue > 0 ? (cost / revenue) * 100 : null,
    contribution: revenue - cost,
    contributionPerCover: units > 0 ? (revenue - cost) / units : null,
    estimatedOperatingProfit: revenue - cost - fixed - variable,
    fixed,
    variable,
  });
  const b = plan.baseline,
    before = metrics(b.revenue, b.directCosts, b.units, b.fixed, b.variable);
  if (!chosen.length)
    return {
      ...plan,
      before,
      after: { ...before },
      selected: unique,
      transferPct: input.transferPct,
      transfers: [],
      assumptions: [
        "No actions selected: after equals recorded before. One dish sale is used as a cover proxy; actual guest counts are not recorded.",
      ],
    };
  let revenue = b.revenue,
    cost = b.directCosts,
    units = b.units;
  const transfers: any[] = [];
  const targetValues = (id: string) => {
    const d = dishes.find((d) => d.id === id)!;
    const a = changed.get(id);
    return {
      price: a?.newPrice ?? d.price,
      cost: a?.newCost ?? recipeCost(d, map).perServing,
    };
  };
  for (const a of chosen) {
    const sale = actual.get(a.dishId) as any;
    if (!sale) continue;
    revenue -= sale.revenue;
    cost -= sale.revenue - sale.contribution;
    units -= sale.units;
    if (a.kind === "price" || a.kind === "recipe") {
      revenue += a.newPrice * sale.units;
      cost += a.newCost * sale.units;
      units += sale.units;
      continue;
    }
    const transferred = (sale.units * input.transferPct) / 100;
    let targets = dishes.filter(
      (d) =>
        d.id !== a.dishId &&
        d.cat === a.category &&
        complete(d, map) &&
        !["remove", "replace"].includes(changed.get(d.id)?.kind),
    );
    if (a.kind === "replace")
      targets = targets.filter((d) => d.id === a.targetId);
    if (transferred > 0 && !targets.length)
      throw Object.assign(
        new Error(
          `No eligible same-category destination for ${a.dish}. Choose another action or set transfer to 0%.`,
        ),
        { status: 400 },
      );
    const totalWeight = targets.reduce(
      (s, d) => s + Number((actual.get(d.id) as any)?.units || 0),
      0,
    );
    for (const target of targets) {
      const qty =
        transferred *
        (totalWeight > 0
          ? Number((actual.get(target.id) as any)?.units || 0) / totalWeight
          : 1 / targets.length);
      if (qty <= 0) continue;
      const values = targetValues(target.id);
      revenue += qty * values.price;
      cost += qty * values.cost;
      units += qty;
      transfers.push({ from: a.dish, to: target.name, units: qty });
    }
  }
  const variable =
    b.revenue > 0
      ? (b.variable * Math.max(0, revenue)) / b.revenue
      : b.variable;
  return {
    ...plan,
    before,
    after: metrics(revenue, cost, units, b.fixed, variable),
    selected: unique,
    transferPct: input.transferPct,
    transfers,
    assumptions: [
      `Removed/replaced dish sales transfer ${input.transferPct}% within the same category; the remainder is lost. Existing monthly sales determine allocation; equal shares if destinations have no recorded sales.`,
      "Price and recipe changes assume unchanged sales. Fixed expenses stay constant; variable expenses scale with revenue at the recorded rate.",
      "Selected actions use current recipe costs and prices; unchanged dishes retain historical recorded values. Tax, financing and unrecorded expenses excluded.",
      "Contribution per cover uses dish units as a proxy. Entered sales do not establish actual customer/guest counts.",
    ],
  };
}
