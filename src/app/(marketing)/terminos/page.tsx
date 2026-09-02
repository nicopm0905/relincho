import { auth } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";

export const metadata = {
  title: "Términos y Condiciones - Relincho",
};

export default async function TerminosPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/20 bg-white">
      <Header session={session} />
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 sm:px-6 py-32 md:py-40">
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
          Términos y Condiciones
        </h1>
        
        <div className="prose prose-slate max-w-none text-muted-foreground prose-headings:font-heading prose-headings:text-foreground">
          <p className="lead text-lg mb-8">
            Última actualización: {new Date().toLocaleDateString('es-ES')}
          </p>
          
          <h2 className="text-2xl font-bold mt-12 mb-4">1. Introducción</h2>
          <p className="mb-6">
            Bienvenido a Relincho. Al acceder y utilizar nuestro software de gestión para centros ecuestres y yeguadas, aceptas estar sujeto a estos términos y condiciones. Si no estás de acuerdo con alguna parte de los términos, no podrás acceder al servicio.
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">2. Uso del Servicio</h2>
          <p className="mb-6">
            Relincho proporciona una plataforma de software como servicio (SaaS) para la gestión equina. Te comprometes a utilizar el servicio únicamente para fines legales y de acuerdo con estos Términos. Eres responsable de mantener la confidencialidad de tu cuenta y contraseña.
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">3. Suscripción y Pagos</h2>
          <p className="mb-6">
            Algunos aspectos del Servicio se facturan mediante suscripción. Los pagos se procesan de forma segura a través de nuestros proveedores de pago (ej. Stripe). Nos reservamos el derecho de modificar nuestras tarifas, notificándote con al menos 30 días de antelación.
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">4. Propiedad Intelectual</h2>
          <p className="mb-6">
            El Servicio y su contenido original, características y funcionalidad son y seguirán siendo propiedad exclusiva de Relincho y sus licenciantes. El software está protegido por derechos de autor y marcas registradas.
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">5. Limitación de Responsabilidad</h2>
          <p className="mb-6">
            En ningún caso Relincho, ni sus directores, empleados o afiliados, serán responsables de ningún daño indirecto, incidental, especial o consecuente derivado de tu uso del servicio.
          </p>
          
          <p className="mt-12 text-sm">
            Para cualquier duda sobre estos términos, contáctanos en contacto@relincho.com
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
