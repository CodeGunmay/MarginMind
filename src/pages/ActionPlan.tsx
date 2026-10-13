import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { businessDate } from "../lib/dates";
const money = (n: number | null) =>
  n === null
    ? "Not available"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(n);
export default function ActionPlan() {
  const [month, setMonth] = useState(businessDate().slice(0, 7)),
    [selected, setSelected] = useState<string[]>([]),
    [transfer, setTransfer] = useState<number | undefined>(undefined),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<any>(null),
    [stock, setStock] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [stockBusy, setStockBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.planPreview({ month, selected, transferPct: transfer }),
      api.pantryAvailability(),
    ])
      .then(([p, s]) => {
        if (alive) {
          setData(p);
          setStock(s);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [month, selected, transfer, revision]);
  async function mark(id: string, inStock: boolean) {
    setStockBusy(true);
    setError("");
    try {
      await api.saveStock({ ingredientId: id, inStock });
      setSelected([]);
      setRevision((n) => n + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStockBusy(false);
    }
  }
  function toggle(action: any) {
    setSelected((current) =>
      current.includes(action.id)
        ? current.filter((id) => id !== action.id)
        : [
            ...current.filter(
              (id) =>
                data.actions.find((a: any) => a.id === id)?.dishId !==
                action.dishId,
            ),
            action.id,
          ],
    );
  }
  const metrics = [
    ["Monthly revenue", "revenue"],
    ["Direct food / recipe cost %", "foodCostPct"],
    ["Contribution per cover*", "contributionPerCover"],
    ["Estimated operating profit", "estimatedOperatingProfit"],
  ];
  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold">
          Choose actions. Compare the business impact.
        </h2>
        <p className="text-slate-500 mt-2">
          Projections use your recorded monthly sales, costed recipes and
          entered operating expenses. Selecting an action does not change your
          menu or historical sales.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 bg-white border p-4 rounded-2xl">
        <label>
          Reporting month
          <input
            aria-label="Action plan month"
            type="month"
            className="block border rounded-lg p-2 mt-1"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setSelected([]);
                setData(null);
              }
            }}
          />
        </label>
        <label>
          Sales transferred after removal / replacement (%)
          <input
            aria-label="Sales transfer assumption"
            type="number"
            min={0}
            max={100}
            step={1}
            className="block border rounded-lg p-2 mt-1 w-32"
            value={transfer ?? data?.defaultTransferPct ?? 60}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 0 && n <= 100) setTransfer(n);
            }}
          />
        </label>
        <button
          className="text-sm underline self-end p-2"
          onClick={() => setSelected([])}
        >
          Clear selected actions
        </button>
      </div>
      {error && (
        <div role="alert" className="bg-rose-50 text-rose-700 rounded-xl p-4">
          {error}{" "}
          <button className="underline" onClick={() => setSelected([])}>
            Clear conflicting selections
          </button>
        </div>
      )}
      {loading && <p role="status">Recalculating…</p>}
      {data && !loading && !error && (
        <>
          <div className="bg-white border rounded-2xl overflow-x-auto">
            <table className="w-full text-left">
              <caption className="text-left p-4 font-semibold">
                Before / after for {month} — {selected.length} selected actions
              </caption>
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3">Measure</th>
                  <th className="p-3">Recorded before</th>
                  <th className="p-3">Projected after</th>
                  <th className="p-3">Change</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map(([label, key]) => {
                  const b = data.before[key],
                    a = data.after[key];
                  const format = (n: number | null) =>
                    key === "foodCostPct"
                      ? n === null
                        ? "Not available"
                        : n.toFixed(1) + "%"
                      : money(n);
                  return (
                    <tr key={key} className="border-t">
                      <td className="p-3">{label}</td>
                      <td className="p-3">{format(b)}</td>
                      <td className="p-3 font-semibold">{format(a)}</td>
                      <td className="p-3">
                        {b === null || a === null
                          ? "Not available"
                          : key === "foodCostPct"
                            ? (a - b).toFixed(1) + " points"
                            : money(a - b)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm space-y-2">
            <p className="font-semibold">
              Assumptions — review before deciding
            </p>
            {data.assumptions.map((n: string) => (
              <p key={n}>{n}</p>
            ))}
            <p>
              *A cover is approximated by one dish sold. Actual guest counts are
              not available. Recipe costs include recorded direct energy /
              packaging; do not duplicate them in expenses.
            </p>
            <p>
              Profit is before tax, financing and unrecorded costs. Taste-test
              recipe changes; price changes can reduce demand.
            </p>
          </div>
          {!data.actions.length && (
            <p className="bg-white border rounded-xl p-5">
              Add complete recipes and sales to generate recommendations.
              Monthly projections need actual sales.
            </p>
          )}
          <div className="space-y-3">
            {data.actions.map((a: any) => (
              <label
                key={a.id}
                className="flex items-start gap-3 bg-white border rounded-2xl p-4"
              >
                <input
                  aria-label={"Select " + a.text}
                  type="checkbox"
                  className="mt-1 accent-amber-600"
                  disabled={!a.selectable}
                  checked={selected.includes(a.id)}
                  onChange={() => toggle(a)}
                />
                <div>
                  <p className="text-sm text-amber-700 font-semibold">
                    {a.dish} · {a.kind}
                  </p>
                  <p className="font-medium mt-1">{a.text}</p>
                  <p className="text-sm text-slate-500 mt-1">{a.note}</p>
                </div>
              </label>
            ))}
          </div>
          {data.transfers.length > 0 && (
            <div className="bg-white border p-4 rounded-xl">
              <h3 className="font-semibold">Assumed sales transfers</h3>
              {data.transfers.map((t: any, i: number) => (
                <p key={i} className="text-sm mt-1">
                  {t.from} → {t.to}: {t.units.toFixed(2)} dish sales
                </p>
              ))}
            </div>
          )}
        </>
      )}
      <details className="bg-white border rounded-2xl p-4">
        <summary className="font-semibold cursor-pointer">
          Confirm ingredients currently in stock
        </summary>
        <p className="text-sm text-slate-500 my-3">
          Your ingredient list records purchase prices, not stock levels. Tick
          only ingredients you currently have. Changes clear selections and
          refresh replacement suggestions.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stock.map((i) => (
            <label key={i.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                disabled={stockBusy}
                checked={i.inStock}
                onChange={(e) => mark(i.id, e.target.checked)}
              />
              {i.name}
            </label>
          ))}
        </div>
        {!stock.length && <p className="text-sm">Add ingredients first.</p>}
      </details>
    </div>
  );
}
