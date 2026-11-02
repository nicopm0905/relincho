"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { HealthEventType } from "@prisma/client";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircleNotch, Check } from "@phosphor-icons/react";

/** `YYYY-MM-DD` de hoy en Madrid, para el valor inicial del campo de fecha. */
const todayMadrid = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

/** Un día del calendario a mediodía: ningún huso lo mueve de fecha. */
const atNoon = (day: string) => new Date(`${day}T12:00:00`);

/**
 * Visita del profesional (E7): elige caballos, acto y fecha, y lo registra en
 * todos de una vez. La próxima cita del herraje la propone el servidor.
 */
export function RecordVisitForm({ horses }: { horses: { id: string; name: string }[] }) {
  const t = useTranslations("professional.visit");
  const router = useRouter();
  const typesQuery = trpc.professional.allowedTypes.useQuery();
  const types = typesQuery.data ?? [];

  const [selected, setSelected] = useState<string[]>(horses.length === 1 ? [horses[0]!.id] : []);
  const [type, setType] = useState<HealthEventType | "">("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayMadrid);
  const [next, setNext] = useState("");
  const [notes, setNotes] = useState("");
  // Mismo id mientras se reintenta: si la red falla y se pulsa otra vez, no duplica.
  const mutationId = useRef(crypto.randomUUID());

  const currentType = type || (types.length === 1 ? types[0]! : "");

  const record = trpc.professional.recordVisit.useMutation({
    onSuccess: ({ created }) => {
      toast.success(t("saved", { count: created }));
      mutationId.current = crypto.randomUUID();
      setSelected([]);
      setNext("");
      setNotes("");
      router.refresh();
    },
    onError: (err) =>
      toast.error(err.message === "FUTURE_VISIT" ? t("futureDate") : err.message || t("error")),
  });

  if (typesQuery.isSuccess && types.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noTypes")}</p>;
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <form
      className="space-y-4 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected.length === 0) {
          toast.error(t("pickHorses"));
          return;
        }
        if (!currentType) return;
        record.mutate({
          horseIds: selected,
          type: currentType,
          name: name.trim() || t(`types.${currentType}`),
          date: atNoon(date),
          nextDueDate: next ? atNoon(next) : null,
          notes: notes.trim() || null,
          clientMutationId: mutationId.current,
        });
      }}
    >
      <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>

      <fieldset className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">{t("horses")}</legend>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(selected.length === horses.length ? [] : horses.map((h) => h.id))}
          >
            {selected.length === horses.length ? t("none") : t("all")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {horses.map((h) => {
            const on = selected.includes(h.id);
            return (
              <button
                key={h.id}
                type="button"
                aria-pressed={on}
                aria-label={h.name}
                onClick={() => toggle(h.id)}
                className="min-h-11 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Badge variant={on ? "success" : "secondary"} className="cursor-pointer px-3 py-1.5 text-sm">
                  {on && <Check weight="bold" className="mr-1 h-3.5 w-3.5" aria-hidden />}
                  {h.name}
                </Badge>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("type")}</Label>
          <Select value={currentType} onValueChange={(v) => setType((v as HealthEventType) || "")}>
            <SelectTrigger aria-label={t("type")}>
              <SelectValue>{currentType ? t(`types.${currentType}`) : ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {types.map((ty) => (
                <SelectItem key={ty} value={ty}>
                  {t(`types.${ty}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visit-name">{t("name")}</Label>
          <Input
            id="visit-name"
            maxLength={120}
            placeholder={currentType ? t(`types.${currentType}`) : ""}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visit-date">{t("date")}</Label>
          <Input
            id="visit-date"
            type="date"
            required
            max={todayMadrid()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visit-next">{t("next")}</Label>
          <Input
            id="visit-next"
            type="date"
            min={date}
            value={next}
            aria-describedby="visit-next-hint"
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
      </div>
      <p id="visit-next-hint" className="text-xs text-muted-foreground">
        {t("nextHint")}
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="visit-notes">{t("notes")}</Label>
        <Textarea id="visit-notes" maxLength={1000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button type="submit" className="w-full" disabled={record.isPending || !currentType}>
        {record.isPending && <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />}
        {record.isPending ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
