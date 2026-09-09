import { createTRPCRouter } from "./init";
import { horsesRouter } from "./routers/horses";
import { healthRouter } from "./routers/health";
import { tasksRouter } from "./routers/tasks";
import { invoicesRouter } from "./routers/invoices";
import { reproductionRouter } from "./routers/reproduction";
import { movementsRouter } from "./routers/movements";
import { boardingRouter } from "./routers/boarding";
import { trainingRouter } from "./routers/training";
import { contactsRouter } from "./routers/contacts";
import { feedingRouter } from "./routers/feeding";
import { tenantRouter } from "./routers/tenant";
import { journalRouter } from "./routers/journal";
import { performanceRouter } from "./routers/performance";
import { nutritionRouter } from "./routers/nutrition";
import { membersRouter } from "./routers/members";
import { portalRouter } from "./routers/portal";

export const appRouter = createTRPCRouter({
  horses: horsesRouter,
  health: healthRouter,
  tasks: tasksRouter,
  invoices: invoicesRouter,
  reproduction: reproductionRouter,
  movements: movementsRouter,
  boarding: boardingRouter,
  training: trainingRouter,
  contacts: contactsRouter,
  feeding: feedingRouter,
  tenant: tenantRouter,
  journal: journalRouter,
  performance: performanceRouter,
  nutrition: nutritionRouter,
  members: membersRouter,
  portal: portalRouter,
});

export type AppRouter = typeof appRouter;
