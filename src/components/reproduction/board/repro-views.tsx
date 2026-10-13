"use client";

import { useTranslations } from "next-intl";
import { Kanban, CalendarDots } from "@phosphor-icons/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Board (where each mare is) or calendar (what is coming), same data. */
export function ReproViews({ board, calendar }: { board: React.ReactNode; calendar: React.ReactNode }) {
  const t = useTranslations("repro.views");
  return (
    <Tabs defaultValue="board" className="gap-4">
      <TabsList aria-label={t("label")}>
        <TabsTrigger value="board" className="min-h-9 px-3 text-label">
          <Kanban aria-hidden />
          {t("board")}
        </TabsTrigger>
        <TabsTrigger value="calendar" className="min-h-9 px-3 text-label">
          <CalendarDots aria-hidden />
          {t("calendar")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="board">{board}</TabsContent>
      <TabsContent value="calendar">{calendar}</TabsContent>
    </Tabs>
  );
}
