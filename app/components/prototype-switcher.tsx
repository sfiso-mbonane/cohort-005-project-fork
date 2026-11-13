// PROTOTYPE — throwaway. Floating variant switcher; hidden in production builds.
import { useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PrototypeSwitcher({ variants }: { variants: Record<string, string> }) {
  const keys = Object.keys(variants);
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const current = params.get("variant") ?? keys[0];
  const index = Math.max(0, keys.indexOf(current));

  function go(delta: number) {
    const next = keys[(index + delta + keys.length) % keys.length];
    const p = new URLSearchParams(location.search);
    p.set("variant", next);
    // Variant B owns /notifications; leave it when switching away.
    const path = location.pathname === "/notifications" && next !== "B" ? "/courses" : location.pathname;
    navigate(`${path}?${p}`, { replace: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-fuchsia-700 px-2 py-1 text-sm text-white shadow-lg">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-56 text-center font-medium">
        {current} ({variants[current]})
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
