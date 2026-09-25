"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import Image from "next/image";
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
  /** Dieta fija de esta toma. */
  diet: { food: string; quantity: string }[];
  status: "PENDING" | "DONE" | "SKIPPED";
  dynamic?: DynamicRation | null;
  onSwipe: (status: "DONE" | "SKIPPED") => void;
}

/** Reparto de la cantidad del dia entre las tomas, a la decena de gramo. */
function perMeal(kgPerDay: number, meals: number) {
  return (Math.round((kgPerDay / Math.max(1, meals)) * 10) / 10).toLocaleString("es-ES");
}

export function SwipeableCard({ horseName, boxLocation, photoUrl, diet, status, dynamic, onSwipe }: SwipeableCardProps) {
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
              <Image src={photoUrl} alt={horseName} fill sizes="3rem" className="object-cover opacity-60" />
            ) : (
              <Horse className="h-6 w-6 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />
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
    <div className="relative mb-4 w-full">
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
        onDragEnd={handleDragEnd}
        style={{ x, opacity, backgroundColor }}
        role="group"
        aria-label={`Ración de ${horseName}. Desliza a la derecha para marcar como repartido o a la izquierda para omitir.`}
        tabIndex={0}
        className="w-full rounded-3xl p-6 shadow-bento border border-border/60 bg-card cursor-grab active:cursor-grabbing touch-pan-y focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl overflow-hidden bg-muted border border-border/40 shrink-0 relative shadow-sm">
            {photoUrl ? (
              <Image src={photoUrl} alt={horseName} fill sizes="4rem" className="object-cover" />
            ) : (
              <Horse className="h-8 w-8 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-2xl font-semibold font-heading tracking-tight text-foreground truncate">{horseName}</h3>
            {boxLocation && (
              <p className="text-sm font-bold text-muted-foreground/80 font-mono mt-0.5">{boxLocation}</p>
            )}
          </div>
        </div>

        {/* Una sola ración que servir: si hay ajuste calculado para hoy, manda
            él (dice cuánto echar en esta toma); si no, la dieta fija. */}
        {dynamic ? (
          <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/80 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-orange-700/70">
              En esta toma · ajustado a su trabajo de hoy
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-xl bg-card px-3 py-1.5 text-base font-black text-orange-900 border border-orange-100">
                {perMeal(dynamic.concentrateKg, dynamic.totalMeals)} kg pienso
              </span>
              <span className="rounded-xl bg-card px-3 py-1.5 text-base font-black text-orange-900 border border-orange-100">
                {perMeal(dynamic.forageKg, dynamic.totalMeals)} kg heno
              </span>
              <span className="rounded-xl bg-card/60 px-3 py-1.5 text-sm font-semibold text-orange-800 border border-orange-100">
                Día: {dynamic.concentrateKg} kg pienso · {dynamic.forageKg} kg heno · {dynamic.totalMeals} tomas
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
            {diet.length > 0 && (
              <p className="mt-2 text-xs text-orange-800/70">
                Dieta fija de esta toma (hoy no aplica): {diet.map((d) => `${d.quantity} ${d.food}`).join(", ")}
              </p>
            )}
          </div>
        ) : diet.length > 0 ? (
          <div className="mt-5 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
              En esta toma
            </div>
            <div className="flex flex-wrap gap-2">
              {diet.map((item, i) => (
                <span key={i} className="inline-flex items-center rounded-xl bg-orange-50/80 px-3 py-1.5 text-base font-bold text-orange-800 border border-orange-100">
                  {item.quantity} {item.food}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">Sin nada asignado en esta toma.</p>
        )}

        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onSwipe("SKIPPED")}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground underline-offset-2 hover:bg-muted hover:text-foreground hover:underline"
          >
            Omitir
          </button>
          <span className="h-1.5 w-1.5 rounded-full bg-border" aria-hidden />
          <button
            type="button"
            onClick={() => onSwipe("DONE")}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-primary-ink underline-offset-2 hover:bg-primary/[0.08] hover:underline"
          >
            Marcar repartido
          </button>
        </div>
      </motion.div>
    </div>
  );
}
