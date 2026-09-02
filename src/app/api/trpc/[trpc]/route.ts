import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/trpc/router";
import { createTRPCContext } from "@/server/trpc/init";

function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        headers: req.headers,
        tenantSlug: req.headers.get("x-tenant-slug") ?? undefined,
      }),
    onError({ path, error }) {
      if (process.env.NODE_ENV === "development") {
        console.error(`tRPC error on ${path}:`, error);
      }
    },
  });
}

export { handler as GET, handler as POST };
