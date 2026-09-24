import { getSession } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Hero } from "@/components/marketing/hero";
import { Showcase } from "@/components/marketing/showcase";
import { Features } from "@/components/marketing/features";
import { About } from "@/components/marketing/about";
import { Faq } from "@/components/marketing/faq";
import { Pricing } from "@/components/marketing/pricing";
import { CtaBand } from "@/components/marketing/cta-band";
import { Footer } from "@/components/marketing/footer";

export default async function RootPage() {
  const session = await getSession();

  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/20">
      <Header session={session} overHero />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <Hero />
        <Showcase />
        <Features />
        <About />
        <Pricing />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
