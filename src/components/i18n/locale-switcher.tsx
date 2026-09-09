"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { setLocale } from "@/i18n/actions";

const OPTIONS = ["es", "en"] as const;

interface LocaleSwitcherProps {
  className?: string;
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const active = useLocale();
  const router = useRouter();
  const t = useTranslations("common.localeSwitcher");
  const [pending, startTransition] = useTransition();

  function change(next: (typeof OPTIONS)[number]) {
    if (next === active || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-white/70 p-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const isActive = option === active;
        return (
          <button
            key={option}
            type="button"
            onClick={() => change(option)}
            disabled={pending}
            aria-pressed={isActive}
            className={cn(
              "rounded-full px-2 py-1 uppercase transition-colors disabled:opacity-60",
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(option)}
          </button>
        );
      })}
    </div>
  );
}
