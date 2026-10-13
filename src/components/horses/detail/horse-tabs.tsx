"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HorseTab } from "./horse-tab-list";

const labelKey: Record<HorseTab, "summary" | "repro" | "health" | "pedigree" | "journal" | "documents"> = {
  resumen: "summary",
  reproduccion: "repro",
  sanidad: "health",
  pedigri: "pedigree",
  diario: "journal",
  documentos: "documents",
};

/**
 * Tabs ordered by how often they are opened. The active one is kept in
 * `?tab=` (without a server round trip) so other screens can link straight to
 * a horse's health or breeding record and the back button lands where it was.
 */
export function HorseTabs({
  initial,
  tabs,
  children,
}: {
  initial: HorseTab;
  tabs: readonly HorseTab[];
  children: React.ReactNode;
}) {
  const t = useTranslations("horseDetail.tabs");
  return (
    <Tabs
      defaultValue={initial}
      onValueChange={(value) => {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", String(value));
        window.history.replaceState(window.history.state, "", url);
      }}
      className="w-full gap-0"
    >
      <div className="no-scrollbar -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        <TabsList variant="line" aria-label={t("label")} className="min-w-max gap-1 pb-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-h-10 shrink-0 flex-none px-3 text-label font-semibold">
              {t(labelKey[tab])}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
