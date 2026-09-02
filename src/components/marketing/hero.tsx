"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const yContent = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const yImage = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <section ref={containerRef} className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden min-h-[90vh] flex items-center bg-white">
      {/* Background gradients simulating a subtle glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-gradient-to-b from-[#a3b846]/10 via-transparent to-transparent blur-3xl -z-10 rounded-full opacity-70" />
      
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 relative z-10 flex flex-col md:flex-row items-center justify-between">
        
        {/* Main Text Content */}
        <motion.div 
          style={{ y: yContent }}
          className="flex flex-col items-start text-left space-y-10 max-w-[650px] relative z-20"
        >
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-border/50 shadow-sm"
          >
            <span className="flex items-center justify-center bg-[#a3b846]/20 text-[#6b8e23] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Nuevo
            </span>
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Veri*Factu integrado <ArrowRight className="h-3 w-3" />
            </span>
          </motion.div>

          {/* Huge Heading */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h1 className="font-heading text-6xl sm:text-7xl md:text-8xl leading-[0.95] tracking-tight text-foreground">
              El software de <br />
              <span className="relative inline-block">
                gestión equina
                <span className="absolute -bottom-2 md:-bottom-3 left-0 w-full h-1 md:h-2 bg-[#a3b846]/30 -z-10 rounded-full" />
              </span> <br />
              para yeguadas.
            </h1>
          </motion.div>

          {/* Description */}
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="max-w-md text-lg sm:text-xl text-muted-foreground leading-relaxed font-medium"
          >
            Sanidad, reproducción, pupilaje y facturación. Todo en un solo lugar. Sin complicaciones.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Button size="lg" asChild className="rounded-full w-full sm:w-auto h-14 px-8 text-base shadow-[0_4px_14px_0_rgba(163,184,70,0.39)] hover:shadow-[0_6px_20px_rgba(163,184,70,0.23)] hover:bg-[#8b9e3a] transition-all duration-300">
              <Link href="/login">
                Pruébalo gratis <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-full w-full sm:w-auto h-14 px-8 text-base bg-white/80 backdrop-blur-sm shadow-sm border-border/50 text-foreground hover:bg-muted/50 transition-all duration-300">
              <Link href="#features">
                Ver características
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Floating Mascot Image with transparent effect */}
        <motion.div 
          style={{ y: yImage }}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="absolute right-[-10%] md:right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] md:w-[800px] md:h-[800px] opacity-20 md:opacity-100 z-10 pointer-events-none"
        >
          <div className="relative w-full h-full mix-blend-multiply">
            <Image 
              src="/hero-bg-isolated.jpg" 
              alt="Mascota y tablet de Relincho" 
              fill 
              className="object-contain object-right"
              priority
            />
          </div>
          {/* Subtle gradient to fade the image gracefully into the background if needed */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-transparent hidden md:block" />
        </motion.div>
        
      </div>
    </section>
  );
}
