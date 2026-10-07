import { Analyzed, Ctx, Leak, Rec } from '../types';
import { money, moneyShort, fmtPct } from './format';

const SYM = (ctx: Ctx) => ctx.settings.currency;

/* ---------------- classification narrative ---------------- */
export function insightFor(d: Analyzed, ctx: Ctx) {
  const s = SYM(ctx);
  const popStr = d.pop === 'high' ? 'above' : 'below';
  const profStr = d.prof === 'high' ? 'above' : 'below';
  const clsName = { star: 'STAR', plowhorse: 'PLOWHORSE', puzzle: 'PUZZLE', dog: 'DOG' }[d.cls];
  const why = `${d.name} is classified as a ${clsName} because it sells ${d.units} units/month (${popStr} the popularity threshold of ${Math.round(ctx.popT)}) and earns ${money(d.cm, s)} contribution per plate (${profStr} the profitability threshold of ${money(ctx.marT, s)}).`;

  const dist = Math.min(
    Math.abs(d.units - ctx.popT) / (ctx.popT || 1),
    Math.abs(d.cm - ctx.marT) / (ctx.marT || 1)
  );
  const confidence: 'High' | 'Medium' | 'Low' = dist > 0.25 ? 'High' : dist > 0.08 ? 'Medium' : 'Low';

  let action = '';
  if (d.cls === 'star') action = `Protect and promote this dish. Keep it prominent on the menu, maintain portion consistency, and consider bundling it with a high-margin side or beverage to lift average order value.`;
  if (d.cls === 'plowhorse') {
    const need = Math.max(0, ctx.marT - d.cm);
    action = `This dish brings traffic but thin margins. ${need > 0 ? `A price increase of about ${money(Math.ceil(need / 5) * 5, s)} would bring it to the menu-average margin —` : ''} also explore re-engineering the recipe (portion or high-cost ingredients) before touching price, since demand is strong.`;
  }
  if (d.cls === 'puzzle') action = `Margins are excellent but it isn't selling. Improve menu placement (top-right position, server recommendations, photos), feature it in combos or specials, and test a small visibility push before discounting.`;
  if (d.cls === 'dog') action = `Low sales and low margins. Consider repositioning, repricing and recipe re-engineering first; if no improvement over the next cycle, retiring it frees prep time and inventory for stronger dishes.`;
  return { why, action, confidence };
}

