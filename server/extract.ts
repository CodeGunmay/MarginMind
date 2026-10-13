import { ENV } from './env';
import { parseRecipe, ingredientMatch } from '../src/lib/recipe';
import { natUnit } from '../src/lib/calc';

/**
 * AI recipe extraction.
 * - If OPENAI_API_KEY is configured, an OpenAI-compatible chat model extracts
 *   structured ingredients (engine: 'llm').
 * - Otherwise a deterministic rule parser is used (engine: 'rules').
 * Every returned item carries `confidence` and `needsConfirmation` so the UI
 * can ask a human to confirm uncertain quantities before saving.
 */

export interface ExtractedItem {
  name: string;
  qty: number;
  unit: 'g' | 'ml' | 'pc';
  ingredientId?: string | null;
  estimatedCost?: number | null;
  confidence: 'high' | 'medium' | 'low';
  needsConfirmation: boolean;
  note?: string;
}

export const ruleParse = parseRecipe;
const matchIngredient = ingredientMatch;

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

async function llmParse(text: string, ings: any[]): Promise<ExtractedItem[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const list = ings.map((i) => `${i.id}: ${i.name} (${i.unit})`).join('; ');
    const res = await fetch(`${ENV.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ENV.OPENAI_API_KEY}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: ENV.OPENAI_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Extract recipe ingredients as strict JSON: {"items":[{"name":string,"qty":number,"unit":"g"|"ml"|"pc","ingredientId":string|null,"confidence":"high"|"low"}]}. ' +
              'Convert kg→g (x1000), L→ml (x1000). For cups or missing quantities, use qty 0 and confidence low; never invent a weight. ' +
              `Map each item to the closest known ingredient id from: ${list}. Use null if no match.`,
          },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM API ${res.status}`);
    const data: any = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const raw: any[] = Array.isArray(parsed.items) ? parsed.items : [];
    return raw.slice(0, 60).map((r) => {
      const found = r.ingredientId ? ings.find((i) => i.id === r.ingredientId) : matchIngredient(r.name || '', ings);
      const qty = Number.isFinite(Number(r.qty)) && Number(r.qty) >= 0 && Number(r.qty) <= 100000 ? Number(r.qty) : 0;
      const unit: ExtractedItem['unit'] = ['g', 'ml', 'pc'].includes(r.unit) ? r.unit : 'g';
      return {
        name: found ? found.name : cap(String(r.name || 'Unknown')),
        qty, unit,
        ingredientId: found?.id ?? null,
        estimatedCost: found ? Math.round((found.unit === 'pc' ? qty * found.price : (qty / 1000) * found.price) * 100) / 100 : null,
        confidence: !found || r.confidence === 'low' ? 'low' : 'high',
        needsConfirmation: true,
        note: !found ? 'Unmatched — choose ingredient or enter actual cost' : unit !== natUnit(found) ? 'Unit mismatch — correct before applying' : 'Model extraction — verify ingredient, quantity and unit',
      };
    });
  } finally {
    clearTimeout(t);
  }
}

export async function extractRecipe(text: string, ings: any[]) {
  if (ENV.OPENAI_API_KEY) {
    try {
      const items = await llmParse(text, ings);
      if (items.length) return { engine: 'llm', items, warnings: [] as string[] };
      return { engine: 'rules', ...ruleParse(text, ings), warnings: ['LLM returned no items — fell back to rule parser'] };
    } catch (e: any) {
      return { engine: 'rules', ...ruleParse(text, ings), warnings: [`LLM unavailable (${e.message}) — fell back to rule parser`] };
    }
  }
  return { engine: 'rules', ...ruleParse(text, ings) };
}
