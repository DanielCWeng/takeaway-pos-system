import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Check, Loader2, AlertCircle, Trash2, Plus, X } from "lucide-react";
import { apiClient } from "../../api/client";

// ---------------------------------------------------------------------------
// Station config
// ---------------------------------------------------------------------------

const STATION_OPTIONS = [
  { value: "dark_fryer",           label: "Dark Fryer" },
  { value: "light_fryer",          label: "Light Fryer" },
  { value: "oil_wok",              label: "Oil Wok" },
  { value: "wet_wok",              label: "Wet Wok" },
  { value: "noodle_machine",       label: "Noodle Machine" },
  { value: "noodle_machine_spicy", label: "Noodle Machine (Spicy)" },
  { value: "microwave",            label: "Microwave" },
  { value: "boiler",               label: "Boiler" },
  { value: "sauce",                label: "Sauce" },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawMenuItem {
  id: string;
  name: { en: string; zh?: string };
  primaryCategory?: string;
  price?: number;
  primaryStation?: string;
  primaryCookTime?: number;
  secondaryStation?: string;
  secondaryCookTime?: number;
  portionCapacity?: number;
  // set meal / legacy
  contents?: unknown[];
}

interface MenuItemUpdates {
  nameEn?: string;
  nameZh?: string;
  price?: number | null;
  primaryCategory?: string;
  primaryStation?: string | null;
  primaryCookTime?: number | null;
  secondaryStation?: string | null;
  secondaryCookTime?: number | null;
  portionCapacity?: number | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtSecs(s: number | undefined): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

function parsePosInt(v: string): number | null {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Add Item Modal
// ---------------------------------------------------------------------------

interface AddItemModalProps {
  categories: string[];
  onAdd: (item: RawMenuItem) => void;
  onClose: () => void;
}

const EMPTY_FORM = {
  id: "", nameEn: "", nameZh: "", price: "",
  primaryCategory: "",
  primaryStation: "", primaryCookTime: "",
  secondaryStation: "", secondaryCookTime: "",
  portionCapacity: "",
};

function AddItemModal({ categories, onAdd, onClose }: AddItemModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim() || !form.nameEn.trim()) {
      setError("ID and English name are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        id: form.id.trim().toUpperCase(),
        nameEn: form.nameEn.trim(),
        nameZh: form.nameZh.trim() || undefined,
        price: form.price ? parseFloat(form.price) : undefined,
        primaryCategory: form.primaryCategory || undefined,
        primaryStation: form.primaryStation || null,
        primaryCookTime: parsePosInt(form.primaryCookTime),
        secondaryStation: form.secondaryStation || null,
        secondaryCookTime: parsePosInt(form.secondaryCookTime),
        portionCapacity: parsePosInt(form.portionCapacity),
      };
      await apiClient.createMenuItem(payload);
      const newItem: RawMenuItem = {
        id: payload.id,
        name: { en: payload.nameEn, zh: payload.nameZh },
        primaryCategory: payload.primaryCategory,
        price: payload.price,
        primaryStation: payload.primaryStation ?? undefined,
        primaryCookTime: payload.primaryCookTime ?? undefined,
        secondaryStation: payload.secondaryStation ?? undefined,
        secondaryCookTime: payload.secondaryCookTime ?? undefined,
        portionCapacity: payload.portionCapacity ?? undefined,
      };
      onAdd(newItem);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create item.";
      setError(msg.includes("already exists") ? `ID '${form.id.toUpperCase()}' is already in use.` : msg);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500";
  const labelCls = "block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1";
  const selectCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-white">Add Menu Item</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* ID + Names */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Item ID *</label>
              <input placeholder="e.g. CM1" value={form.id} onChange={set("id")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>English Name *</label>
              <input placeholder="Chicken Chow Mein" value={form.nameEn} onChange={set("nameEn")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Chinese Name</label>
              <input placeholder="鸡肉炒面" value={form.nameZh} onChange={set("nameZh")} className={inputCls} />
            </div>
          </div>

          {/* Price + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Price (£)</label>
              <input type="number" min={0} step={0.01} placeholder="0.00" value={form.price} onChange={set("price")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.primaryCategory} onChange={set("primaryCategory")} className={selectCls}>
                <option value="">— none —</option>
                {categories.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">Kitchen Timing</p>

            {/* Primary station */}
            <div className="flex gap-3 mb-3 items-end">
              <div className="flex-1">
                <label className={labelCls}>Primary station</label>
                <select value={form.primaryStation} onChange={set("primaryStation")} className={selectCls}>
                  <option value="">— none —</option>
                  {STATION_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="w-28">
                <label className={labelCls}>Time (seconds)</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0} placeholder="sec" value={form.primaryCookTime} onChange={set("primaryCookTime")}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-white text-right focus:outline-none focus:border-sky-500" />
                  {form.primaryCookTime && (
                    <span className="text-xs text-zinc-500 shrink-0">{fmtSecs(parsePosInt(form.primaryCookTime) ?? 0)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Secondary station */}
            <div className="flex gap-3 mb-3 items-end">
              <div className="flex-1">
                <label className={labelCls}>2nd station <span className="normal-case text-zinc-600">(optional)</span></label>
                <select value={form.secondaryStation} onChange={set("secondaryStation")} className={selectCls}>
                  <option value="">— none —</option>
                  {STATION_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="w-28">
                <label className={labelCls}>Time (seconds)</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={0} placeholder="sec" value={form.secondaryCookTime} onChange={set("secondaryCookTime")}
                    className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-white text-right focus:outline-none focus:border-sky-500" />
                  {form.secondaryCookTime && (
                    <span className="text-xs text-zinc-500 shrink-0">{fmtSecs(parsePosInt(form.secondaryCookTime) ?? 0)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Portions per run */}
            <div className="w-40">
              <label className={labelCls}>Portions per run</label>
              <input type="number" min={1} placeholder="1" value={form.portionCapacity} onChange={set("portionCapacity")}
                className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-sm text-white text-right focus:outline-none focus:border-sky-500" />
            </div>

            {/* Total */}
            {(form.primaryCookTime || form.secondaryCookTime) && (
              <div className="mt-3 text-xs text-zinc-500">
                Total cook time:{" "}
                <span className="text-white font-semibold">
                  {fmtSecs(
                    (parsePosInt(form.primaryCookTime) ?? 0) +
                    (parsePosInt(form.secondaryCookTime) ?? 0)
                  )}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm font-semibold transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item row
// ---------------------------------------------------------------------------

interface RowProps {
  item: RawMenuItem;
  onSave: (id: string, updates: MenuItemUpdates) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function MenuItemRow({ item, onSave, onDelete }: RowProps) {
  const [primaryStation, setPrimaryStation]     = useState(item.primaryStation ?? "");
  const [primaryCookTime, setPrimaryCookTime]   = useState(item.primaryCookTime?.toString() ?? "");
  const [secondaryStation, setSecondaryStation] = useState(item.secondaryStation ?? "");
  const [secondaryCookTime, setSecondaryCookTime] = useState(item.secondaryCookTime?.toString() ?? "");
  const [portionCapacity, setPortionCapacity]   = useState(item.portionCapacity?.toString() ?? "");
  const [saveState, setSaveState]               = useState<SaveState>("idle");
  const [confirmDelete, setConfirmDelete]       = useState(false);

  const isSetMeal = !!item.contents?.length;

  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      await onSave(item.id, {
        primaryStation:    primaryStation    || null,
        primaryCookTime:   parsePosInt(primaryCookTime),
        secondaryStation:  secondaryStation  || null,
        secondaryCookTime: parsePosInt(secondaryCookTime),
        portionCapacity:   parsePosInt(portionCapacity),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  }, [item.id, primaryStation, primaryCookTime, secondaryStation, secondaryCookTime, portionCapacity, onSave]);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaveState("saving");
    try {
      await onDelete(item.id);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
      setConfirmDelete(false);
    }
  };

  const totalSecs =
    (parsePosInt(primaryCookTime) ?? 0) + (parsePosInt(secondaryCookTime) ?? 0);

  const selectCls =
    "bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors";
  const timeInputCls =
    "w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white tabular-nums text-right focus:outline-none focus:border-sky-500 transition-colors";

  return (
    <div
      className={`px-4 py-3 border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors ${confirmDelete ? "bg-red-950/20" : ""}`}
      onMouseLeave={() => setConfirmDelete(false)}
    >
      <div className="flex items-center gap-3">
        {/* Name */}
        <div className="w-44 shrink-0">
          <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-wider">{item.id}</div>
          <div className="text-sm font-medium text-white truncate">{item.name.en}</div>
          {item.name.zh && <div className="text-xs text-amber-400/60 truncate">{item.name.zh}</div>}
          {isSetMeal && (
            <div className="text-[10px] text-purple-400/70 mt-0.5">set meal</div>
          )}
        </div>

        {/* Primary station + time */}
        <div className="flex items-center gap-1.5 shrink-0">
          <select value={primaryStation} onChange={(e) => setPrimaryStation(e.target.value)} onBlur={save} className={selectCls} style={{ width: "9rem" }}>
            <option value="">— none —</option>
            {STATION_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="number" min={0} placeholder="sec" value={primaryCookTime}
            onChange={(e) => setPrimaryCookTime(e.target.value)} onBlur={save}
            className={timeInputCls} />
          <span className="text-xs text-zinc-600 w-10 shrink-0">{fmtSecs(parsePosInt(primaryCookTime) ?? 0)}</span>
        </div>

        {/* Arrow between stations */}
        <span className="text-zinc-700 text-sm shrink-0">→</span>

        {/* Secondary station + time */}
        <div className="flex items-center gap-1.5 shrink-0">
          <select value={secondaryStation} onChange={(e) => setSecondaryStation(e.target.value)} onBlur={save} className={selectCls} style={{ width: "9rem" }}>
            <option value="">— none —</option>
            {STATION_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="number" min={0} placeholder="sec" value={secondaryCookTime}
            onChange={(e) => setSecondaryCookTime(e.target.value)} onBlur={save}
            className={timeInputCls} />
          <span className="text-xs text-zinc-600 w-10 shrink-0">{fmtSecs(parsePosInt(secondaryCookTime) ?? 0)}</span>
        </div>

        {/* Total */}
        <div className="text-xs text-zinc-500 w-16 text-right shrink-0">
          {totalSecs > 0 && (
            <span className="text-white font-semibold">{fmtSecs(totalSecs)}</span>
          )}
          {totalSecs > 0 && <div className="text-zinc-600">total</div>}
        </div>

        {/* Portions per run */}
        <input type="number" min={1} placeholder="—" value={portionCapacity}
          onChange={(e) => setPortionCapacity(e.target.value)} onBlur={save}
          className={`${timeInputCls} w-12`} title="Portions per run" />

        {/* Status + delete */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {saveState === "saving" && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
          {saveState === "saved"  && <Check className="w-4 h-4 text-emerald-400" />}
          {saveState === "error"  && <AlertCircle className="w-4 h-4 text-red-400" />}

          <button
            onClick={handleDelete}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
              confirmDelete
                ? "bg-red-600 text-white hover:bg-red-500"
                : "text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmDelete && "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

export function MenuEditorTab() {
  const [items, setItems]           = useState<RawMenuItem[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    apiClient
      .fetchMenu()
      .then((data) => setItems(data as RawMenuItem[]))
      .catch(() => setFetchError("Could not load menu. Is the server running?"))
      .finally(() => setIsLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(items.map((i) => i.primaryCategory).filter((c): c is string => Boolean(c)));
    return ["All", ...Array.from(cats).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => {
      const matchSearch =
        !q ||
        i.name.en.toLowerCase().includes(q) ||
        (i.name.zh ?? "").toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q);
      const matchCat = category === "All" || i.primaryCategory === category;
      return matchSearch && matchCat;
    });
  }, [items, search, category]);

  const handleSave = useCallback(async (id: string, updates: MenuItemUpdates) => {
    await apiClient.updateMenuItem(id, updates);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const patch: Partial<RawMenuItem> = {};
        if (updates.primaryStation !== undefined)   patch.primaryStation   = updates.primaryStation   ?? undefined;
        if (updates.primaryCookTime !== undefined)  patch.primaryCookTime  = updates.primaryCookTime  ?? undefined;
        if (updates.secondaryStation !== undefined) patch.secondaryStation = updates.secondaryStation ?? undefined;
        if (updates.secondaryCookTime !== undefined) patch.secondaryCookTime = updates.secondaryCookTime ?? undefined;
        if (updates.portionCapacity !== undefined)  patch.portionCapacity  = updates.portionCapacity  ?? undefined;
        return { ...item, ...patch };
      }),
    );
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await apiClient.deleteMenuItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleAdd = useCallback((newItem: RawMenuItem) => {
    setItems((prev) => [...prev, newItem]);
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading menu…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400 gap-2">
        <AlertCircle className="w-5 h-5" /> {fetchError}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-zinc-600 shrink-0">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
        <button
          onClick={() => setShowAddModal(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add item
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 shrink-0 text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">
        <div className="w-44 shrink-0">Item</div>
        <div className="w-56 shrink-0">Primary station → time</div>
        <div className="w-4 shrink-0" />
        <div className="w-56 shrink-0">2nd station → time</div>
        <div className="w-16 text-right shrink-0">Total</div>
        <div className="w-12 text-right shrink-0" title="Portions per run">P/run</div>
      </div>

      {/* Hint for set meals */}
      <div className="px-4 py-1.5 bg-purple-500/5 border-b border-purple-500/10 shrink-0">
        <p className="text-[10px] text-purple-400/60">
          Set meals <span className="text-zinc-600">—</span> assign the main bottleneck station and total expected time (e.g. ribs = 8 min). Child items inside the set can't be timed individually.
        </p>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">No items match</div>
        ) : (
          filtered.map((item) => (
            <MenuItemRow key={item.id} item={item} onSave={handleSave} onDelete={handleDelete} />
          ))
        )}
      </div>

      {showAddModal && (
        <AddItemModal
          categories={categories}
          onAdd={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
