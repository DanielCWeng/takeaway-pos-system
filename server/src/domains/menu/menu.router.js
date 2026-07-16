/**
 * domains/menu/menu.router.js
 *
 * GET    /api/menu       — return the full menu array
 * POST   /api/menu       — create a new menu item
 * PUT    /api/menu/:id   — update kitchen fields for one item
 * DELETE /api/menu/:id   — remove an item
 */

import { Router } from "express";
import { z } from "zod";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { sendValidationError } from "../../shared/middleware/sendValidationError.js";
import { logger } from "../../infrastructure/logger.js";
import { requireAdminAuth } from "../../shared/middleware/requireAdminAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MENU_PATH = path.resolve(__dirname, "../../../../client/src/assets/menu.json");

export const menuRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readMenu() {
  const raw = await readFile(MENU_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeMenu(data) {
  await writeFile(MENU_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const VALID_STATIONS = /** @type {const} */ ([
  "dark_fryer",
  "light_fryer",
  "oil_wok",
  "wet_wok",
  "noodle_machine",
  "noodle_machine_spicy",
  "microwave",
  "boiler",
  "sauce",
]);

const kitchenFieldsSchema = z.object({
  primaryStation:   z.enum(VALID_STATIONS).nullable().optional(),
  primaryCookTime:  z.number().int().positive().nullable().optional(),
  secondaryStation: z.enum(VALID_STATIONS).nullable().optional(),
  secondaryCookTime: z.number().int().positive().nullable().optional(),
  portionCapacity:  z.number().int().positive().nullable().optional(),
});

const createSchema = z.object({
  id:              z.string().min(1).max(20),
  nameEn:          z.string().min(1),
  nameZh:          z.string().optional().default(""),
  price:           z.number().nonnegative().optional(),
  primaryCategory: z.string().optional().default(""),
}).merge(kitchenFieldsSchema);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

menuRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await readMenu());
  } catch (err) {
    next(err);
  }
});

menuRouter.post("/", requireAdminAuth, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const menu = await readMenu();
    const { id, nameEn, nameZh, price, primaryCategory, ...kitchen } = parsed.data;

    if (menu.some((item) => item.id === id)) {
      return res.status(409).json({
        error: { code: "CONFLICT", message: `Item ID '${id}' already exists` },
      });
    }

    const newItem = {
      id,
      name: { en: nameEn, zh: nameZh ?? "" },
      ...(price !== undefined ? { price } : {}),
      ...(primaryCategory ? { primaryCategory } : {}),
      ...Object.fromEntries(
        Object.entries(kitchen).filter(([, v]) => v !== null && v !== undefined),
      ),
    };

    menu.push(newItem);
    await writeMenu(menu);
    logger.info("Menu item created", { id });
    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

menuRouter.put("/:id", requireAdminAuth, async (req, res, next) => {
  try {
    const parsed = kitchenFieldsSchema.extend({
      nameEn: z.string().min(1).optional(),
      nameZh: z.string().optional(),
      price:  z.number().nonnegative().nullable().optional(),
      primaryCategory: z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) return sendValidationError(res, parsed.error);

    const menu = await readMenu();
    const idx = menu.findIndex((item) => item.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: `Menu item '${req.params.id}' not found` },
      });
    }

    const { nameEn, nameZh, price, primaryCategory, ...kitchen } = parsed.data;

    if (nameEn !== undefined) menu[idx].name = { ...menu[idx].name, en: nameEn };
    if (nameZh !== undefined) menu[idx].name = { ...menu[idx].name, zh: nameZh };
    if (price !== undefined) {
      price === null ? delete menu[idx].price : (menu[idx].price = price);
    }
    if (primaryCategory !== undefined) menu[idx].primaryCategory = primaryCategory;

    for (const [key, val] of Object.entries(kitchen)) {
      if (val === null) {
        delete menu[idx][key];
      } else if (val !== undefined) {
        menu[idx][key] = val;
      }
    }

    await writeMenu(menu);
    logger.info("Menu item updated", { id: req.params.id });
    res.json(menu[idx]);
  } catch (err) {
    next(err);
  }
});

menuRouter.delete("/:id", requireAdminAuth, async (req, res, next) => {
  try {
    const menu = await readMenu();
    const idx = menu.findIndex((item) => item.id === req.params.id);

    if (idx === -1) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: `Menu item '${req.params.id}' not found` },
      });
    }

    menu.splice(idx, 1);
    await writeMenu(menu);
    logger.info("Menu item deleted", { id: req.params.id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
