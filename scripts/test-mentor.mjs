import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
const directory = path.resolve("verification-data/mentor-" + Date.now());
fs.mkdirSync(directory, { recursive: true });
const p = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: {
    ...process.env,
    PORT: "4623",
    DATABASE_FILE: path.join(directory, "main.db"),
    SMS_PROVIDER: "mock",
    DEMO_SHOW_OTP: "true",
  },
  stdio: "ignore",
});
let count = 0;
const check = (n, ok) => {
  if (!ok) throw Error("FAIL " + n);
  console.log("PASS " + n);
  count++;
};
const near = (a, b) => Math.abs(a - b) < 1e-7;
async function req(route, body, cookie = "", method = body ? "POST" : "GET") {
  const r = await fetch("http://127.0.0.1:4623/api" + route, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    json: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
async function account(phone) {
  const s = await req("/auth/signup", {
    owner: "Mentor Test",
    phone,
    password: "MentorTestPassword42",
  });
  return (
    await req("/auth/signup/verify", {
      challengeId: s.json.challengeId,
      code: s.json.demoOtp,
    })
  ).cookie;
}
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await req("/auth/me")).status === 200) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const a = await account("9000000311"),
    b = await account("9000000312");
  const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    month = date.slice(0, 7);
  check(
    "plan protected",
    (await req("/action-plan?month=" + month)).status === 401,
  );
  check(
    "legacy business save works",
    (
      await req(
        "/business",
        { businessType: "cafe", location: "Dehradun" },
        a,
        "PUT",
      )
    ).status === 200,
  );
  let r = await req(
    "/business",
    {
      businessType: "qsr",
      location: "Dehradun",
      areaType: "college",
      customerSegment: "students",
      priceSensitivity: "high",
    },
    a,
    "PUT",
  );
  check(
    "profile defaults use type area segment",
    r.json.defaults.foodCostTarget === 36,
  );
  check(
    "high sensitivity caps rise",
    r.json.defaults.maxPriceIncreasePct === 5 && r.json.defaults.preferRecipe,
  );
  check(
    "profile defaults update settings",
    (await req("/settings", undefined, a)).json.foodCostTarget === 36,
  );
  check(
    "profile isolated",
    (await req("/business", undefined, b)).json.customerSegment === "families",
  );
  check(
    "invalid segment rejected",
    (
      await req(
        "/business",
        { businessType: "cafe", location: "Delhi", customerSegment: "invalid" },
        a,
        "PUT",
      )
    ).status === 400,
  );
  check(
    "partial legacy save preserves context",
    (
      await req(
        "/business",
        { businessType: "cafe", location: "Delhi" },
        a,
        "PUT",
      )
    ).json.customerSegment === "students",
  );
  await req("/settings", { popThreshold: 10, marginThreshold: 40 }, a, "PATCH");
  await req(
    "/ingredients",
    { id: "cheese", name: "Cheese", unit: "kg", price: 100 },
    a,
  );
  const dishes = [
    {
      id: "dog",
      name: "Cheese Toast",
      cat: "Snacks",
      price: 100,
      qty: 800,
      units: 5,
    },
    {
      id: "better",
      name: "Light Toast",
      cat: "Snacks",
      price: 100,
      qty: 200,
      units: 20,
    },
    {
      id: "other",
      name: "Other category",
      cat: "Drinks",
      price: 100,
      qty: 100,
      units: 20,
    },
    {
      id: "zero",
      name: "No sales yet",
      cat: "Drinks",
      price: 100,
      qty: 100,
      units: 0,
    },
  ];
  for (const d of dishes) {
    check(
      "create " + d.id,
      (
        await req(
          "/dishes",
          {
            id: d.id,
            name: d.name,
            cat: d.cat,
            price: d.price,
            servings: 1,
            wastage: 0,
            recipe: [{ ing: "cheese", qty: d.qty, unit: "g" }],
          },
          a,
        )
      ).status === 201,
    );
    if (d.units) await req("/sales", { dishId: d.id, date, units: d.units }, a);
  }
  await req(
    "/expenses",
    { date, category: "Rent", kind: "fixed", amount: 100 },
    a,
  );
  await req(
    "/expenses",
    { date, category: "Delivery commissions", kind: "variable", amount: 45 },
    a,
  );
  r = await req("/action-plan?month=" + month, undefined, a);
  let actions = r.json.actions;
  check(
    "every dish gets action",
    dishes.every((d) => actions.some((a) => a.dishId === d.id)),
  );
  check("stock not assumed", !actions.some((a) => a.kind === "replace"));
  check(
    "stock owner confirms",
    (
      await req(
        "/pantry-availability",
        { ingredientId: "cheese", inStock: true },
        a,
        "PUT",
      )
    ).status === 200,
  );
  check(
    "other owner stock isolated",
    (await req("/pantry-availability", undefined, b)).json.length === 0,
  );
  check(
    "unknown stock id rejected",
    (
      await req(
        "/pantry-availability",
        { ingredientId: "unknown", inStock: true },
        a,
        "PUT",
      )
    ).status === 404,
  );
  r = await req("/action-plan?month=" + month, undefined, a);
  actions = r.json.actions;
  const price = actions.find((a) => a.id === "dog:price"),
    recipe = actions.find((a) => a.id === "dog:recipe"),
    replacement = actions.find((a) => a.id === "dog:replace:better");
  check(
    "high sensitivity prefers recipe",
    actions.find((a) => a.dishId === "dog").kind === "recipe",
  );
  check(
    "price bounded and quantified",
    near(price.newPrice, 105) && near(price.monthlyImpact, 25),
  );
  check(
    "portion cost uses engine",
    near(recipe.newQty, 640) &&
      near(recipe.newCost, 64) &&
      near(recipe.monthlyImpact, 80),
  );
  check(
    "stocked same category replacement costed",
    replacement && replacement.newCost === 20 && replacement.newPrice === 100,
  );
  check(
    "other category excluded",
    !actions.some((a) => a.id === "dog:replace:other"),
  );
  await req(
    "/ingredients",
    { id: "premium", name: "Premium ingredient", unit: "kg", price: 10000 },
    a,
  );
  await req(
    "/dishes",
    {
      id: "cost-heavy",
      name: "Cost heavy alternative",
      cat: "Snacks",
      price: 200,
      servings: 1,
      wastage: 0,
      recipe: [
        ...Array.from({ length: 4 }, () => ({
          ing: "cheese",
          qty: 1,
          unit: "g",
        })),
        { ing: "premium", qty: 10, unit: "g" },
      ],
    },
    a,
  );
  const stockedPlan = (await req("/action-plan?month=" + month, undefined, a))
    .json;
  check(
    "unstocked expensive ingredient excludes replacement",
    !stockedPlan.actions.some((a) => a.id === "dog:replace:cost-heavy"),
  );
  await req("/dishes/cost-heavy", undefined, a, "DELETE");
  for (const [sensitivity, cap] of [
    ["low", 15],
    ["medium", 10],
    ["high", 5],
  ]) {
    await req(
      "/business",
      {
        businessType: "cafe",
        location: "Delhi",
        areaType: "college",
        customerSegment: "students",
        priceSensitivity: sensitivity,
      },
      a,
      "PUT",
    );
    const capPlan = (await req("/action-plan?month=" + month, undefined, a))
      .json;
    check(
      sensitivity + " sensitivity bound",
      capPlan.actions
        .filter((a) => a.kind === "price")
        .every((a) => a.newPrice <= a.oldPrice * (1 + cap / 100) + 0.001),
    );
  }

  check(
    "no fabricated sales impact",
    actions.filter((a) => a.dishId === "zero").every((a) => !a.monthlyImpact),
  );
  const preview = (selected, transferPct = 60, cookie = a) =>
    req("/action-plan/preview", { month, selected, transferPct }, cookie);
  r = await preview([]);
  check(
    "empty plan equals historical baseline",
    JSON.stringify(r.json.before) === JSON.stringify(r.json.after),
  );
  check(
    "before profit after overhead",
    near(r.json.before.estimatedOperatingProfit, 3355),
  );
  r = await preview(["dog:recipe"]);
  check(
    "recipe action improves estimated profit exactly",
    near(r.json.after.estimatedOperatingProfit, 3435),
  );
  check("recipe action keeps revenue", near(r.json.after.revenue, 4500));
  check(
    "food cost ratio accurate",
    near(r.json.after.foodCostPct, (920 / 4500) * 100),
  );
  check(
    "cover contribution uses units",
    near(r.json.after.contributionPerCover, 3580 / 45),
  );
  r = await preview(["dog:replace:better"]);
  check(
    "default 60 percent transfer loses remainder",
    near(r.json.after.units, 43) && near(r.json.after.revenue, 4300),
  );
  check(
    "replacement profit includes scaled variable expenses",
    near(r.json.after.estimatedOperatingProfit, 3497),
  );
  r = await preview(["dog:remove"], 0);
  check(
    "zero transfer loses all source sales",
    near(r.json.after.units, 40) && near(r.json.after.revenue, 4000),
  );
  r = await preview(["dog:remove"], 100);
  check("100 percent transfer retains units", near(r.json.after.units, 45));
  check(
    "same category destination only",
    r.json.transfers.every((t) => t.to === "Light Toast"),
  );
  check(
    "conflicting actions rejected",
    (await preview(["dog:price", "dog:recipe"])).status === 400,
  );
  check(
    "unknown recommendation rejected",
    (await preview(["fake"])).status === 400,
  );
  check(
    "cross account action rejected",
    (await preview(["dog:price"], 60, b)).status === 400,
  );
  check(
    "invalid transfer rejected",
    (await preview(["dog:remove"], 101)).status === 400,
  );
  check(
    "invalid month rejected",
    (await req("/action-plan?month=2026-99", undefined, a)).status === 400,
  );
  check(
    "plan has no menu write side effect",
    (await req("/dishes/dog", undefined, a)).json.recipe[0].qty === 800,
  );
  check(
    "historical sales preserved",
    (await req("/expenses?month=" + month, undefined, a)).json.revenue === 4500,
  );
  await req(
    "/settings",
    { popThreshold: 100, marginThreshold: 1000 },
    a,
    "PATCH",
  );
  check(
    "no eligible transfer destination rejected",
    (await preview(["dog:remove", "better:remove"], 60)).status === 400,
  );
  check(
    "removing all category with zero transfer allowed",
    (await preview(["dog:remove", "better:remove"], 0)).status === 200,
  );
  r = await preview([], 60, b);
  check(
    "empty owner division guarded",
    r.json.before.foodCostPct === null &&
      r.json.before.contributionPerCover === null,
  );
  console.log(count + " mentor checks passed");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  const exited = once(p, "exit");
  p.kill();
  await exited;
}
