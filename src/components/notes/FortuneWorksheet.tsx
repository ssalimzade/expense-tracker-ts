import { useCallback, useEffect, useRef, useState } from "react";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import "./worksheet.css";
import type { Sheet } from "@fortune-sheet/core";
import { useQueryClient } from "@tanstack/react-query";
import { useWorksheet, useSaveWorksheet } from "../../hooks/useWorksheet";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useIsMobile } from "../../hooks/useIsMobile";
import { isLegacyMatrix, toSheets } from "./worksheetMigration";

// Fields Fortune-sheet mutates on selection / scroll / view changes — excluded
// from the fingerprint so a cursor move isn't mistaken for an edit.
const VOLATILE_KEYS = new Set([
  "luckysheet_select_save",
  "luckysheet_selection_range",
  "luckysheet_scroll_status",
  "scrollLeft",
  "scrollTop",
  "status",
  "zoomRatio",
  "calcChain",
  "filter_select",
]);

// A content fingerprint of the sheets. We stringify the *whole* sheet minus the
// volatile view fields above — rather than cherry-picking `data`, because a cell
// edit may land in `data` OR `celldata` and Fortune-sheet keeps both. Anything
// that actually changes the content changes this; a cursor move does not.
function contentSig(sheets: Sheet[]): string {
  try {
    return JSON.stringify(sheets ?? [], (k, v) => (VOLATILE_KEYS.has(k) ? undefined : v));
  } catch {
    return String(Math.random());
  }
}

// Does the payload actually hold any content? Used to refuse saving an empty
// sheet — Fortune-sheet can briefly emit a blank sheet while (re)initialising on
// remount, and saving that would wipe real data on the server.
function hasContent(sheets: Sheet[]): boolean {
  return (sheets ?? []).some((s) => {
    if (Array.isArray(s.celldata) && s.celldata.length > 0) return true;
    if (Array.isArray(s.data) && s.data.some((row) => Array.isArray(row) && row.some((c) => c != null)))
      return true;
    const cfg = s.config ?? {};
    return (
      Object.keys(cfg.merge ?? {}).length > 0 ||
      Object.keys(cfg.columnlen ?? {}).length > 0 ||
      Object.keys(cfg.rowlen ?? {}).length > 0
    );
  });
}

