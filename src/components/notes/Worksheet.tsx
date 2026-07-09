import { Suspense, lazy } from "react";

// Fortune-sheet (+ its formula engine, lodash, dayjs…) is ~600 KB gzipped, so it
// lives in its own chunk that only downloads when the Notes tab is opened.
const FortuneWorksheet = lazy(() => import("./FortuneWorksheet"));

export default function Worksheet() {
  return (
    <div className="h-full">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Loading worksheet…
          </div>
        }
      >
        <FortuneWorksheet />
      </Suspense>
    </div>
  );
}
