import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }
  return (
    <div className="brand-serif relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(142_166_68_/_0.12),transparent_32rem)]" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
