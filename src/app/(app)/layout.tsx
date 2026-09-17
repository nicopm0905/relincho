import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { loginUrlForCurrentPage } from "@/lib/auth-redirect";
import { isDemoTenant, tenantSlugFromPath } from "@/lib/demo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    // La yeguada de demostracion se abre a quien llega sin cuenta; el resto de
    // la app sigue pidiendo sesion.
    const path = (await headers()).get("x-requested-path");
    if (!isDemoTenant(tenantSlugFromPath(path))) {
      redirect(await loginUrlForCurrentPage());
    }
  }
  return <>{children}</>;
}
