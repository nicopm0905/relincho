import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HorseImportDialog } from "@/components/horses/horse-import-dialog";
import {
  Horse,
  Heartbeat,
  UsersThree,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Primeros pasos de una yeguada recién creada.
 *
 * Acompaña las primeras semanas, mientras la yeguada todavía está arrancando:
 * con menos de tres caballos un panel lleno de estadísticas distrae y no
 * explica por dónde empezar.
 */
export function FirstSteps({ tenantSlug }: { tenantSlug: string }) {
  const steps = [
    {
      icon: <Horse />,
      title: "Registra tus caballos",
      body: "Añádelos uno a uno o importa tu Excel actual. Con el nombre y el microchip basta para empezar; el resto lo completas cuando lo necesites.",
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
      icon: <Heartbeat />,
      title: "Apunta el próximo cuidado",
      body: "Registra una vacuna, una visita del veterinario o una desparasitación. Relincho te avisará antes de que venza.",
      action: (
        <Button asChild size="sm" variant="outline">
          <Link href={`/${tenantSlug}/sanidad/nuevo`}>Registrar sanidad</Link>
        </Button>
      ),
    },
    {
      icon: <UsersThree />,
      title: "Invita a quien trabaja contigo",
      body: "Mozos, encargados y veterinarios pueden entrar con los permisos que tú decidas. No tienes que llevarlo todo solo.",
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
          Tu yeguada está lista para empezar
        </h2>
        <p className="text-[13.5px] text-muted-foreground">
          Empieza por lo que ya haces cada día. El resto se va llenando solo
          conforme trabajas; no hace falta configurarlo todo hoy.
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
        ¿Te atascas? Escríbenos y lo vemos contigo por teléfono, desde Jerez.
      </p>
    </Card>
  );
}
