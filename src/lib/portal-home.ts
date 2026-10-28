export interface PortalHomeInput {
  now: Date;
  horses: { id: string; name: string }[];
  incidents: {
    id: string;
    horseId: string;
    category: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    occurredAt: Date;
    acknowledgedByMe: boolean;
  }[];
  invoices: {
    id: string;
    number: string | null;
    status: string;
    dueDate: Date | null;
    pending: number;
  }[];
  health: {
    id: string;
    type: string;
    name: string;
    date: Date;
    nextDueDate: Date | null;
    horse: { id: string; name: string };
  }[];
}

export function portalHome(_input: PortalHomeInput): {
  audience: "OWNER" | "STUDENT";
  emptyState: "STUDENT_NO_HORSE" | "OWNER_ALL_CLEAR" | null;
  items: { kind: "INCIDENT" | "INVOICE_OVERDUE" | "HEALTH_DUE"; id: string }[];
  pendingInvoices: { id: string }[];
  lastFarrier: { horseId: string; horseName: string; date: Date | null }[];
} {
  throw new Error("no implementado");
}
