"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Heart, MessageCircle } from "lucide-react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useTranslations } from "next-intl";
import { EASE, HERO_POSTER } from "./assets";

export function StoryCardV2() {
  const t = useTranslations("landingV2.story");
  const reduceMotion = useReducedMotion();
  const [slide, setSlide] = useState(0);

  // Tilt 3D siguiendo al raton, normalizado a [-1, 1] respecto al centro del viewport.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 120, damping: 18, mass: 0.4 });
  const springY = useSpring(pointerY, { stiffness: 120, damping: 18, mass: 0.4 });
  const rotateY = useTransform(springX, [-1, 1], [-18, 18]);
  const rotateX = useTransform(springY, [-1, 1], [12, -12]);

  useEffect(() => {
    if (reduceMotion) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const onMove = (event: MouseEvent) => {
      pointerX.set((event.clientX / window.innerWidth) * 2 - 1);
      pointerY.set((event.clientY / window.innerHeight) * 2 - 1);
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [pointerX, pointerY, reduceMotion]);

  // El titular va sincronizado con las dos barras de progreso: ciclo de 6 s,
  // cambio a la mitad. Con reduced motion se queda en el primer slide.
  useEffect(() => {
    if (reduceMotion) return;

    let swap: ReturnType<typeof setTimeout> = setTimeout(() => setSlide(1), 3000);
    const cycle = setInterval(() => {
      setSlide(0);
      clearTimeout(swap);
      swap = setTimeout(() => setSlide(1), 3000);
    }, 6000);

    return () => {
      clearTimeout(swap);
      clearInterval(cycle);
    };
  }, [reduceMotion]);

  return (
    <div className="mt-12" style={{ perspective: 1200 }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
        style={{
          width: 310,
          height: 455,
          borderRadius: 28,
          backgroundColor: "#141610",
          transformStyle: "preserve-3d",
          rotateX: reduceMotion ? 0 : rotateX,
          rotateY: reduceMotion ? 0 : rotateY,
          boxShadow:
            "0 40px 100px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
        className="relative overflow-hidden"
      >
        <Image
          src={HERO_POSTER}
          alt=""
          aria-hidden
          fill
          sizes="310px"
          className="object-cover"
          style={{ objectPosition: "center 20%" }}
        />

        {/* Tinte oliva de marca */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            mixBlendMode: "soft-light",
            backgroundImage:
              "linear-gradient(160deg, rgba(163,184,70,0.65) 0%, rgba(140,165,55,0.35) 40%, rgba(70,90,30,0.25) 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 15%, rgba(190,215,110,0.25), transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: 28,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
          }}
        />

        {/* Barras de progreso tipo story */}
        <div
          aria-hidden
          className="absolute z-20 flex"
          style={{ top: 24, left: 24, right: 24, gap: 6 }}
        >
          {["rlv2-bar-1", "rlv2-bar-2"].map((bar) => (
            <div
              key={bar}
              className={`${bar} relative flex-1 overflow-hidden`}
              style={{ height: 3, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.25)" }}
            >
              <div
                className="rlv2-fill h-full w-full"
                style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
              />
            </div>
          ))}
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 left-0"
          style={{
            height: "55%",
            backgroundImage:
              "linear-gradient(0deg, #070805 20%, rgba(20,26,10,0) 100%)",
          }}
        />

        <motion.h3
          key={slide}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="absolute z-10 text-white"
          style={{
            left: 24,
            right: 24,
            bottom: 88,
            fontSize: 38,
            lineHeight: "40px",
            letterSpacing: "-0.5px",
            textShadow: "0 2px 18px rgba(0,0,0,0.35)",
          }}
        >
          <span className="font-sans font-bold">
            {slide === 0 ? t("slide1Lead") : t("slide2Lead")}
          </span>
          <br />
          <span className="font-heading font-normal italic">
            {slide === 0 ? t("slide1Accent") : t("slide2Accent")}
          </span>
        </motion.h3>

        <div
          className="absolute z-10 flex items-center"
          style={{ left: 24, right: 24, bottom: 24, gap: 10 }}
        >
          <span
            className="font-sans text-[13px] font-medium"
            style={{
              backgroundColor: "rgba(255,255,255,0.96)",
              color: "#0a0a0a",
              padding: "9px 16px",
              borderRadius: 9999,
              boxShadow:
                "0 6px 18px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.9)",
            }}
          >
            {t("verified")}
          </span>

          {[Heart, MessageCircle].map((Icon, i) => (
            <button
              key={i}
              type="button"
              aria-hidden
              tabIndex={-1}
              className="flex items-center justify-center border border-white/[0.14] backdrop-blur-[10px]"
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                backgroundColor: "rgba(20,22,16,0.45)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              <Icon size={18} strokeWidth={1.8} color="#fff" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
