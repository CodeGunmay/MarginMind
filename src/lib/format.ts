export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function money(n: number, sym = '₹'): string {
  const neg = n < 0;
  const v = Math.abs(n);
  return `${neg ? '−' : ''}${sym}${fmtNum(Math.round(v))}`;
}

export function moneyShort(n: number, sym = '₹'): string {
  const neg = n < 0;
  const v = Math.abs(n);
  if (v >= 10000000) return `${neg ? '−' : ''}${sym}${(v / 10000000).toFixed(2)}Cr`;
  if (v >= 100000) return `${neg ? '−' : ''}${sym}${(v / 100000).toFixed(2)}L`;
  if (v >= 1000) return `${neg ? '−' : ''}${sym}${(v / 1000).toFixed(1)}k`;
  return money(n, sym);
}

export function pctChange(cur: number, prev: number): number {
  if (!prev) return 0;
  return ((cur - prev) / prev) * 100;
}

export function fmtPct(n: number, digits = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}
