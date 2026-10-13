import { Ingredient } from '../types';
import { ING_SYNONYMS } from '../data/seed';
import { natUnit } from './calc';

export interface ParsedIngredient {
  name: string; qty: number; unit: 'g' | 'ml' | 'pc'; ingredientId?: string | null;
  estimatedCost?: number | null; confidence: 'high' | 'medium' | 'low'; needsConfirmation: boolean; note?: string;
}
const hindi: Record<string, string> = {
  'दूध': 'milk', 'चिकन': 'chicken', 'मुर्गा': 'chicken', 'मक्खन': 'butter', 'पनीर': 'paneer',
  'टमाटर': 'tomatoes', 'प्याज': 'onions', 'प्याज़': 'onions', 'चीनी': 'sugar', 'तेल': 'oil',
  'चावल': 'rice', 'मैदा': 'flour', 'लहसुन': 'garlic', 'अदरक': 'ginger', 'दही': 'yogurt', 'क्रीम': 'cream',
  'मिलीलीटर': 'ml', 'मिलिलीटर': 'ml', 'किलोग्राम': 'kg', 'किलो': 'kg', 'ग्राम': 'g', 'लीटर': 'l', 'टुकड़े': 'pieces',
  'और': 'and',
};
function normalized(s: string): string { return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
export function ingredientMatch(name: string, ingredients: Ingredient[]) {
  const n = normalized(name);
  if (!n) return undefined;
  const matches = ingredients.filter(i => [i.name, ...(ING_SYNONYMS[i.id] || [])].some(alias => normalized(alias) === n));
  return matches.length === 1 ? matches[0] : undefined;
}
export function ingredientCost(qty: number, ingredient: Ingredient): number {
  return Math.round((ingredient.unit === 'pc' ? qty * ingredient.price : qty / 1000 * ingredient.price) * 100) / 100;
}
export function parseRecipe(text: string, ingredients: Ingredient[]): {items: ParsedIngredient[]; warnings: string[]} {
  let clean = text.replace(/[०-९]/g, digit => String('०१२३४५६७८९'.indexOf(digit)));
  for (const [from, to] of Object.entries(hindi)) clean = clean.split(from).join(to);
  const segments = clean.split(/[,;\n]|\s+and\s+|\.(?=\s+[A-Za-z])/i).map(s => s.trim()).filter(Boolean);
  const items: ParsedIngredient[] = [], warnings: string[] = [];
  const quantity = /(\d+(?:\.\d+)?)\s*(kilograms?|kgs?|grams?|gms?|g|litres?|liters?|ltrs?|l|millilitres?|milliliters?|ml|cups?|pieces?|pcs?|pc)\b/i;
  for (const segment of segments) {
    const lump = segment.match(/^(.*?)\s+worth\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?|₹)?\s*$/i);
    if (lump) {
      items.push({name:lump[1].trim(),qty:1,unit:'pc',ingredientId:null,estimatedCost:Number(lump[2]),confidence:'medium',needsConfirmation:true,note:'Provided lump-sum cost — verify before saving'});
      continue;
    }
    const m = quantity.exec(segment);
    if (!m) {warnings.push(`Could not parse: "${segment}" — enter ingredient and measurable quantity`);continue;}
    const name = segment.replace(m[0], '').replace(/^[\s:-]+|[\s:.-]+$/g,'').replace(/^of\s+/i,'').trim();
    if (!name) {warnings.push(`Missing ingredient name: "${segment}"`);continue;}
    let qty=Number(m[1]); const token=m[2].toLowerCase();
    let unit:'g'|'ml'|'pc' = /^(l|ml|millil)/.test(token)?'ml':/^(piece|pc)/.test(token)?'pc':'g';
    const cup=/^cup/.test(token);
    if (/^(kg|kilogram)/.test(token)||/^(l|litre|liter|ltr)s?$/.test(token)) qty*=1000;
    const found=ingredientMatch(name, ingredients);
    const mismatch=!!found && natUnit(found)!==unit;
    const note = cup ? 'Cup size depends on the ingredient — replace with weighed g/ml quantity' : mismatch ? 'Quantity unit does not match ingredient pricing — correct before applying' : !found ? 'No exact ingredient match — choose an ingredient or supply its actual cost' : undefined;
    if(cup){qty=0;unit=found?natUnit(found):'g';}
    items.push({name:found?.name||name,qty,unit,ingredientId:found?.id??null,
      estimatedCost:found&&!mismatch&&!cup?ingredientCost(qty,found):null,
      confidence:note?'low':'high',needsConfirmation:!!note||qty===0,note});
  }
  return {items,warnings};
}
