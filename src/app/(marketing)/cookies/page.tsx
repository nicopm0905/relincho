import { auth } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";

export const metadata = {
  title: "Política de Cookies - Relincho",
};

export default async function CookiesPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/20 bg-white">
      <Header session={session} />
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 sm:px-6 py-32 md:py-40">
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
          Política de Cookies
        </h1>
        
        <div className="prose prose-slate max-w-none text-muted-foreground prose-headings:font-heading prose-headings:text-foreground">
          <p className="lead text-lg mb-8">
            Última actualización: {new Date().toLocaleDateString('es-ES')}
          </p>
          
          <h2 className="text-2xl font-bold mt-12 mb-4">1. ¿Qué son las cookies?</h2>
          <p className="mb-6">
            Una cookie es un pequeño archivo de texto que un sitio web guarda en tu ordenador o dispositivo móvil cuando lo visitas. Permite al sitio web recordar tus acciones y preferencias (como inicio de sesión, idioma y otras preferencias de visualización) durante un período de tiempo.
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">2. Cómo utilizamos las cookies en Relincho</h2>
          <p className="mb-6">
            Utilizamos cookies por varias razones, principalmente para:
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li><strong>Cookies Estrictamente Necesarias:</strong> Esenciales para que puedas navegar por la plataforma y usar sus funciones, como acceder a áreas seguras (iniciar sesión en tu cuenta).</li>
              <li><strong>Cookies de Rendimiento:</strong> Nos ayudan a entender cómo los visitantes interactúan con la web, recopilando información de forma anónima.</li>
              <li><strong>Cookies de Funcionalidad:</strong> Permiten que el sitio web recuerde las elecciones que haces (como tu nombre de usuario).</li>
            </ul>
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">3. Controlar las cookies</h2>
          <p className="mb-6">
            Puedes controlar y/o eliminar las cookies como desees. Puedes eliminar todas las cookies que ya están en tu ordenador y puedes configurar la mayoría de los navegadores para evitar que se instalen. Sin embargo, si haces esto, es posible que tengas que ajustar manualmente algunas preferencias cada vez que visites un sitio web y que algunos servicios y funcionalidades (como el acceso a tu cuenta) no funcionen.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
