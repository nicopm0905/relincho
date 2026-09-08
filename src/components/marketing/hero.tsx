"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const yContent = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const yImage = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-[88vh] items-center overflow-hidden bg-white pt-28 pb-16 sm:pt-32 sm:pb-20 md:min-h-[90vh] md:pt-44 md:pb-28"
    >
      {/* Soft olive glow behind the headline */}
      <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-full max-w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/10 via-transparent to-transparent opacity-70 blur-3xl" />

      <div className="relative z-10 container mx-auto flex max-w-6xl flex-col items-center justify-between px-4 sm:px-6 lg:flex-row">
        <motion.div
          style={reduceMotion ? undefined : { y: yContent }}
          className="relative z-20 flex max-w-[650px] flex-col items-start space-y-7 text-left md:space-y-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-md"
          >
            <span className="flex items-center justify-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary-ink uppercase">
              Nuevo
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              Veri*Factu integrado <ArrowRight className="h-3 w-3" />
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-heading text-[2.75rem] leading-[1.02] tracking-tight text-balance text-foreground sm:text-6xl md:text-7xl lg:text-8xl lg:leading-[0.95]"
          >
            El software de{" "}
            <span className="relative inline-block">
              gestión equina
              <span className="absolute -bottom-1 left-0 -z-10 h-1 w-full rounded-full bg-primary/30 md:-bottom-3 md:h-2" />
            </span>{" "}
            para yeguadas.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="max-w-md text-base leading-relaxed font-medium text-muted-foreground sm:text-lg md:text-xl"
          >
            Sanidad, reproducción, pupilaje y facturación. Todo en un solo lugar.
            Sin complicaciones.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4"
          >
            <Button
              size="lg"
              asChild
              className="h-13 w-full rounded-full px-8 text-base shadow-[0_4px_14px_0_rgba(163,184,70,0.35)] transition-all duration-300 hover:shadow-[0_6px_20px_rgba(163,184,70,0.28)] sm:h-14 sm:w-auto"
            >
              <Link href="/login">
                Pruébalo gratis <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-13 w-full rounded-full bg-white/80 px-8 text-base shadow-sm backdrop-blur-sm transition-all duration-300 sm:h-14 sm:w-auto"
            >
              <Link href="#features">Ver características</Link>
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-[13px] font-medium text-muted-foreground"
          >
            Sin tarjeta de crédito · Cancela cuando quieras
          </motion.p>
        </motion.div>

        {/* Mascot — decorative, fades behind the copy on small screens */}
        <motion.div
          aria-hidden="true"
          style={reduceMotion ? undefined : { y: yImage }}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="pointer-events-none absolute top-1/2 right-[-15%] z-10 h-[520px] w-[520px] -translate-y-1/2 sm:h-[600px] sm:w-[600px] md:right-[-8%] lg:right-0 lg:h-[760px] lg:w-[760px] xl:h-[800px] xl:w-[800px]"
        >
          <div className="relative h-full w-full opacity-[0.08] mix-blend-multiply lg:opacity-100">
            <Image
              src="/hero-bg-isolated.jpg"
              alt=""
              fill
              sizes="(min-width: 768px) 800px, 600px"
              className="object-contain object-right"
              priority
            />
          </div>
          <div className="absolute inset-0 hidden bg-gradient-to-r from-white via-transparent to-transparent lg:block" />
        </motion.div>
      </div>
    </section>
  );
}
