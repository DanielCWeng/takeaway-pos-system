import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  Search,
  Trash2,
  Printer,
  Hash,
  Clock,
  User,
  PoundSterling,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  ShieldCheck,
  ShieldAlert,
  Database,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { config } from "../../config";
import { cn } from "../../lib/utils";
import { formatCurrency } from "../../lib/format";
import type { ArchivedOrder } from "../../types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { MenuEditorTab } from "./menu-editor-tab";

interface AdminPageProps {
  onClose: () => void;
}

type ReprintStatus = "idle" | "success" | "error";

type ApiLikeError = Error & {
  code?: string;
  status?: number;
};

function getAdminApiErrorMessage(err: unknown, fallback: string) {
  const apiErr = err as ApiLikeError;
  const code = apiErr?.code;
  const status = apiErr?.status;

  if (code === "RATE_LIMITED" || status === 429) {
    return "Too many failed admin token attempts. Wait a minute, then try again.";
  }

  if (code === "ADMIN_AUTH_NOT_CONFIGURED" || status === 503) {
    return "Server admin auth is not configured. Set ADMIN_API_TOKEN on the server and restart.";
  }

  if (code === "FORBIDDEN" || status === 403) {
    return "Admin token was rejected. Ensure client token matches server ADMIN_API_TOKEN.";
  }

  if (code === "NETWORK_ERROR") {
    return "Could not reach the server. Check that the backend is running.";
  }

  return fallback;
}

function isAnonymisedCustomerRecord(phone?: string, name?: string, isAnonymised?: boolean) {
  return isAnonymised === true || name === "ANONYMISED" || phone?.startsWith("ANON-") === true;
}

const ORDER_TYPE_BADGE_CLS: Record<string, string> = {
  delivery: "text-amber-400 bg-amber-400/5 border-amber-400/20",
  collection: "text-emerald-400 bg-emerald-400/5 border-emerald-400/20",
};

const ORDER_TYPE_BADGE_SOLID: Record<string, string> = {
  delivery: "bg-amber-500 text-black",
  collection: "bg-emerald-500 text-black",
};

