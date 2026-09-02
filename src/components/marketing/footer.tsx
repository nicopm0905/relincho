import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-white border-t border-border/40 py-12 md:py-16">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        
        <div className="flex items-center gap-2 opacity-80">
          <Image src="/logo.png" alt="Relincho" width={24} height={24} className="grayscale opacity-60" />
          <span className="font-heading font-bold text-foreground">Relincho</span>
          <span className="text-muted-foreground text-sm ml-2">© {new Date().getFullYear()}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="/terminos" className="hover:text-foreground transition-colors">Términos</Link>
          <Link href="/privacidad" className="hover:text-foreground transition-colors">Privacidad</Link>
          <Link href="/cookies" className="hover:text-foreground transition-colors">Cookies</Link>
          <Link href="/contacto" className="hover:text-foreground transition-colors">Contacto</Link>
        </div>
        
      </div>
    </footer>
  );
}
