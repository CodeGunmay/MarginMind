import { ENV } from './env';
import { insightFor } from '../src/lib/ai';

/**
 * Dish insight grounded in deterministic server-computed metrics.
 * - engine 'llm' when an OpenAI-compatible key is configured (explanation written by the model,
 *   from the computed numbers — never invented ones).
 * - engine 'rules' otherwise or on any LLM failure (with `note` describing the fallback reason).
 */

export function aiStatus() {
  return {
    llmConfigured: !!ENV.OPENAI_API_KEY,
    llmModel: ENV.OPENAI_API_KEY ? ENV.OPENAI_MODEL : null,
    engine: ENV.OPENAI_API_KEY ? 'llm' : 'rules',
    ocrAvailable: true,
  };
}

function confidenceFor(d: any, popT: number, marT: number): 'High' | 'Medium' | 'Low' {
  const dist = Math.min(Math.abs(d.units - popT) / (popT || 1), Math.abs(d.cm - marT) / (marT || 1));
  return dist > 0.25 ? 'High' : dist > 0.08 ? 'Medium' : 'Low';
}

async function llmExplain(metrics: Record<string, number | string>): Promise<{ why: string; action: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${ENV.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ENV.OPENAI_API_KEY}` },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: ENV.OPENAI_MODEL,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are a restaurant menu-engineering analyst. Use ONLY the provided metrics — do not invent numbers. ' +
              'Reply as strict JSON: {"why": string, "action": string}. ' +
              '“why” explains the quadrant classification from the thresholds; “action” is one concrete next step. Each max 60 words.',
          },
          { role: 'user', content: `Metrics (computed deterministically from the restaurant database): ${JSON.stringify(metrics)}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM API ${res.status}`);
    const data: any = await res.json();
    let raw = String(data.choices?.[0]?.message?.content || '').trim().replace(/^```(?:json)?|```$/g, '').trim();
    const parsed = JSON.parse(raw);
    if (typeof parsed.why !== 'string' || typeof parsed.action !== 'string' || parsed.why.length < 10) {
      throw new Error('Model returned an invalid explanation shape');
    }
    return { why: parsed.why, action: parsed.action };
  } finally {
    clearTimeout(t);
  }
}

export async function explainDish(d: any, ctx: any) {
  const base = insightFor(d, ctx);
  const confidence = confidenceFor(d, ctx.popT, ctx.marT);
  if (!ENV.OPENAI_API_KEY) {
    return { engine: 'rules', ...base, confidence, note: 'Rule-based text (no LLM key configured). Numbers are deterministic.' };
  }
  try {
    const llm = await llmExplain({
      dish: d.name, cls: d.cls, price: d.price, costPerServing: Number(d.cost.toFixed(2)), foodCostPct: Number(d.fcPct.toFixed(1)),
      contributionPerUnit: Number(d.cm.toFixed(2)), unitsPerMonth: d.units, popularityThreshold: Math.round(ctx.popT),
      marginThreshold: Number(ctx.marT.toFixed(2)), menuAverageCm: Number(ctx.avgCm.toFixed(2)), foodCostTargetPct: ctx.settings.foodCostTarget,
    });
    return { engine: 'llm', ...llm, confidence, note: `Explanation written by ${ENV.OPENAI_MODEL} from computed metrics only.` };
  } catch (e: any) {
    return { engine: 'rules', ...base, confidence, note: `LLM unavailable (${e.message}) — rule-based fallback shown.` };
  }
}
