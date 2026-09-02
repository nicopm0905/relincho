import { auth } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Contacto - Relincho",
};

export default async function ContactoPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/20 bg-white">
      <Header session={session} />
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 sm:px-6 py-32 md:py-40">
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6 text-foreground text-center">
          Contacta con nosotros
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-16">
          ¿Tienes alguna duda sobre Relincho o necesitas ayuda con tu cuenta? Nuestro equipo de soporte está listo para ayudarte.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="bg-[#f9f9f6] p-8 rounded-[2rem] border border-border/50">
            <h3 className="text-2xl font-bold font-heading mb-4 text-foreground">Soporte Técnico</h3>
            <p className="text-muted-foreground mb-6">
              Si ya eres cliente y tienes algún problema técnico o duda sobre cómo usar una funcionalidad.
            </p>
            <a href="mailto:soporte@relincho.com" className="text-primary font-medium hover:underline">
              soporte@relincho.com
            </a>
          </div>

          <div className="bg-white p-8 rounded-[2rem] border border-border/50 shadow-sm">
            <h3 className="text-2xl font-bold font-heading mb-4 text-foreground">Ventas e Información</h3>
            <p className="text-muted-foreground mb-6">
              ¿Quieres saber más sobre cómo Relincho puede ayudar a tu yeguada? Hablemos.
            </p>
            <a href="mailto:info@relincho.com" className="text-primary font-medium hover:underline">
              info@relincho.com
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
