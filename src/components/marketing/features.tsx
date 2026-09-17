"use client";

import { Baby, Receipt, Layers, HeartPulse, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const features = [
  { key: "health", icon: HeartPulse, span: "md:col-span-2", dark: false },
  { key: "reproduction", icon: Baby, span: "md:col-span-1", dark: false },
  { key: "performance", icon: Activity, span: "md:col-span-1", dark: true },
  { key: "boarding", icon: Layers, span: "md:col-span-1", dark: false },
  { key: "invoicing", icon: Receipt, span: "md:col-span-1", dark: false },
] as const;

export function Features() {
  const t = useTranslations("marketing.features");

  return (
    <section id="features" className="relative overflow-hidden bg-white py-20 md:py-32">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mb-12 max-w-2xl md:mb-20"
        >
          <h2 className="mb-5 font-heading text-3xl text-foreground sm:text-4xl md:text-6xl">
            {t("title")}
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            {t("subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              key={feature.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: index * 0.08 }}
              className={cn(
                "flex flex-col gap-5 overflow-hidden rounded-[2rem] border p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-9",
                feature.span,
                feature.dark
                  ? "border-transparent bg-[#222222] text-white"
                  : "border-border/50 bg-[#f9f9f6]",
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                  feature.dark
                    ? "bg-white/10 text-white"
                    : "border border-border/50 bg-white text-foreground shadow-sm",
                )}
              >
                <feature.icon strokeWidth={2} className="h-5 w-5" />
              </div>

              <div className="space-y-2.5">
                <h3
                  className={cn(
                    "font-heading text-xl font-bold sm:text-2xl",
                    feature.dark ? "text-white" : "text-foreground",
                  )}
                >
                  {t(`items.${feature.key}.title`)}
                </h3>
                <p
                  className={cn(
                    "text-[15px] leading-relaxed sm:text-base",
                    feature.dark ? "text-white/70" : "text-muted-foreground",
                  )}
                >
                  {t(`items.${feature.key}.description`)}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
