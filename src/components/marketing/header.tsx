"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { Session } from "next-auth";

interface HeaderProps {
  session: Session | null;
}

export function Header({ session }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "py-3" : "py-6"
      )}
    >
      <div className="container max-w-5xl mx-auto px-4 sm:px-6">
        <div
          className={cn(
            "flex items-center justify-between transition-all duration-300 mx-auto",
            scrolled
              ? "bg-white/80 backdrop-blur-xl border border-border/50 shadow-sm rounded-full px-4 py-2"
              : "bg-transparent px-2 py-2"
          )}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-border/40 shadow-sm relative overflow-hidden group-hover:scale-105 transition-transform">
              <Image src="/logo.png" alt="Relincho" fill className="object-contain p-1" priority />
            </div>
            <span className="font-bold text-lg font-heading tracking-tight">Relincho</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Características
            </Link>
            <Link href="#nosotros" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Nosotros
            </Link>
            <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Precios
            </Link>
            <Link href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {session?.user ? (
              <Button asChild className="rounded-full" size="sm">
                <Link href="/dashboard">Ir al panel</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="rounded-full hidden sm:inline-flex" size="sm">
                  <Link href="/login">Iniciar sesión</Link>
                </Button>
                <Button asChild className="rounded-full" size="sm">
                  <Link href="/login">Empezar gratis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