/* ---------------- recommendations ---------------- */
export function recommendations(ctx: Ctx): Rec[] {
  const s = SYM(ctx);
  const recs: Rec[] = [];
  const target = ctx.settings.foodCostTarget;

  for (const d of ctx.rows) {
    const need = Math.max(0, ctx.marT - d.cm);
    const priceForTarget = Math.ceil((d.cost / (target / 100)) / 5) * 5;

    if (d.cls === 'plowhorse') {
      const sug = Math.max(Math.ceil((d.price + need) / 5) * 5, priceForTarget);
      const delta = sug - d.price;
      if (delta >= 5) {
        recs.push({
          id: `price-${d.id}`, type: 'pricing', dishId: d.id, dish: d.name, severity: 'high',
          title: `Reprice ${d.name}`,
          problem: `High sales volume (${d.units}/mo) but margin is below the menu average.`,
          evidence: [`Food cost ${d.fcPct.toFixed(1)}% vs target ${target}%`, `Contribution ${money(d.cm, s)}/unit vs menu avg ${money(ctx.marT, s)}`],
          action: `Increase price by ${money(delta, s)} to ${money(sug, s)}, or trim portion/ingredient cost by ~${money(delta, s)} if the price point is sensitive.`,
          impact: delta * d.units, impactText: `≈ ${money(delta * d.units, s)}/mo if volume holds`,
          apply: { price: sug },
        });
      }
      recs.push({
        id: `re-${d.id}`, type: 'recipe', dishId: d.id, dish: d.name, severity: 'medium',
        title: `Re-engineer ${d.name} recipe`,
        problem: `Ingredient cost eats ${d.fcPct.toFixed(1)}% of the selling price.`,
        evidence: [`Cost ${money(d.cost, s)}/plate on a ${money(d.price, s)} price`, `Volume ${d.units} units/mo amplifies the leak`],
        action: `Reduce high-cost ingredient portions by ~10% or renegotiate supplier pricing; keep perceived value intact.`,
        impact: d.cost * 0.1 * d.units, impactText: `≈ ${money(d.cost * 0.1 * d.units, s)}/mo from a 10% cost cut`,
      });
    }

    if (d.cls === 'puzzle') {
      const upside = Math.max(0, ctx.popT - d.units) * d.cm;
      recs.push({
        id: `promo-${d.id}`, type: 'promotion', dishId: d.id, dish: d.name, severity: 'medium',
        title: `Promote ${d.name}`,
        problem: `Strong margin but only ${d.units} units/month.`,
        evidence: [`Contribution ${money(d.cm, s)}/unit (avg ${money(ctx.marT, s)})`, `Sold ${d.units} vs popularity threshold ${Math.round(ctx.popT)}`],
        action: `Feature it as chef's special, add a photo/menu call-out, train servers to recommend it, or bundle it with a bestseller.`,
        impact: upside * 0.5, impactText: `≈ ${money(upside * 0.5, s)}/mo if sales reach menu-average popularity`,
      });
    }

    if (d.cls === 'dog') {
      recs.push({
        id: `rem-${d.id}`, type: 'removal', dishId: d.id, dish: d.name, severity: d.fcPct > target + 15 ? 'high' : 'medium',
        title: `Review ${d.name} for repositioning or removal`,
        problem: `Low popularity and low profitability — it occupies menu space, prep time and inventory.`,
        evidence: [`${d.units} units/mo (avg ${Math.round(ctx.popT)})`, `Contribution ${money(d.cm, s)}/unit (avg ${money(ctx.marT, s)})`, `Food cost ${d.fcPct.toFixed(1)}%`],
        action: `Try one reposition/reprice cycle; otherwise retire it and backfill with a high-margin variant of a bestseller.`,
        impact: Math.max(0, -d.contribution) + 2500, impactText: `Frees inventory & prep; protects focus on ${money(d.revenue, s)} revenue that may migrate to stars`,
      });
    }

    if (d.fcPct > target + 12 && d.cls !== 'dog') {
      recs.push({
        id: `fc-${d.id}`, type: 'recipe', dishId: d.id, dish: d.name, severity: 'high',
        title: `Bring ${d.name} food cost under control`,
        problem: `Food cost is unusually high.`,
        evidence: [`Food cost ${d.fcPct.toFixed(1)}% vs target ${target}%`, `That's ${money(d.cost - (d.price * target) / 100, s)} excess cost on every plate`],
        action: `Audit portioning, switch premium ingredients to validated alternatives, or reprice toward ${money(priceForTarget, s)}.`,
        impact: (d.cost - (d.price * target) / 100) * d.units, impactText: `≈ ${money((d.cost - (d.price * target) / 100) * d.units, s)}/mo closing the gap to target`,
      });
    }
  }

  for (const ing of ctx.ings) {
    const chg = ing.prev ? ((ing.price - ing.prev) / ing.prev) * 100 : 0;
    if (chg < 4) continue;
    const affected = ctx.rows.filter((d) => d.recipe.some((r) => r.ing === ing.id));
    if (!affected.length) continue;
    const impact = affected.reduce((sum, d) => {
      const it = d.recipe.find((r) => r.ing === ing.id)!;
      const perUnit = ing.unit === 'pc' ? it.qty * (ing.price - ing.prev) : (it.qty / 1000) * (ing.price - ing.prev);
      return sum + perUnit * d.units;
    }, 0);
    recs.push({
      id: `ing-${ing.id}`, type: 'ingredient', severity: impact > 2000 ? 'high' : 'medium',
      title: `${ing.name} price up ${chg.toFixed(1)}%`,
      problem: `Supplier price moved from ${money(ing.prev, s)}/${ing.unit} to ${money(ing.price, s)}/${ing.unit}.`,
      evidence: [`Used in ${affected.length} dish${affected.length > 1 ? 'es' : ''}: ${affected.slice(0, 4).map((a) => a.name).join(', ')}${affected.length > 4 ? '…' : ''}`, `Estimated added cost ${moneyShort(impact, s)}/month`],
      action: `Renegotiate contract, qualify an alternate supplier, or substitute where the chef validates taste. Affected dishes may need small price adjustments.`,
      impact, impactText: `≈ ${money(impact, s)}/mo margin erosion if unaddressed`,
    });
  }

  return recs.sort((a, b) => b.impact - a.impact);
}