export default function FortuneWorksheet() {
  const dark = useDarkMode();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const wsQuery = useWorksheet();
  const save = useSaveWorksheet();

  // Fortune-sheet reads `data` once per mount and owns state thereafter, so we
  // seed it and force a remount (via `seedKey`) whenever we need to reload.
  const [initial, setInitial] = useState<Sheet[] | null>(null);
  const [seedKey, setSeedKey] = useState(0);
  const wbRef = useRef<WorkbookInstance>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const needsRecalc = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pending = useRef<Sheet[] | null>(null);
  // Fingerprint of the content currently in sync with the server. Saves and
  // reseeds are gated on this: we skip echoes/cursor moves (same fingerprint,
  // so no clobber), save real edits, and reseed only when the server's content
  // genuinely differs and there are no unsaved local edits to protect.
  const syncedSig = useRef<string | null>(null);

  // Seed on first load; reseed when the server has genuinely newer content and
  // there are no unsaved local edits to protect.
  useEffect(() => {
    if (!wsQuery.data) return;
    const raw = wsQuery.data.data;
    const sheets = toSheets(raw);
    const sig = contentSig(sheets);

    if (initial === null) {
      needsRecalc.current = isLegacyMatrix(raw);
      syncedSig.current = sig;
      setInitial(sheets);
      return;
    }
    if (sig !== syncedSig.current && pending.current == null) {
      needsRecalc.current = isLegacyMatrix(raw);
      syncedSig.current = sig;
      setInitial(sheets);
      setSeedKey((k) => k + 1);
    }
  }, [wsQuery.data, initial]);

  // One-time recompute of migrated formulas, after each (re)mount.
  useEffect(() => {
    if (!initial || !needsRecalc.current) return;
    needsRecalc.current = false;
    const t = setTimeout(() => wbRef.current?.calculateFormula(), 300);
    return () => clearTimeout(t);
  }, [initial, seedKey]);

  // Persist the latest sheets. Held in a ref and behind `flushRef` so an unmount
  // (e.g. switching tabs) pushes a pending save instead of dropping it.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (pending.current == null) return;
    const data = pending.current;
    pending.current = null;
    save.mutate({ data });
  };

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      flushRef.current();
    },
    [],
  );

  // A hard refresh / tab close / app switch doesn't run React cleanup, so a
  // still-debounced edit would be lost. Flush it with a `keepalive` request that
  // survives the page going away.
  useEffect(() => {
    const flushBeacon = () => {
      if (pending.current == null) return;
      const body = JSON.stringify({ data: pending.current });
      pending.current = null;
      clearTimeout(timer.current);
      try {
        fetch("/api/worksheet", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      } catch {
        /* best effort on unload */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushBeacon();
    };
    window.addEventListener("pagehide", flushBeacon);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushBeacon);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const handleChange = useCallback(
    (sheets: Sheet[]) => {
      const sig = contentSig(sheets);
      // Same fingerprint → a mount echo, cursor move or scroll, not a content
      // change. Skip: this both avoids needless writes and (crucially) stops an
      // idle device from re-saving stale data over another device's edits.
      if (sig === syncedSig.current) return;

      // Never persist an empty sheet. On remount Fortune-sheet can briefly emit a
      // blank sheet before the seeded data loads; saving that would wipe real
      // content on the server. Leave the fingerprint on the real content so the
      // following real echo/edit is still recognised. (A genuine "clear
      // everything" won't auto-save — an acceptable price for not losing data.)
      if (!hasContent(sheets)) return;

      // A real edit. Record it, mirror to the cache (so a same-device tab switch
      // reseeds from the current sheet), and debounce the save.
      syncedSig.current = sig;
      qc.setQueryData(["worksheet"], { data: sheets });
      pending.current = sheets;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => flushRef.current(), 600);
    },
    [qc],
  );

  // Touch panning. Fortune-sheet's own touch-scroll (core `handleOverlayTouchMove`)
  // subtracts the *cumulative* finger delta from the *live* scroll each frame, so
  // it compounds and flings the grid across the sheet from a single drag. We take
  // over: block its handler on grid touch-moves and drive the scrollbars 1:1.
  // Taps (touchstart/end without move) still fall through, so cell selection and
  // double-tap-to-edit keep working.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let sbx: HTMLElement | null = null;
    let sby: HTMLElement | null = null;
    let active = false;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t) {
        active = false;
        return;
      }
      const target = t.target as HTMLElement | null;
      if (!target?.closest(".fortune-sheet-overlay")) {
        active = false; // touch began on toolbar / formula bar / sheet tabs
        return;
      }
      sbx = root.querySelector<HTMLElement>(".luckysheet-scrollbar-x");
      sby = root.querySelector<HTMLElement>(".luckysheet-scrollbar-y");
      startX = t.pageX;
      startY = t.pageY;
      startLeft = sbx?.scrollLeft ?? 0;
      startTop = sby?.scrollTop ?? 0;
      active = true;
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!active || e.touches.length !== 1 || !t) return;
      e.stopPropagation(); // keep Fortune-sheet's buggy pan from also running
      if (e.cancelable) e.preventDefault(); // and don't scroll the page instead
      if (sbx) sbx.scrollLeft = startLeft - (t.pageX - startX);
      if (sby) sby.scrollTop = startTop - (t.pageY - startY);
    };

    const onEnd = () => {
      active = false;
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd, { passive: true });
    root.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Worksheet
        </h2>
        {save.isPending && <span className="text-xs text-gray-400">Saving…</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div
          ref={containerRef}
          className={`ws-workbook h-full w-full ${dark ? "ws-dark" : "bg-white"} ${
            isMobile ? "ws-mobile" : ""
          }`}
        >
          {initial ? (
            <Workbook
              key={seedKey}
              ref={wbRef}
              data={initial}
              onChange={handleChange}
              lang="en"
              // Taller rows are easier to tap on a phone; desktop keeps the default.
              {...(isMobile ? { defaultRowHeight: 26 } : {})}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Loading worksheet…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
