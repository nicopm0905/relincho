"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/react";
import { isValidLeadDays, REMINDER_LEAD_DAYS } from "@/lib/reminder-recipients";

/**
 * Antelación de los avisos de vencimientos (E3): cuántos días antes del
 * herraje, la vacuna, la desparasitación o el dentista avisa el cron al
 * centro, al propietario y al profesional. Además se avisa el mismo día.
 */
export function ReminderSettingsCard({ leadDays }: { leadDays: number }) {
  const t = useTranslations("settings.reminders");
  const router = useRouter();
  const [value, setValue] = useState(String(leadDays));

  const days = Number(value);
  const valid = value.trim() !== "" && isValidLeadDays(days);
  const changed = valid && days !== leadDays;

  const update = trpc.tenant.update.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
    onError: (err) => toast.error(err.message || t("error")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!changed) return;
    update.mutate({ reminderLeadDays: days });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell weight="fill" className="h-4 w-4" aria-hidden />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="reminder-lead-days">{t("label")}</Label>
            <Input
              id="reminder-lead-days"
              type="number"
              inputMode="numeric"
              min={REMINDER_LEAD_DAYS.min}
              max={REMINDER_LEAD_DAYS.max}
              step={1}
              required
              value={value}
              aria-describedby="reminder-lead-days-help"
              aria-invalid={!valid}
              className="h-11"
              onChange={(e) => setValue(e.target.value)}
            />
            <p id="reminder-lead-days-help" className="text-xs text-muted-foreground">
              {valid
                ? t("help", { days })
                : t("invalid", { min: REMINDER_LEAD_DAYS.min, max: REMINDER_LEAD_DAYS.max })}
            </p>
          </div>
          <Button type="submit" className="h-11 sm:mb-6" disabled={!changed || update.isPending}>
            {update.isPending && <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {update.isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