/* ---------------- profit leak detector ---------------- */
export function profitLeaks(ctx: Ctx): Leak[] {
  const s = SYM(ctx);
  const leaks: Leak[] = [];
  const target = ctx.settings.foodCostTarget;

  for (const d of ctx.rows) {
    const excess = d.cost - (d.price * target) / 100;
    if (d.pop === 'high' && d.fcPct > target + 5) {
      leaks.push({
        id: `hv-${d.id}`, severity: excess * d.units > 4000 ? 'high' : 'medium', dishId: d.id, title: d.name,
        problem: `High sales but low margin — food cost ${d.fcPct.toFixed(1)}% vs ${target}% target.`,
        impact: excess * d.units,
        action: `Reprice by ${money(Math.max(10, Math.ceil((ctx.marT - d.cm) / 5) * 5), s)} or trim portion/high-cost ingredients.`,
      });
    }
    if (d.fcPct > target + 15 && d.pop === 'low') {
      leaks.push({
        id: `fc-${d.id}`, severity: 'high', dishId: d.id, title: d.name,
        problem: `Unusually high food cost (${d.fcPct.toFixed(1)}%) on a low-selling dish.`,
        impact: excess * d.units,
        action: `Re-engineer the recipe or retire; every plate sold is ${money(excess, s)} above the cost target.`,
      });
    }
    if (d.contribution < d.prevContribution * 0.93 && d.prevContribution > 1000) {
      const drop = d.prevContribution - d.contribution;
      leaks.push({
        id: `dc-${d.id}`, severity: drop > 3000 ? 'high' : 'medium', dishId: d.id, title: d.name,
        problem: `Contribution declined ${fmtPct((d.contribution / d.prevContribution - 1) * 100)} vs last month (${d.units} vs ${d.prevUnits} units sold).`,
        impact: drop,
        action: `Investigate demand drop — placement, seasonality, reviews — before discounting.`,
      });
    }
  }

  for (const ing of ctx.ings) {
    const chg = ing.prev ? ((ing.price - ing.prev) / ing.prev) * 100 : 0;
    if (chg < 5) continue;
    for (const d of ctx.rows) {
      const it = d.recipe.find((r) => r.ing === ing.id);
      if (!it) continue;
      const perUnit = ing.unit === 'pc' ? it.qty * (ing.price - ing.prev) : (it.qty / 1000) * (ing.price - ing.prev);
      const impact = perUnit * d.units;
      if (impact < 250) continue;
      leaks.push({
        id: `ic-${ing.id}-${d.id}`, severity: impact > 1500 ? 'high' : 'medium', dishId: d.id, title: d.name,
        problem: `Rising ingredient cost: ${ing.name} is up ${chg.toFixed(1)}% (${money(ing.prev, s)} → ${money(ing.price, s)}/${ing.unit}).`,
        impact,
        action: `Review supplier or portion of ${ing.name.toLowerCase()} in this dish; consider a small price adjustment.`,
      });
    }
  }

  const seen = new Set<string>();
  return leaks
    .sort((a, b) => b.impact - a.impact)
    .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
}

/* ---------------- optimize my menu ---------------- */
export function optimizePlan(ctx: Ctx) {
  const byImpact = (a: Analyzed, b: Analyzed) => b.contribution - a.contribution;
  const stars = ctx.rows.filter((d) => d.cls === 'star').sort(byImpact);
  const plow = ctx.rows.filter((d) => d.cls === 'plowhorse').sort((a, b) => (b.units * b.cost) - (a.units * a.cost));
  const puzz = ctx.rows.filter((d) => d.cls === 'puzzle').sort((a, b) => b.cm - a.cm);
  const dogs = ctx.rows.filter((d) => d.cls === 'dog').sort((a, b) => a.contribution - b.contribution);
  const reeng = ctx.rows.filter((d) => d.fcPct > ctx.settings.foodCostTarget + 10).sort((a, b) => b.fcPct - a.fcPct);
  const monitor = ctx.rows.filter((d) => d.cls === 'plowhorse' && d.cm >= ctx.marT - 25);
  return { stars, plow, puzz, dogs, reeng, monitor };
}

