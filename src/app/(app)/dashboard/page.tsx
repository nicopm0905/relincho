import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { redirect } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { tenant: true },
    orderBy: { tenant: { createdAt: "asc" } },
  });

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  if (memberships.length === 1) {
    redirect(`/${memberships[0].tenant.slug}/inicio`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center space-y-3">
          <div className="mx-auto h-20 w-20 relative rounded-[24px] shadow-bento overflow-hidden flex items-center justify-center bg-white border border-border/40">
            <Image src="/logo.png" alt="Relincho" fill className="object-contain p-2" priority />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-heading">
              Tus fincas
            </h1>
            <p className="text-[15px] font-medium text-muted-foreground mt-1">
              Selecciona la ganadería a gestionar
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {memberships.map((m) => (
            <a
              key={m.id}
              href={`/${m.tenant.slug}/inicio`}
              className="group flex items-center justify-between p-5 rounded-3xl bg-white shadow-bento border border-border/40 hover:scale-[1.03] hover:shadow-lg hover:border-border/60 active:scale-[0.98] transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-foreground font-bold text-lg font-heading">
                    {m.tenant.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="font-bold text-foreground text-[15px] font-heading">{m.tenant.name}</div>
                  <div className="text-[13px] font-medium text-muted-foreground capitalize mt-0.5">
                    {m.role.toLowerCase()}
                  </div>
                </div>
              </div>
              <CaretRight className="h-6 w-6 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-foreground group-hover:translate-x-1 transition-all duration-300" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
