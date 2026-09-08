"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState } from "react";
import { Check, X, Horse } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** Ajuste del dia calculado a partir de la carga de entrenamiento. */
export interface DynamicRation {
  forageKg: number;
  concentrateKg: number;
  extraGrams: number;
  electrolytesGrams: number;
  totalMeals: number;
  instructions: string;
}

interface SwipeableCardProps {
  horseName: string;
  boxLocation?: string | null;
  photoUrl?: string | null;
  diet: string[];
  status: "PENDING" | "DONE" | "SKIPPED";
  dynamic?: DynamicRation | null;
  onSwipe: (status: "DONE" | "SKIPPED") => void;
}

export function SwipeableCard({ horseName, boxLocation, photoUrl, diet, status, dynamic, onSwipe }: SwipeableCardProps) {
  const [swiping, setSwiping] = useState(false);
  const x = useMotionValue(0);
  
  // Transform values for styling based on drag distance
  const opacity = useTransform(x, [-150, 0, 150], [0, 1, 0]);
  const backgroundColor = useTransform(
    x,
    [-100, 0, 100],
    ["rgba(239, 68, 68, 0.15)", "rgba(255, 255, 255, 1)", "rgba(34, 197, 94, 0.15)"]
  );
  
  // Icon indicators
  const checkOpacity = useTransform(x, [0, 100], [0, 1]);
  const checkScale = useTransform(x, [0, 100], [0.5, 1.2]);
  
  const xOpacity = useTransform(x, [-100, 0], [1, 0]);
  const xScale = useTransform(x, [-100, 0], [1.2, 0.5]);

  const handleDragEnd = () => {
    const threshold = 100;
    if (x.get() > threshold) {
      onSwipe("DONE");
    } else if (x.get() < -threshold) {
      onSwipe("SKIPPED");
    } else {
      setSwiping(false);
    }
  };

  // If already done or skipped, we just show a static state (or allow reset if needed, but for kiosko usually we hide it or show it greyed out)
  if (status !== "PENDING") {
    return (
      <div className={cn(
        "relative w-full rounded-3xl p-6 shadow-sm border mb-4 flex items-center justify-between",
        status === "DONE" ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
      )}>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full overflow-hidden bg-white/50 border border-white shrink-0 relative">
            {photoUrl ? (
              <img src={photoUrl} alt={horseName} className="object-cover w-full h-full opacity-60" />
            ) : (
              <Horse weight="duotone" className="h-6 w-6 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground/70 line-through decoration-2 decoration-foreground/30">{horseName}</h3>
            {boxLocation && <p className="text-sm text-muted-foreground font-mono">{boxLocation}</p>}
          </div>
        </div>
        <div className="shrink-0">
          {status === "DONE" ? (
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check weight="bold" className="h-5 w-5" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <X weight="bold" className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full mb-4">
      {/* Background Indicators (Underneath the card) */}
      <div className="absolute inset-0 flex justify-between items-center px-8 rounded-3xl overflow-hidden -z-10">
        <motion.div style={{ opacity: xOpacity, scale: xScale }} className="flex items-center text-rose-500 font-bold gap-2">
          <X weight="bold" className="h-8 w-8" />
          <span className="text-xl">Omitir</span>
        </motion.div>
        
        <motion.div style={{ opacity: checkOpacity, scale: checkScale }} className="flex items-center text-emerald-500 font-bold gap-2">
          <span className="text-xl">Repartido</span>
          <Check weight="bold" className="h-8 w-8" />
        </motion.div>
      </div>

      {/* The Swipeable Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9} // Allow it to stretch past constraints
        onDragStart={() => setSwiping(true)}
        onDragEnd={handleDragEnd}
        style={{ x, opacity, backgroundColor }}
        className="w-full rounded-3xl p-6 shadow-bento border border-border/60 bg-white cursor-grab active:cursor-grabbing touch-pan-y"
      >
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl overflow-hidden bg-muted border border-border/40 shrink-0 relative shadow-sm">
            {photoUrl ? (
              <img src={photoUrl} alt={horseName} className="object-cover w-full h-full" />
            ) : (
              <Horse weight="duotone" className="h-8 w-8 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-black font-heading tracking-tight text-foreground truncate">{horseName}</h3>
            {boxLocation && (
              <p className="text-sm font-bold text-muted-foreground/80 font-mono mt-0.5">{boxLocation}</p>
            )}
          </div>
        </div>

        {diet && diet.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
              Ración asignada
            </div>
            <div className="flex flex-wrap gap-2">
              {diet.map((item: any, i: number) => (
                <span key={i} className="inline-flex items-center rounded-xl bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-700 border border-orange-100">
                  {item.quantity} {item.unit} {item.feedName}
                </span>
              ))}
            </div>
          </div>
        )}

        {dynamic && (
          <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/80 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-orange-700/70">
              Ajuste de hoy
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-orange-800 border border-orange-100">
                {dynamic.forageKg} kg heno
              </span>
              <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-orange-800 border border-orange-100">
                {dynamic.concentrateKg} kg pienso
              </span>
              <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-orange-800 border border-orange-100">
                {dynamic.totalMeals} tomas
              </span>
              {dynamic.electrolytesGrams > 0 && (
                <span className="rounded-xl bg-amber-100 px-3 py-1.5 text-sm font-black text-amber-900 border border-amber-200">
                  + {dynamic.electrolytesGrams} g electrolitos
                </span>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold leading-snug text-orange-900">
              {dynamic.instructions}
            </p>
          </div>
        )}

        <div className="mt-5 text-center text-xs font-bold text-muted-foreground/40 uppercase tracking-widest flex items-center justify-center gap-3">
          <span>&larr; Omitir</span>
          <span className="w-1.5 h-1.5 rounded-full bg-border" />
          <span>Repartido &rarr;</span>
        </div>
      </motion.div>
    </div>
  );
}
