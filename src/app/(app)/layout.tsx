import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { loginUrlForCurrentPage } from "@/lib/auth-redirect";

import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect(await loginUrlForCurrentPage());
  }
  return <>{children}</>;
}
