import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";

export const metadata = { title: "Revisa tu correo — Relincho" };

export default function VerifyPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
          <EnvelopeSimple weight="duotone" className="h-6 w-6 text-neutral-600" />
        </div>
        <CardTitle>Revisa tu correo</CardTitle>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        <p>
          Te hemos enviado un enlace mágico. Haz clic en él para iniciar sesión
          en Relincho.
        </p>
        <p className="mt-2">Puedes cerrar esta pestaña.</p>
      </CardContent>
    </Card>
  );
}