/* ---------------- ingredient substitution ---------------- */
const SUBS: Record<string, { alt: string; price: number; unit: string; note: string }[]> = {
  cream: [
    { alt: 'Cooking cream (15% fat)', price: 180, unit: 'L', note: 'Slightly lighter body; works well in pasta and makhani gravies.' },
    { alt: 'Cashew cream (house-made)', price: 165, unit: 'L', note: 'Dairy-light option; adds mild nuttiness — validate with chef.' },
  ],
  cheese: [
    { alt: 'Processed cheese block', price: 380, unit: 'kg', note: 'Melt profile differs slightly; fine for burgers, test on pizzas.' },
    { alt: 'Mozzarella–cheddar blend', price: 420, unit: 'kg', note: 'Good stretch + flavour; slightly sharper taste.' },
  ],
  butter: [
    { alt: 'White butter (makhani)', price: 340, unit: 'kg', note: 'Fresh dairy flavour; shorter shelf life — plan inventory.' },
    { alt: 'Bakery margarine', price: 320, unit: 'kg', note: 'Noticeable flavour change; only for non-signature dishes.' },
  ],
  chick: [
    { alt: 'Boneless thigh (vs breast/curry cut)', price: 250, unit: 'kg', note: 'Juicier and cheaper; adjust trim/portioning.' },
  ],
  paneer: [
    { alt: 'Firm tofu', price: 260, unit: 'kg', note: 'Texturally different; position as vegan option instead of direct swap.' },
  ],
  coffee: [
    { alt: 'Premium instant blend', price: 650, unit: 'kg', note: 'Consistent and faster prep; slight flavour trade-off.' },
  ],
  mushroom: [
    { alt: 'Button mushroom (wholesale)', price: 200, unit: 'kg', note: 'Seasonal pricing; lock a weekly rate.' },
  ],
};

export function substitutionsFor(ingId: string) {
  return SUBS[ingId] || [];
}
export function substitutableIngredients(ctx: Ctx) {
  return ctx.ings.filter((i) => SUBS[i.id]).map((i) => {
    const usedIn = ctx.rows.filter((d) => d.recipe.some((r) => r.ing === i.id)).length;
    return { ...i, usedIn };
  });
}

/* ---------------- menu description generator ---------------- */
export function describeDish(d: Analyzed, ctx: Ctx, variant = 0): string {
  const ings = d.recipe
    .map((r) => (r.ing ? ctx.ingMap.get(r.ing)?.name : r.name))
    .filter(Boolean) as string[];
  const hero = (ings[0] || d.cat).toLowerCase();
  const support = ings.slice(1, 4).map((i) => i.toLowerCase());
  const templates = [
    `Slow-crafted ${hero === 'chicken (curry cut)' ? 'chicken' : hero} finished with ${support.join(', ') || 'aromatic spices'} — a ${d.cat.toLowerCase()} favourite made fresh in our Dehradun kitchen.`,
    `Hand-prepared ${d.name.toLowerCase()} layered with ${support.join(', ') || 'house spices'}, served piping hot with chef's accompaniments.`,
    `A ${d.cat.toLowerCase()} classic: ${hero === 'chicken (curry cut)' ? 'tender chicken' : hero} gently cooked with ${support.join(' and ') || 'fresh herbs'}, plated to order.`,
  ];
  return templates[variant % templates.length];
}

/* ---------------- dashboard AI insight ---------------- */
export function dashboardInsight(ctx: Ctx, recs: Rec[]): { text: string; count: number } {
  const s = SYM(ctx);
  const delta = ctx.totals.contribution - ctx.totals.prevContribution;
  const underMargined = ctx.rows.filter((d) => d.cls === 'plowhorse' && d.fcPct > ctx.settings.foodCostTarget).length;
  const dogs = ctx.rows.filter((d) => d.cls === 'dog').length;
  const dir = delta >= 0 ? `generated ${moneyShort(delta, s)} more contribution` : `lost ${moneyShort(-delta, s)} contribution`;
  const text = `Your menu ${dir} than last month, but ${underMargined} high-volume dish${underMargined === 1 ? ' is' : 'es are'} still under-margined and ${dogs} low performers need a decision. ${recs.length} ranked recommendations are ready.`;
  return { text, count: recs.length };
}

