import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, MutationCache } from "@tanstack/react-query";
import { PersistQueryClientProvider, removeOldestQuery } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import App from "./App";
import { toast } from "./lib/toast";
import "./index.css";
import "react-datepicker/dist/react-datepicker.css";

// Mutations declare a `meta.success` message; we surface it on success and
// always surface a toast on error. This keeps individual hooks declarative.
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      success?: string;
      error?: string;
    };
  }
}

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => {
      const message = mutation.meta?.success;
      if (message) toast.success(message);
    },
    onError: (err, _vars, _ctx, mutation) => {
      const message =
        mutation.meta?.error ??
        (err instanceof Error ? err.message : "Something went wrong");
      toast.error(message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Kept long enough for the saved copy below to be restored on the next visit.
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

/**
 * The last data you saw is kept in this browser, so the app opens instantly on
 * the next visit and refreshes in the background instead of starting from a
 * spinner. Each deploy starts a fresh copy, and the worksheet (large) is left out.
 */
// The bundle's file name carries a content hash, so it changes with every deploy.
const buildId =
  document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? "dev";

const persister = createSyncStoragePersister({
  storage: (() => {
    try {
      return window.localStorage;
    } catch {
      return undefined; // Storage blocked: the app still works, just without the saved copy.
    }
  })(),
  key: "expense-tracker-cache",
  throttleTime: 2000,
  retry: removeOldestQuery,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: buildId,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === "success" && q.queryKey[0] !== "worksheet",
        },
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
