import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Offline-first: serve cached data instantly, refetch when back online.
        networkMode: "offlineFirst",
        staleTime: 60 * 1000,
        // Keep cache 30 days so it persists across sessions (persister rehydrates it).
        gcTime: 1000 * 60 * 60 * 24 * 30,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 2,
      },
      mutations: {
        // Queue mutations while offline; React Query resumes them automatically.
        networkMode: "offlineFirst",
        retry: 2,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
  });

  return router;
};
