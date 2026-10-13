import { z } from 'zod';
import { validDate } from '../src/lib/dates';
import type { Request, Response, NextFunction } from 'express';

export const settingsSchema = z.object({
  restaurant: z.string().min(1).max(120).optional(),
  location: z.string().min(1).max(160).optional(),
  currency: z.string().min(1).max(4).optional(),
  taxPct: z.number().min(0).max(40).optional(),
  foodCostTarget: z.number().min(5).max(70).optional(),
  popThreshold: z.number().min(0).max(100000).nullable().optional(),
  marginThreshold: z.number().min(0).max(100000).nullable().optional(),
});

export const ingredientCreateSchema = z.object({
  id: z.string().min(1).max(60).regex(/^[a-z0-9-_]+$/, 'id must be lowercase slug').optional(),
  name: z.string().min(1).max(120),
  unit: z.enum(['kg', 'L', 'pc']),
  price: z.number().min(0).max(1000000),
  prev: z.number().min(0).max(1000000).optional(),
  cat: z.string().max(60).optional(),
});

export const ingredientPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  unit: z.enum(['kg', 'L', 'pc']).optional(),
  price: z.number().min(0).max(1000000).optional(),
  cat: z.string().max(60).optional(),
});

const recipeItemSchema = z.object({
  ing: z.string().max(60).nullish(),
  qty: z.number().min(0).max(100000),
  unit: z.enum(['g', 'ml', 'pc']).default('g'),
  name: z.string().max(120).nullish(),
  fixedCost: z.number().min(0).max(1000000).nullish(),
}).refine((r) => (r.ing != null && r.ing !== '') || (r.name != null && r.name !== ''), {
  message: 'recipe item needs either an ingredient id (ing) or a custom name',
});

export const dishSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-z0-9-_]+$/, 'id must be lowercase slug'),
  name: z.string().min(1).max(120),
  cat: z.string().min(1).max(60),
  price: z.number().min(0).max(1000000),
  servings: z.number().min(1).max(1000).default(1),
  wastage: z.number().min(0).max(50).default(0),
  gasCost: z.number().min(0).max(100000).nullish().default(0),
  garnishCost: z.number().min(0).max(100000).nullish().default(0),
  packagingCost: z.number().min(0).max(100000).nullish().default(0),
  units: z.number().min(0).max(10000000).nullish().default(0),
  prevUnits: z.number().min(0).max(10000000).nullish().default(0),
  desc: z.string().max(300).default(''),
  recipe: z.array(recipeItemSchema).max(200).default([]),
});

export const simulateSchema = z.object({
  days: z.number().int().min(1).max(180).default(30),
  dishId: z.string().min(1),
  pricePct: z.number().min(-80).max(200).default(0),
  priceAbs: z.number().min(0).max(1000000).nullish(),
  inflPct: z.number().min(-80).max(500).default(0),
  portionPct: z.number().min(-90).max(200).default(0),
  volumePct: z.number().min(-99).max(1000).default(0),
});

export const extractSchema = z.object({
  text: z.string().min(5, 'describe at least one ingredient with a quantity').max(4000),
});

export const extractImageSchema = z.object({
  imageBase64: z.string().min(100, 'image payload too small').max(9_000_000, 'image too large (max ~6MB)'),
  mimeType: z.string().max(40).optional(),
});

export const saleSchema = z.object({
  dishId: z.string().min(1),
  date: z.string().refine(validDate, 'date must be a valid calendar date in YYYY-MM-DD format'),
  units: z.number().min(0).max(1000000),
});

export const salesImportSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  commit: z.boolean().default(false),
});

export const resetSchema = z.object({
  mode: z.enum(['demo', 'empty']).default('demo'),
});

export function handle(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: r.error.issues.map((i) => ({ field: i.path.join('.') || '(body)', message: i.message })),
      });
    }
    req.body = r.data;
    next();
  };
}

export const ah = (fn: any) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);
