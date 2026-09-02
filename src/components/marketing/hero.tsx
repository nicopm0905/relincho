import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
      {/* Background gradients simulating Granola's subtle glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-gradient-to-b from-blue-500/10 via-transparent to-transparent blur-3xl -z-10 rounded-full opacity-50" />
      
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="flex flex-col items-center text-center space-y-10">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-border/50 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="flex items-center justify-center bg-[#a3b846]/20 text-[#6b8e23] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Nuevo
            </span>
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              Veri*Factu integrado <ArrowRight className="h-3 w-3" />
            </span>
          </div>

          {/* Huge Heading */}
          <div className="max-w-[900px] animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-150">
            <h1 className="font-heading text-6xl sm:text-7xl md:text-8xl lg:text-[110px] leading-[0.95] tracking-tight text-foreground">
              El software de <br className="hidden md:block" />
              <span className="relative">
                gestión equina
                <span className="absolute -bottom-2 md:-bottom-4 left-0 w-full h-1 md:h-2 bg-[#a3b846]/30 -z-10 rounded-full" />
              </span> para yeguadas.
            </h1>
          </div>

          {/* Description */}
          <p className="max-w-xl text-lg sm:text-xl text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            Sanidad, reproducción, pupilaje y facturación.
            <br />
            Todo en un solo lugar. Sin complicaciones.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
            <Button size="lg" asChild className="rounded-full h-14 px-8 text-base shadow-[0_4px_14px_0_rgba(163,184,70,0.39)] hover:shadow-[0_6px_20px_rgba(163,184,70,0.23)] hover:bg-[#8b9e3a] transition-all duration-300">
              <Link href="/registro">
                Pruébalo gratis <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-full h-14 px-8 text-base bg-white shadow-sm border-border/50 hover:bg-muted/50 transition-all duration-300">
              <Link href="#features">
                Ver características
              </Link>
            </Button>
          </div>

          {/* Mockup / Image Container */}
          <div className="w-full max-w-5xl mx-auto mt-16 md:mt-24 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-700">
            <div className="relative rounded-[2rem] md:rounded-[3rem] bg-white border border-border/40 shadow-bento overflow-hidden p-2 md:p-4 bg-gradient-to-b from-white to-[#f9f9f6]">
              {/* Top bar mockup */}
              <div className="flex items-center gap-2 px-4 py-3 pb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                  <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                </div>
              </div>
              
              <div className="relative aspect-[16/10] md:aspect-[16/9] w-full rounded-2xl md:rounded-[2rem] overflow-hidden border border-border/50 bg-[#f9f9f6]">
                {/* Granola-style internal Mockup Content */}
                <div className="absolute inset-0 flex flex-col p-8 md:p-12">
                  <h2 className="font-heading text-3xl md:text-5xl text-foreground mb-6">Ficha del caballo</h2>
                  <div className="flex gap-3 mb-8">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-white text-sm">
                      <Sparkles className="h-4 w-4 text-primary" /> Pura Raza Española
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-white text-sm text-muted-foreground">
                      Macho
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="h-4 w-64 bg-border/50 rounded-full" />
                    <div className="h-4 w-48 bg-border/50 rounded-full" />
                    <div className="h-4 w-72 bg-border/50 rounded-full" />
                  </div>
                  
                  {/* Floating elements mimicking the video call in Granola */}
                  <div className="absolute right-8 bottom-8 md:right-12 md:bottom-12 flex flex-col gap-4">
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-white border border-border/50 shadow-lg overflow-hidden flex items-center justify-center p-4">
                       <Image src="/logo.png" alt="Relincho App" width={80} height={80} className="opacity-80" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
