import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";

export async function generateMetadata() {
  const t = await getTranslations("tenantPicker");
  return { title: t("metaTitle") };
}

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

  const t = await getTranslations("tenantPicker");

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <span className="relative mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <Image src="/logo.png" alt="Relincho" fill sizes="64px" className="object-contain p-2" priority />
          </span>
          <div className="space-y-1">
            <h1 className="font-serif text-title font-medium text-foreground">{t("title")}</h1>
            <p className="text-body text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <ul className="space-y-3">
          {memberships.map((m) => (
            <li key={m.id}>
              <Link
                href={`/${m.tenant.slug}/inicio`}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-raised"
              >
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-serif text-heading font-medium text-primary-ink"
                >
                  {m.tenant.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-foreground">{m.tenant.name}</span>
                  <span className="block text-label text-muted-foreground">{t(`roles.${m.role}`)}</span>
                </span>
                <CaretRight
                  aria-hidden
                  weight="bold"
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
