import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    description: "Perfecto para yeguadas pequeñas o picaderos que están empezando.",
    price: "29",
    features: [
      "Hasta 20 caballos",
      "Control de Sanidad y Reproducción",
      "Facturación básica",
      "Soporte por email",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    description: "Para negocios establecidos que necesitan automatización total.",
    price: "79",
    features: [
      "Caballos ilimitados",
      "Pupilajes y Contratos",
      "Facturación avanzada (AEAT Veri*Factu)",
      "Gestión de empleados",
      "Soporte prioritario 24/7",
    ],
    highlighted: true,
  }
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32 bg-[#f9f9f6]">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6">
        
        <div className="text-center max-w-2xl mx-auto mb-16 md:mb-24">
          <h2 className="font-heading text-4xl md:text-5xl text-foreground mb-6">
            Precios simples. <br /> Sin sorpresas.
          </h2>
          <p className="text-lg text-muted-foreground">
            Escoge el plan que mejor se adapte a tu ganadería. <br className="hidden md:block" /> 
            Puedes cambiar de plan o cancelar en cualquier momento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={`relative flex flex-col p-8 md:p-10 rounded-[2rem] bg-white transition-all duration-300 hover:shadow-bento ${
                plan.highlighted 
                  ? "border-2 border-primary shadow-sm" 
                  : "border border-border/50"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                  Recomendado
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="text-2xl font-bold font-heading mb-2 text-foreground">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>
              
              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-bold font-heading text-foreground">
                    {plan.price}€
                  </span>
                  <span className="text-muted-foreground font-medium">/mes</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                asChild 
                variant={plan.highlighted ? "default" : "outline"} 
                className={`w-full rounded-full h-12 text-base ${plan.highlighted ? 'hover:bg-[#8b9e3a]' : 'hover:bg-muted/50'}`}
              >
                <Link href="/login">
                  {plan.highlighted ? "Empezar prueba gratis" : "Seleccionar Starter"}
                </Link>
              </Button>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