/* ---------------- alerts ---------------- */
export function alertsFor(ctx: Ctx): { level: 'high' | 'attention' | 'opportunity'; text: string; to: string }[] {
  const alerts: { level: 'high' | 'attention' | 'opportunity'; text: string; to: string }[] = [];
  for (const ing of ctx.ings) {
    const chg = ing.prev ? ((ing.price - ing.prev) / ing.prev) * 100 : 0;
    if (chg >= 8) {
      const used = ctx.rows.filter((d) => d.recipe.some((r) => r.ing === ing.id)).length;
      alerts.push({ level: 'high', text: `${ing.name} price increased ${chg.toFixed(1)}% — affects ${used} dish${used !== 1 ? 'es' : ''}.`, to: '/ingredients' });
    }
  }
  const highFc = ctx.rows.filter((d) => d.fcPct > 50).length;
  if (highFc) alerts.push({ level: 'attention', text: `${highFc} dish${highFc > 1 ? 'es have' : ' has'} food cost above 50%.`, to: '/menu?cls=plowhorse' });
  const puzz = ctx.rows.filter((d) => d.cls === 'puzzle').length;
  if (puzz) alerts.push({ level: 'opportunity', text: `${puzz} high-margin dish${puzz > 1 ? 'es' : ''} with low sales — promote to unlock contribution.`, to: '/menu?cls=puzzle' });
  const dogs = ctx.rows.filter((d) => d.cls === 'dog').length;
  if (dogs) alerts.push({ level: 'attention', text: `${dogs} DOG dish${dogs > 1 ? 'es' : ''} need a reposition-or-remove decision.`, to: '/menu?cls=dog' });
  return alerts;
}

