"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StateBadge, type StateTone } from "@/components/ui/state-badge";
import { trpc } from "@/lib/trpc/react";

export interface IncidentListItem {
  id: string;
  horseName: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  description: string;
  occurredAt: Date;
  escalatedAt: Date | null;
  receipts: { acknowledgedAt: Date | null }[];
}

const STATUS_TONE: Record<IncidentListItem["status"], StateTone> = {
  OPEN: "alert",
  ACKNOWLEDGED: "ok",
  RESOLVED: "empty",
};

/** Listado del centro (E5): estado, quién la ha confirmado y cerrarla. */
export function IncidentList({ incidents }: { incidents: IncidentListItem[] }) {
  const t = useTranslations("incidents");
  const format = useFormatter();

  if (incidents.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("list.empty")}</p>;
  }

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
      {incidents.map((i) => {
        const done = i.receipts.filter((r) => r.acknowledgedAt).length;
        return (
          <li key={i.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {t(`category.${i.category}`)} · {i.horseName}
              </span>
              <StateBadge tone={i.severity === "HIGH" ? "danger" : "alert"}>{t(`severity.${i.severity}`)}</StateBadge>
              <StateBadge tone={STATUS_TONE[i.status]}>{t(`status.${i.status}`)}</StateBadge>
              {i.escalatedAt && i.status === "OPEN" && <StateBadge tone="danger">{t("list.escalated")}</StateBadge>}
            </div>
            <p className="text-sm text-foreground">{i.description}</p>
            <p className="text-xs text-muted-foreground">
              {format.dateTime(i.occurredAt, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" })}
              {" · "}
              {i.receipts.length === 0
                ? t("list.noOwners")
                : t("list.confirmedBy", { done, total: i.receipts.length })}
            </p>
            {i.status !== "RESOLVED" ? <ResolveIncident id={i.id} /> : <FollowUpIncident id={i.id} />}
          </li>
        );
      })}
    </ul>
  );
}

function ResolveIncident({ id }: { id: string }) {
  const t = useTranslations("incidents.list");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const resolve = trpc.incidents.resolve.useMutation({
    onSuccess: () => {
      toast.success(t("resolved"));
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || t("resolveError")),
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="h-11" onClick={() => setOpen(true)}>
        {t("resolve")}
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (note.trim()) resolve.mutate({ id, note: note.trim() });
      }}
    >
      <Input
        aria-label={t("resolveNote")}
        placeholder={t("resolveNote")}
        className="h-11"
        value={note}
        maxLength={1000}
        autoFocus
        onChange={(e) => setNote(e.target.value)}
      />
      <Button type="submit" className="h-11" disabled={!note.trim() || resolve.isPending}>
        {t("resolveSubmit")}
      </Button>
    </form>
  );
}

/** Una cerrada no se reabre: «Ha vuelto a pasar» abre otra enlazada y vuelve a avisar. */
function FollowUpIncident({ id }: { id: string }) {
  const t = useTranslations("incidents.list");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mutationId] = useState(() => crypto.randomUUID());
  const followUp = trpc.incidents.followUp.useMutation({
    onSuccess: () => {
      toast.success(t("followedUp"));
      setOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || t("followUpError")),
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="h-11" onClick={() => setOpen(true)}>
        {t("followUp")}
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) followUp.mutate({ id, description: text.trim(), clientMutationId: mutationId });
      }}
    >
      <Input
        aria-label={t("followUpPlaceholder")}
        placeholder={t("followUpPlaceholder")}
        className="h-11"
        value={text}
        maxLength={2000}
        autoFocus
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" className="h-11" disabled={!text.trim() || followUp.isPending}>
        {t("followUpSubmit")}
      </Button>
    </form>
  );
}
