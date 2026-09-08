import { Folders, Wrench, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Documentos — ${tenantSlug}` };
}

export default async function DocumentosPage({ params }: PageProps) {
  const { tenantSlug } = await params;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-in fade-in-0 duration-500">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-50" />
        <div className="h-28 w-28 rounded-full bg-blue-50 border-4 border-blue-100 flex items-center justify-center relative z-10 mx-auto shadow-sm">
          <Folders weight="duotone" className="h-14 w-14 text-blue-600" />
        </div>
        <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-amber-100 rounded-full border-2 border-white flex items-center justify-center z-20 shadow-sm">
          <Wrench weight="fill" className="h-5 w-5 text-amber-600" />
        </div>
      </div>
      
      <h1 className="text-[26px] sm:text-3xl font-black font-heading tracking-tight text-foreground mb-4">
        Gestor Documental en Construcción
      </h1>
      <p className="text-lg text-muted-foreground max-w-md mx-auto mb-8 font-medium">
        Próximamente podrás subir contratos, analíticas, radiografías y pasaportes directamente a la nube de tu yeguada, todo organizado por carpetas y caballos.
      </p>
      
      <div className="flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
        <Button asChild size="lg" className="shadow-sm">
          <Link href={`/${tenantSlug}/caballos`}>Ir a mis caballos</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="shadow-sm">
          <Link href={`/${tenantSlug}/facturacion`}>
            Ir a facturación <ArrowRight weight="bold" className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
