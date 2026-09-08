"use client";

import { Baby, Receipt, Layers, HeartPulse } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Sanidad y controles",
    description:
      "Registra vacunas, desparasitaciones y tratamientos. Nunca olvides una fecha importante gracias a las alertas automáticas.",
    icon: HeartPulse,
    span: "md:col-span-2",
    dark: false,
  },
  {
    title: "Control reproductivo",
    description:
      "Seguimiento de celos, inseminaciones, ecografías y partos con cálculos predictivos.",
    icon: Baby,
    span: "md:col-span-1",
    dark: false,
  },
  {
    title: "Pupilaje y estancias",
    description:
      "Gestiona los boxes, dietas y tarifas de caballos estabulados de clientes.",
    icon: Layers,
    span: "md:col-span-1",
    dark: false,
  },
  {
    title: "Facturación Veri*Factu",
    description:
      "Emite facturas legales, genera cuotas automáticas y envía recibos SEPA. Todo adaptado a la nueva normativa de la AEAT.",
    icon: Receipt,
    span: "md:col-span-2",
    dark: true,
  },
];

export function Features() {
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
            Todo lo que necesitas. <br className="hidden sm:block" /> Y nada más.
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            Hemos eliminado el ruido para que puedas centrarte en lo que de verdad
            importa: tus caballos. Relincho simplifica tu día a día.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
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
                  {feature.title}
                </h3>
                <p
                  className={cn(
                    "text-[15px] leading-relaxed sm:text-base",
                    feature.dark ? "text-white/70" : "text-muted-foreground",
                  )}
                >
                  {feature.description}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
