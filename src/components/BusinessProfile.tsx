import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../store/AppContext";

export default function BusinessProfile() {
  const { refreshBackend } = useApp();
  const [profile, setProfile] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState("");
  useEffect(() => {
    let live = true;
    api
      .business()
      .then((p) => {
        if (live) setProfile(p);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const fields = [
    [
      "businessType",
      "Establishment type",
      [
        ["cafe", "Café"],
        ["qsr", "QSR"],
        ["restaurant", "Restaurant"],
        ["hotel-restaurant", "Hotel restaurant"],
        ["cloud-kitchen", "Cloud kitchen"],
        ["stall", "Street stall"],
        ["other", "Other"],
      ],
    ],
    [
      "areaType",
      "Area type",
      [
        ["college", "College"],
        ["market", "Market"],
        ["office", "Office"],
        ["tourist", "Tourist"],
      ],
    ],
    [
      "customerSegment",
      "Main customer segment",
      [
        ["students", "Students"],
        ["families", "Families"],
        ["office-workers", "Office workers"],
        ["tourists", "Tourists"],
      ],
    ],
    [
      "priceSensitivity",
      "Price sensitivity",
      [
        ["low", "Low"],
        ["medium", "Medium"],
        ["high", "High"],
      ],
    ],
  ] as const;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved("");
    try {
      setProfile(await api.saveBusiness(profile));
      await refreshBackend();
      setSaved(
        "Business profile saved. Food-cost target updated; you can fine-tune it below.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
    >
      <h2 className="font-semibold text-lg">
        Business context & pricing guardrails
      </h2>
      <p className="text-sm text-slate-500">
        Planning defaults based on your business and customers. They do not
        predict market prices or demand.
      </p>
      {error && (
        <p role="alert" className="text-rose-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-emerald-700">
          {saved}
        </p>
      )}
      {profile ? (
        <>
          <label className="block text-sm">
            City / location
            <input
              required
              minLength={2}
              maxLength={160}
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={profile.location}
              onChange={(e) => {
                setSaved("");
                setProfile({ ...profile, location: e.target.value });
              }}
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map(([key, label, options]) => (
              <label key={key} className="text-sm">
                {label}
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                  value={profile[key]}
                  onChange={(e) => {
                    setSaved("");
                    setProfile({ ...profile, [key]: e.target.value });
                  }}
                >
                  {options.map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="rounded-xl bg-amber-50 p-3 text-sm">
            Last saved defaults: food-cost target{" "}
            {profile.defaults.foodCostTarget}%; suggested price rise capped at{" "}
            {profile.defaults.maxPriceIncreasePct}%.{" "}
            {profile.defaults.preferRecipe
              ? "Recipe changes are shown first for price-sensitive customers."
              : ""}{" "}
            Save to update these values.
          </p>
          <button
            disabled={busy}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save business profile"}
          </button>
        </>
      ) : (
        <p>Loading profile…</p>
      )}
    </form>
  );
}