export function AdminPage({ onClose }: AdminPageProps) {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "menu">("orders");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // ─── Data ────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [orders, setOrders] = useState<ArchivedOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ArchivedOrder | null>(null);

  // ─── Action states ───────────────────────────────────────────────────────
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPendingDeleteConfirm, setIsPendingDeleteConfirm] = useState(false);
  const [reprintStatus, setReprintStatus] = useState<ReprintStatus>("idle");
  const [gdprStatus, setGdprStatus] = useState<{
    type: "idle" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  const [deleteCustomerDialog, setDeleteCustomerDialog] = useState<{
    open: boolean;
    phone: string;
  }>({ open: false, phone: "" });
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const reprintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gdprTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadOrders() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const data = await apiClient.fetchOrders(selectedDate);
        setOrders(data.orders);
      } catch (err) {
        console.error("Failed to fetch orders", err);
        setFetchError(
          getAdminApiErrorMessage(
            err,
            "Could not load orders for this date. Check your connection.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadOrders();
  }, [isAuthenticated, selectedDate]);

  // Clear pending-delete state when date changes
  useEffect(() => {
    setIsPendingDeleteConfirm(false);
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedOrder) {
      setDeleteCustomerDialog({ open: false, phone: "" });
      setIsDeletingCustomer(false);
    }
  }, [selectedOrder]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (reprintTimerRef.current) clearTimeout(reprintTimerRef.current);
      if (gdprTimerRef.current) clearTimeout(gdprTimerRef.current);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return orders.filter((o) => {
      const idStr = o.id.toString();
      const customerName = o.data.customerInfo?.name?.toLowerCase() || "";
      const phone = o.data.customerInfo?.phone || "";
      return idStr.includes(query) || customerName.includes(query) || phone.includes(query);
    });
  }, [orders, searchQuery]);

  // Daily total always reflects the full day, not the current search filter
  const dailyTotal = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.data.total, 0);
  }, [orders]);

  // ─── Auth handlers ───────────────────────────────────────────────────────
  const handleNumpadPress = (key: string) => {
    setLoginError("");
    if (key === "back") {
      setPassword((prev) => prev.slice(0, -1));
    } else if (password.length < 8) {
      setPassword((prev) => prev + key);
    }
  };

  const handleLogin = () => {
    if (config.adminTokenMismatch) {
      setLoginError("Set only VITE_ADMIN_API_TOKEN (or make both keys identical)");
      setPassword("");
      return;
    }

    if (!config.adminApiToken) {
      setLoginError("Admin token not configured (VITE_ADMIN_API_TOKEN)");
      setPassword("");
      return;
    }
    if (password === config.adminApiToken) {
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Incorrect password");
      setPassword("");
    }
  };

  // ─── Data handlers ───────────────────────────────────────────────────────
  const handleDeleteDay = async () => {
    setIsDeleting(true);
    setIsPendingDeleteConfirm(false);
    try {
      await apiClient.deleteOrdersByDate(selectedDate);
      setOrders([]);
    } catch (err) {
      console.error("Failed to delete orders", err);
      setFetchError(getAdminApiErrorMessage(err, "Failed to delete orders. Please try again."));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReprint = async (id: number) => {
    setReprintStatus("idle");
    try {
      const res = await apiClient.reprintOrder(id);
      setReprintStatus(res.printed ? "success" : "error");
    } catch (err) {
      console.error("Reprint error", err);
      setReprintStatus("error");
    } finally {
      if (reprintTimerRef.current) clearTimeout(reprintTimerRef.current);
      reprintTimerRef.current = setTimeout(() => setReprintStatus("idle"), 3000);
    }
  };

  const handleExportData = async (phone: string) => {
    if (isAnonymisedCustomerRecord(phone)) {
      setGdprStatus({
        type: "error",
        message: "Record is already anonymised and can no longer be exported.",
      });
      if (gdprTimerRef.current) clearTimeout(gdprTimerRef.current);
      gdprTimerRef.current = setTimeout(() => setGdprStatus({ type: "idle" }), 3000);
      return;
    }

    setGdprStatus({ type: "idle" });
    try {
      const data = await apiClient.exportCustomer(phone);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data-export-${phone}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setGdprStatus({ type: "success", message: "Data exported successfully." });
    } catch (err) {
      console.error("Export error", err);
      setGdprStatus({ type: "error", message: getAdminApiErrorMessage(err, "Export failed.") });
    } finally {
      if (gdprTimerRef.current) clearTimeout(gdprTimerRef.current);
      gdprTimerRef.current = setTimeout(() => setGdprStatus({ type: "idle" }), 3000);
    }
  };

  const promptDeleteCustomer = (phone: string) => {
    if (!phone || isAnonymisedCustomerRecord(phone)) {
      setGdprStatus({
        type: "error",
        message: "Record is already anonymised and cannot be deleted again.",
      });
      if (gdprTimerRef.current) clearTimeout(gdprTimerRef.current);
      gdprTimerRef.current = setTimeout(() => setGdprStatus({ type: "idle" }), 3000);
      return;
    }

    setDeleteCustomerDialog({ open: true, phone });
  };

  const handleDeleteCustomer = async () => {
    if (!deleteCustomerDialog.phone) return;

    setIsDeletingCustomer(true);
    setGdprStatus({ type: "idle" });
    try {
      const phone = deleteCustomerDialog.phone;
      const res = await apiClient.deleteCustomer(phone);
      setGdprStatus({
        type: "success",
        message: `Customer erased. ${res.ordersAnonymized} orders anonymized.`,
      });
      // Refresh current day to show "DELETED"
      const data = await apiClient.fetchOrders(selectedDate);
      setOrders(data.orders);
      if (selectedOrder?.data.customerInfo?.phone === phone) {
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error("Delete customer error", err);
      setGdprStatus({ type: "error", message: getAdminApiErrorMessage(err, "Deletion failed.") });
    } finally {
      setDeleteCustomerDialog({ open: false, phone: "" });
      setIsDeletingCustomer(false);
      if (gdprTimerRef.current) clearTimeout(gdprTimerRef.current);
      gdprTimerRef.current = setTimeout(() => setGdprStatus({ type: "idle" }), 3000);
    }
  };

  const handleCleanupRetention = async () => {
    if (
      !window.confirm(
        "Trigger retention cleanup? This permanently deletes records older than the configured retention policy.",
      )
    )
      return;

    setIsLoading(true);
    try {
      const res = await apiClient.cleanupOrders();
      alert(`Cleanup complete: ${res.deletedCount} old records removed.`);
      const data = await apiClient.fetchOrders(selectedDate);
      setOrders(data.orders);
    } catch (err) {
      console.error("Cleanup error", err);
      alert(getAdminApiErrorMessage(err, "Cleanup failed."));
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Login Screen ────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md"
      >
        <Card className="w-full max-w-[280px] border-zinc-800 bg-zinc-950 shadow-2xl">
          <CardHeader className="pb-2 pt-6">
            <CardTitle className="text-lg font-bold text-white text-center tracking-tight">
              Admin Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pb-6">
            {/* PIN Display */}
            <div className="relative">
              <div className="flex items-center justify-center gap-2 h-12 bg-zinc-900 rounded-xl border border-zinc-800">
                {password.length === 0 ? (
                  <span className="text-zinc-700 text-sm font-medium">Enter PIN</span>
                ) : (
                  Array.from({ length: password.length }).map((_, i) => (
                    <div key={i} className="w-3 h-3 bg-sky-400 rounded-full" />
                  ))
                )}
              </div>
              {loginError && (
                <p className="absolute -bottom-5 w-full text-center text-[10px] uppercase font-black text-red-500 tracking-wider">
                  {loginError}
                </p>
              )}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleNumpadPress(n.toString())}
                  className="h-14 rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-bold text-white hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 transition-all select-none"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={onClose}
                className="h-14 rounded-xl text-sm font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-all select-none"
              >
                ESC
              </button>
              <button
                type="button"
                onClick={() => handleNumpadPress("0")}
                className="h-14 rounded-xl bg-zinc-900 border border-zinc-800 text-xl font-bold text-white hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 transition-all select-none"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleNumpadPress("back")}
                className="h-14 rounded-xl bg-zinc-900 border border-zinc-800 text-lg font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white active:scale-95 transition-all select-none"
              >
                ←
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogin}
              className="w-full h-12 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-black text-base tracking-widest transition-all active:scale-[0.98] select-none"
            >
              UNLOCK
            </button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ─── Main Admin UI ────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-white overflow-hidden p-4"
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent italic">
            Admin Dashboard
          </h1>
        </div>
        <Button
          variant="ghost"
          onClick={onClose}
          className="h-10 w-10 p-0 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-6 w-6" />
        </Button>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-zinc-800 shrink-0">
        {(["orders", "menu"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2 text-sm font-semibold tracking-wide uppercase transition-colors border-b-2 -mb-px",
              activeTab === tab
                ? "text-white border-sky-500"
                : "text-zinc-500 border-transparent hover:text-zinc-300",
            )}
          >
            {tab === "orders" ? "Orders" : "Menu Editor"}
          </button>
        ))}
      </div>

      {/* Menu editor tab — rendered outside the orders layout */}
      {activeTab === "menu" && <MenuEditorTab />}

      {/* Orders tab content */}
      {activeTab === "orders" && <>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-900 border-zinc-800 shadow-lg shadow-black/40">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-sky-500/10 rounded-xl">
              <Calendar className="h-6 w-6 text-sky-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-zinc-500 uppercase font-semibold">Report Date</p>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-lg font-bold outline-none w-full [color-scheme:dark]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 shadow-lg shadow-black/40">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-zinc-800 rounded-xl">
              <Search className="h-6 w-6 text-zinc-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-zinc-500 uppercase font-semibold">Search Filter</p>
              <input
                type="text"
                placeholder="ID, Name, Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-lg font-bold outline-none w-full placeholder:text-zinc-700 font-mono"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-sky-600 border-transparent shadow-lg shadow-sky-900/30 overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 bg-white/20 rounded-xl">
                <PoundSterling className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase font-semibold tracking-wider">
                  Daily Total
                </p>
                <p className="text-3xl font-black italic tracking-tighter">
                  {formatCurrency(dailyTotal)}
                </p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isPendingDeleteConfirm ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  className="flex flex-col gap-2 items-end"
                >
                  <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest text-right">
                    Delete {orders.length} orders?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isDeleting}
                      onClick={() => setIsPendingDeleteConfirm(false)}
                      className="h-8 px-3 text-xs font-bold text-white/60 hover:text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={isDeleting}
                      onClick={handleDeleteDay}
                      className="h-8 px-3 text-xs font-bold bg-red-600 hover:bg-red-500 text-white border-transparent"
                    >
                      {isDeleting ? "Deleting…" : "Confirm"}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="delete-btn"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={orders.length === 0 || isDeleting}
                    onClick={() => setIsPendingDeleteConfirm(true)}
                    className="bg-red-500 hover:bg-red-600 text-white border-transparent h-10 px-4 font-bold shadow-lg"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Day
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Maintenance / GDPR Cleanup */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-lg shadow-black/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <Database className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase font-semibold">Retention</p>
                <p className="text-sm font-bold text-zinc-300">Policy Cleanup</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanupRetention}
              className="border-zinc-700 hover:bg-red-500/10 hover:text-red-400 font-bold"
            >
              Run Purge
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 shadow-2xl overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader className="bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-800">
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-24 text-zinc-400 font-bold uppercase text-[10px] tracking-widest pl-6">
                  <Hash className="h-3 w-3 inline mr-1" /> ID
                </TableHead>
                <TableHead className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">
                  <Clock className="h-3 w-3 inline mr-1" /> Time
                </TableHead>
                <TableHead className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">
                  Type
                </TableHead>
                <TableHead className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">
                  <User className="h-3 w-3 inline mr-1" /> Customer
                </TableHead>
                <TableHead className="hidden lg:table-cell text-zinc-400 font-bold uppercase text-[10px] tracking-widest">
                  Details
                </TableHead>
                <TableHead className="text-right text-zinc-400 font-bold uppercase text-[10px] tracking-widest pr-6">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-zinc-500 font-medium italic">
                        Synchronising with archive...
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : fetchError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <AlertTriangle className="h-8 w-8 text-red-500/60" />
                      <p className="text-red-400 font-bold italic text-sm max-w-xs">{fetchError}</p>
                      <button
                        type="button"
                        onClick={() => setSelectedDate((d) => d)}
                        className="text-xs text-sky-400 underline font-semibold hover:text-sky-300 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <p className="text-zinc-500 font-bold italic text-lg opacity-30 uppercase tracking-tighter">
                      No History Found
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="border-zinc-800/30 hover:bg-zinc-800/40 cursor-pointer transition-all group"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <TableCell className="font-mono font-black text-sky-400 italic text-base pl-6">
                      #{order.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      {new Date(order.archivedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 border-zinc-700 text-[9px] font-black uppercase tracking-tighter",
                          ORDER_TYPE_BADGE_CLS[order.data.orderType] ??
                            "text-zinc-400 bg-zinc-400/5 border-zinc-400/20",
                        )}
                      >
                        {order.data.orderType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-zinc-200 block">
                        {order.data.customerInfo?.name || "Anonymous Guest"}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono uppercase">
                        {order.data.customerInfo?.phone || "Private Caller"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-xs overflow-hidden text-ellipsis whitespace-nowrap text-zinc-400 text-[11px] italic font-medium">
                      {(order.data.items || []).map((i) => i.name).join(", ")}
                    </TableCell>
                    <TableCell className="text-right font-mono font-black text-xl pr-6 group-hover:text-white transition-colors">
                      {formatCurrency(order.data.total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Order Details Modal Overlay */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-zinc-800 flex justify-between items-start bg-zinc-900/30">
                <div>
                  <h3 className="text-3xl font-black italic tracking-tighter text-white">
                    Order Receipt <span className="text-sky-400">#{selectedOrder.id}</span>
                  </h3>
                  <div className="flex gap-4 mt-1">
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{" "}
                      {new Date(selectedOrder.archivedAt).toLocaleDateString()}
                    </p>
                    <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest flex items-center gap-1">
                      <Clock className="h-3 w-3" />{" "}
                      {new Date(selectedOrder.archivedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOrder(null)}
                  className="h-10 w-10 p-0 rounded-2xl hover:bg-zinc-800"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              <ScrollArea className="flex-1 p-8">
                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-black text-zinc-600 tracking-[0.2em]">
                        Service Type
                      </p>
                      <Badge
                        className={cn(
                          "rounded-md px-3 font-black italic",
                          ORDER_TYPE_BADGE_SOLID[selectedOrder.data.orderType] ??
                            "bg-zinc-500 text-white",
                        )}
                      >
                        {selectedOrder.data.orderType.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-black text-zinc-600 tracking-[0.2em]">
                        Customer
                      </p>
                      <p className="font-bold text-lg text-white">
                        {selectedOrder.data.customerInfo?.name || "No Name"}
                      </p>
                    </div>
                    {selectedOrder.data.orderType === "delivery" && (
                      <div className="space-y-2 col-span-2">
                        <p className="text-[10px] uppercase font-black text-zinc-600 tracking-[0.2em]">
                          Delivery Address
                        </p>
                        <p className="text-sm font-bold text-zinc-400 leading-relaxed max-w-[80%]">
                          {selectedOrder.data.customerInfo?.houseNumber &&
                            `${selectedOrder.data.customerInfo.houseNumber} `}
                          {selectedOrder.data.customerInfo?.street &&
                            `${selectedOrder.data.customerInfo.street}`}
                          {selectedOrder.data.customerInfo?.postcode && (
                            <span className="block text-zinc-200 mt-1">
                              {selectedOrder.data.customerInfo.postcode}
                            </span>
                          )}
                          {!selectedOrder.data.customerInfo?.street && "No street address found."}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* GDPR Actions */}
                  <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <ShieldCheck className="h-4 w-4" />
                      <p className="text-[10px] uppercase font-black tracking-[0.2em]">
                        Data Privacy & compliance
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleExportData(selectedOrder.data.customerInfo?.phone || "")
                        }
                        disabled={
                          !selectedOrder.data.customerInfo?.phone ||
                          isAnonymisedCustomerRecord(
                            selectedOrder.data.customerInfo?.phone,
                            selectedOrder.data.customerInfo?.name,
                            selectedOrder.data.customerInfo?.isAnonymised,
                          )
                        }
                        className="h-12 border-zinc-800 bg-zinc-950 hover:bg-zinc-900 font-bold text-xs uppercase"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export History
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          promptDeleteCustomer(selectedOrder.data.customerInfo?.phone || "")
                        }
                        disabled={
                          !selectedOrder.data.customerInfo?.phone ||
                          isAnonymisedCustomerRecord(
                            selectedOrder.data.customerInfo?.phone,
                            selectedOrder.data.customerInfo?.name,
                            selectedOrder.data.customerInfo?.isAnonymised,
                          )
                        }
                        className="h-12 border-red-500/20 bg-zinc-950 hover:bg-red-500/10 hover:text-red-400 font-bold text-xs uppercase"
                      >
                        <ShieldAlert className="h-4 w-4 mr-2" />
                        Delete Customer
                      </Button>
                    </div>

                    <AnimatePresence>
                      {gdprStatus.type !== "idle" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-widest text-center",
                            gdprStatus.type === "success" ? "text-emerald-500" : "text-red-500",
                          )}
                        >
                          {gdprStatus.message}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] uppercase font-black text-zinc-600 tracking-[0.2em]">
                      Itemized Order
                    </p>
                    <div className="space-y-2">
                      {(selectedOrder.data.items || []).map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-sm bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-inner"
                        >
                          <div className="flex gap-4 items-center">
                            <span className="bg-sky-500 text-black h-7 w-7 flex items-center justify-center rounded-lg font-black text-sm shadow-sm">
                              {item.quantity}
                            </span>
                            <div>
                              <span className="font-bold text-white text-base block leading-tight">
                                {item.name}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-black text-lg">
                            {formatCurrency(item.price * (item.quantity || 1))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="p-8 bg-zinc-900/80 border-t border-zinc-800/5 backdrop-blur-md flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-black uppercase text-xs tracking-[0.3em]">
                    Grand Total
                  </span>
                  <span className="text-4xl font-black italic tracking-tighter text-sky-400 drop-shadow-lg">
                    {formatCurrency(selectedOrder.data.total)}
                  </span>
                </div>

                {/* Reprint feedback banner */}
                <AnimatePresence>
                  {reprintStatus !== "idle" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold",
                        reprintStatus === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20",
                      )}
                    >
                      {reprintStatus === "success" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      {reprintStatus === "success"
                        ? "Reprint sent to printer."
                        : "Print failed — check printer connection."}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-14 rounded-2xl border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold uppercase tracking-widest text-xs"
                    onClick={() => setSelectedOrder(null)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    className="flex-1 h-14 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black italic text-lg shadow-xl shadow-sky-600/20"
                    onClick={() => handleReprint(selectedOrder.id)}
                  >
                    <Printer className="h-5 w-5 mr-3" />
                    REPRINT
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteCustomerDialog.open && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() =>
                !isDeletingCustomer && setDeleteCustomerDialog({ open: false, phone: "" })
              }
              className="absolute inset-0 bg-zinc-950/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-red-500/10 p-2">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-black uppercase tracking-widest text-white">
                    Confirm Customer Deletion
                  </p>
                  <p className="text-sm text-zinc-300">
                    This will permanently delete the customer profile and anonymize all linked order
                    history.
                  </p>
                  <p className="text-xs font-mono text-zinc-500">{deleteCustomerDialog.phone}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-900"
                  disabled={isDeletingCustomer}
                  onClick={() => setDeleteCustomerDialog({ open: false, phone: "" })}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold"
                  disabled={isDeletingCustomer}
                  onClick={handleDeleteCustomer}
                >
                  {isDeletingCustomer ? "Deleting..." : "Delete Customer"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </>}
    </motion.div>
  );
}
