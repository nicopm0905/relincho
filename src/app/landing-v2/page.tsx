import type { Metadata } from "next";
import { auth } from "@/server/auth";
import { NavbarV2 } from "@/components/landing-v2/navbar-v2";
import { HeroV2 } from "@/components/landing-v2/hero-v2";
import { PanelV2 } from "@/components/landing-v2/panel-v2";
import { IaV2 } from "@/components/landing-v2/ia-v2";
// Secciones compartidas con la landing actual, importadas sin modificarlas.
import { Features } from "@/components/marketing/features";
import { About } from "@/components/marketing/about";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Relincho — Landing V2",
  robots: { index: false },
};

export default async function LandingV2Page() {
  const session = await auth();

  return (
    <div className="brand-serif flex min-h-screen flex-col selection:bg-primary/20">
      <NavbarV2 session={session} />
      {/* El fondo oscuro evita el destello blanco entre secciones oscuras. */}
      <main id="main-content" tabIndex={-1} className="flex-1" style={{ backgroundColor: "#0b0d08" }}>
        <HeroV2 />
        <PanelV2 />
        <IaV2 />
        <Features />
        <About />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
