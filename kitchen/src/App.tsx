import { useEffect, useState } from "react";
import type { MenuItem } from "./types/kitchen";
import { KitchenBoard } from "./components/KitchenBoard";
import { API_URL } from "./config";

/**
 * Fetches the menu from the server. Falls back to an empty array so the
 * kitchen screen still works without cook time data (uses 8-min default).
 */
function useMenu(): MenuItem[] {
  const [menu, setMenu] = useState<MenuItem[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/menu`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MenuItem[]>;
      })
      .then(setMenu)
      .catch(() => {
        // /api/menu not yet implemented — that's fine for Phase 1
        // Cook times will use the 480s default until the endpoint exists
      });
  }, []);

  return menu;
}

export default function App() {
  const menu = useMenu();

  return (
    <div className="h-screen bg-[#303338] text-white flex flex-col overflow-hidden font-sans">
      <KitchenBoard menu={menu} />
    </div>
  );
}
