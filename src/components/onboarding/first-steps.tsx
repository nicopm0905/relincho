import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HorseImportDialog } from "@/components/horses/horse-import-dialog";
import { Horse, Receipt, UsersThree, CheckCircle } from "@phosphor-icons/react/dist/ssr";

/**
 * Primeros pasos de una yeguada recién creada.
 *
 * Es lo primero que ve alguien que acaba de registrarse y lo único que se
 * muestra cuando todavía no hay caballos: en la primera semana se gana o se
 * pierde la cuenta, y un panel vacío no explica por dónde empezar.
 */
export function FirstSteps({ tenantSlug }: { tenantSlug: string }) {
  const steps = [
    {
      icon: <Horse weight="duotone" />,
      title: "Registra tus caballos",
      body: "Uno a uno o importando tu Excel actual. Con el microchip y el UELN ya tienes ficha y QR para el box.",
      action: (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/${tenantSlug}/caballos/nuevo`}>Añadir caballo</Link>
          </Button>
          <HorseImportDialog triggerVariant="ghost" />
        </div>
      ),
    },
    {
      icon: <Receipt weight="duotone" />,
      title: "Revisa tus datos fiscales",
      body: "Nombre fiscal, NIF y serie de facturas: es lo que sale impreso en cada factura de pupilaje.",
      action: (
        <Button asChild size="sm" variant="outline">
          <Link href={`/${tenantSlug}/ajustes`}>Abrir ajustes</Link>
        </Button>
      ),
    },
    {
      icon: <UsersThree weight="duotone" />,
      title: "Invita a quien trabaja contigo",
      body: "Mozos, encargados y veterinarios con permisos distintos, y el propietario de cada caballo con su portal.",
      action: (
        <Button asChild size="sm" variant="outline">
          <Link href={`/${tenantSlug}/ajustes`}>Invitar al equipo</Link>
        </Button>
      ),
    },
  ];

  return (
    <Card className="space-y-5 p-5">
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-bold text-foreground">
          Tu yeguada está creada
        </h2>
        <p className="text-[13.5px] text-muted-foreground">
          Con estos tres pasos queda montada. El resto se va llenando solo
          conforme trabajas.
        </p>
      </div>

      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">
              {step.icon}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[13.5px] font-semibold text-foreground">
                <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
                {step.title}
              </p>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
              <div>{step.action}</div>
            </div>
          </li>
        ))}
      </ol>

      <p className="flex items-center gap-1.5 border-t border-border/60 pt-4 text-[12.5px] text-muted-foreground">
        <CheckCircle weight="fill" className="h-4 w-4 text-emerald-600" />
        ¿Te atascas? Escríbenos y lo hacemos contigo por teléfono.
      </p>
    </Card>
  );
}
