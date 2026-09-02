import { auth } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";

export const metadata = {
  title: "Política de Privacidad - Relincho",
};

export default async function PrivacidadPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/20 bg-white">
      <Header session={session} />
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 sm:px-6 py-32 md:py-40">
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
          Política de Privacidad
        </h1>
        
        <div className="prose prose-slate max-w-none text-muted-foreground prose-headings:font-heading prose-headings:text-foreground">
          <p className="lead text-lg mb-8">
            Última actualización: {new Date().toLocaleDateString('es-ES')}
          </p>
          
          <h2 className="text-2xl font-bold mt-12 mb-4">1. Información que recopilamos</h2>
          <p className="mb-6">
            En Relincho, recopilamos información para proporcionar mejores servicios a todos nuestros usuarios. Esto incluye:
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li>Información personal que nos proporcionas (nombre, correo electrónico, datos de facturación).</li>
              <li>Datos de tus caballos, instalaciones y clientes que introduces en el software.</li>
              <li>Información de uso de la plataforma y cookies (ver Política de Cookies).</li>
            </ul>
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">2. Cómo utilizamos tus datos</h2>
          <p className="mb-6">
            Utilizamos la información recopilada para:
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li>Proveer, mantener y mejorar nuestro software de gestión.</li>
              <li>Procesar tus pagos de suscripción.</li>
              <li>Enviarte notificaciones importantes sobre el servicio y soporte técnico.</li>
              <li>Cumplir con la normativa legal vigente (incluyendo leyes de facturación).</li>
            </ul>
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">3. Compartir tus datos</h2>
          <p className="mb-6">
            No vendemos tus datos personales a terceros. Solo compartimos información con proveedores de servicios esenciales (como plataformas de pago y alojamiento en la nube) que cumplen con los estándares de seguridad RGPD, y cuando lo exija la ley.
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">4. Seguridad de los datos</h2>
          <p className="mb-6">
            Tus datos están encriptados y almacenados en servidores seguros. Realizamos copias de seguridad regulares para garantizar la integridad y disponibilidad de la información de tu yeguada o centro ecuestre.
          </p>
          
          <h2 className="text-2xl font-bold mt-12 mb-4">5. Tus derechos</h2>
          <p className="mb-6">
            Tienes derecho a acceder, rectificar o eliminar tus datos personales en cualquier momento. Para ejercer estos derechos, contacta con nosotros en privacidad@relincho.com.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
