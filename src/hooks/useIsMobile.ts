import { useEffect, useState } from "react";

/**
 * True on phone-sized screens (< 768px, matching the `md` breakpoint where the
 * mobile bottom nav shows). For JS-driven components like recharts that can't use
 * Tailwind's responsive classes. Desktop rendering is unaffected.
 */
export function useIsMobile(query = "(max-width: 767px)"): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return isMobile;
}
