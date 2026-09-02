import "server-only";
import { createCallerFactory, createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { headers } from "next/headers";
import { cache } from "react";

const createCaller = createCallerFactory(appRouter);

export const createServerCaller = cache(async (tenantSlug?: string) => {
  const h = await headers();
  return createCaller(await createTRPCContext({ headers: h, tenantSlug }));
});
