import { LoginForm } from "@/components/auth/login-form";
import Image from "next/image";

export const metadata = { title: "Iniciar sesión — Relincho" };

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="mx-auto h-20 w-20 relative rounded-[24px] shadow-bento overflow-hidden flex items-center justify-center bg-white border border-border/40">
          <Image src="/logo.png" alt="Relincho" fill className="object-contain p-2" priority />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Relincho
          </h1>
          <p className="text-[15px] font-medium text-muted-foreground mt-1">
            Gestión equina para yeguadas PRE
          </p>
        </div>
      </div>
      <LoginForm />
    </div>
  );
}
