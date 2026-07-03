import React from "react";
import ReactDOM from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
} from "@tanstack/react-query";
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
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
