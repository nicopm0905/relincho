import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "Error de acceso — Relincho" };

export default function AuthErrorPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Error de acceso</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Ha ocurrido un error al iniciar sesión. El enlace puede haber expirado
          o ya ha sido usado.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Volver al inicio de sesión</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
