import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../components/Toast";
import { DialogHost } from "../components/ui/Dialog";

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/// Wraps children in QueryClient + ToastProvider + DialogHost.
/// Use for components that call useToast(), useDialog(), or hooks that touch
/// React Query (e.g. useFilterContext, useLibrary).
export function WithProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={newClient()}>
      <ToastProvider>
        <DialogHost>{children}</DialogHost>
      </ToastProvider>
    </QueryClientProvider>
  );
}
