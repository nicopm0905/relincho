import { auth } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { About } from "@/components/marketing/about";
import { Faq } from "@/components/marketing/faq";
import { Pricing } from "@/components/marketing/pricing";
import { Footer } from "@/components/marketing/footer";

export default async function RootPage() {
  const session = await auth();
  
  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/20">
      <Header session={session} />
      <main className="flex-1">
        <Hero />
        <Features />
        <About />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