/* ---------------- Ask MarginMind copilot ---------------- */
export function askAI(qRaw: string, ctx: Ctx, recs: Rec[], leaks: Leak[]): string {
  const s = SYM(ctx);
  const q = qRaw.toLowerCase();
  const top = (arr: Analyzed[], n = 3) => arr.slice(0, n).map((d, i) => `${i + 1}. ${d.name} — ${money(d.cm, s)}/plate · ${d.units} units/mo`).join('\n');

  if (q.includes('promote') || q.includes('push')) {
    const puzz = ctx.rows.filter((d) => d.cls === 'puzzle').sort((a, b) => b.cm - a.cm);
    return puzz.length
      ? `Promote your PUZZLES — high margin, low visibility:\n${top(puzz)}\nAdding photos, server recommendations and combos could realistically lift them toward menu-average sales. Estimated upside is shown per-dish on the AI Recommendations page (projections are demo estimates).`
      : 'Right now no dish fits the classic "promote me" profile (high margin + low sales). Your menu is already well balanced on visibility.';
  }
  if (q.includes('food cost') && (q.includes('high') || q.includes('why') || q.includes('reduce'))) {
    const worst = [...ctx.rows].sort((a, b) => b.fcPct - a.fcPct).slice(0, 3);
    return `Your menu average food cost is ${ctx.totals.avgFC.toFixed(1)}% (target ${ctx.settings.foodCostTarget}%). The biggest offenders:\n${worst.map((d, i) => `${i + 1}. ${d.name} — ${d.fcPct.toFixed(1)}% (cost ${money(d.cost, s)} on ${money(d.price, s)} price)`).join('\n')}\nMain drivers: cream, cheese and chicken prices. See Ingredient Costs for the spike breakdown.`;
  }
  if (q.includes('los') || q.includes('dog') || q.includes('worst') || q.includes('underperform')) {
    const dogs = ctx.rows.filter((d) => d.cls === 'dog').sort((a, b) => a.contribution - b.contribution);
    return dogs.length
      ? `These DOGS combine low sales with low margins:\n${top(dogs)}\nRecommendation: one reposition/reprice cycle, then retire what doesn't improve. Details live under Menu Intelligence → Dogs.`
      : 'Good news — no dish currently sits in the DOG quadrant.';
  }
  if (q.includes('chicken') && (q.includes('10') || q.includes('increase') || q.includes('inflation') || q.includes('rise'))) {
    const ing = ctx.ings.find((i) => i.id === 'chick')!;
    const np = ing.price * 1.1;
    const affected = ctx.rows.filter((d) => d.recipe.some((r) => r.ing === 'chick')).map((d) => {
      const it = d.recipe.find((r) => r.ing === 'chick')!;
      const perUnit = (it.qty / 1000) * (np - ing.price);
      return { d, impact: perUnit * d.units, perUnit };
    });
    const total = affected.reduce((sum, a) => sum + a.impact, 0);
    return `If chicken rises another 10% (${money(ing.price, s)} → ${money(np, s)}/kg), ${affected.length} dishes are hit:\n${affected.map((a) => `• ${a.d.name}: −${money(a.perUnit, s)}/plate → −${money(Math.round(a.impact), s)}/mo`).join('\n')}\nTotal estimated margin erosion: ${money(Math.round(total), s)}/month. Try it live in the Scenario Simulator or Ingredient Costs page.`;
  }
  if (q.includes('reprice') || q.includes('price')) {
    const plow = ctx.rows.filter((d) => d.cls === 'plowhorse').sort((a, b) => (ctx.marT - b.cm) * b.units - (ctx.marT - a.cm) * a.units);
    return plow.length
      ? `Reprice your PLOWHORSES first — strong demand, weak margin:\n${plow.slice(0, 3).map((d, i) => `${i + 1}. ${d.name}: +${money(Math.max(10, Math.ceil((ctx.marT - d.cm) / 5) * 5), s)} lifts contribution ≈ ${money(Math.max(10, Math.ceil((ctx.marT - d.cm) / 5) * 5) * d.units, s)}/mo if volume holds`).join('\n')}\nThese are estimates — validate price sensitivity before applying.`
      : 'No plowhorse needs repricing right now. Margins track the menu average.';
  }
  if (q.includes('leak')) {
    const l = leaks.slice(0, 4);
    return `Biggest detected profit leaks:\n${l.map((x, i) => `${i + 1}. ${x.title} (${x.severity.toUpperCase()}) — ${x.problem} Impact ≈ ${money(Math.round(x.impact), s)}/mo.`).join('\n')}\nFull detail is in the Profit Leak Detector.`;
  }
  if (q.includes('focus') || q.includes('first') || q.includes('three') || q.includes('priority') || q.includes('priorit')) {
    const r = recs.slice(0, 3);
    return `If I had to pick three moves first (ranked by estimated monthly impact):\n${r.map((x, i) => `${i + 1}. ${x.title} — ${x.problem} → ${x.action} (${x.impactText})`).join('\n\n')}\nAll figures are demo estimates derived from your menu data.`;
  }
  if (q.includes('star') && !q.includes('dog')) {
    const stars = ctx.rows.filter((d) => d.cls === 'star').sort((a, b) => b.contribution - a.contribution);
    return `Your STARS carry the menu:\n${top(stars, 5)}\nProtect quality and placement, and bundle beverages/sides around them.`;
  }
  if (q.includes('remove') || q.includes('retire') || q.includes('cut')) {
    const dogs = ctx.rows.filter((d) => d.cls === 'dog').sort((a, b) => a.contribution - b.contribution);
    return dogs.length ? `Removal review candidates:\n${top(dogs)}\nThey contribute little margin and tie up inventory; run one rescue cycle before cutting.` : 'Nothing qualifies for removal review this cycle.';
  }
  const c = ctx.totals;
  return `Here's the quick picture: ${ctx.rows.length} dishes, ${money(c.revenue, s)} revenue and ${money(c.contribution, s)} contribution this month (avg food cost ${c.avgFC.toFixed(1)}%). You can ask me things like:\n• "Which dishes should I promote?"\n• "Why is my food cost high?"\n• "What happens if chicken prices increase 10%?"\n• "Which three dishes should I focus on first?"`;
}
