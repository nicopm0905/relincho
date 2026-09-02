import { Activity, Baby, Receipt, Layers, HeartPulse } from "lucide-react";

const features = [
  {
    title: "Sanidad y Controles",
    description: "Registra vacunas, desparasitaciones y tratamientos. Nunca olvides una fecha importante gracias a las alertas automáticas.",
    icon: HeartPulse,
    className: "md:col-span-2 bg-[#f9f9f6]", // Light cream
  },
  {
    title: "Control Reproductivo",
    description: "Seguimiento de celos, inseminaciones, ecografías y partos con cálculos predictivos.",
    icon: Baby,
    className: "md:col-span-1 bg-white border border-border/50", 
  },
  {
    title: "Pupilaje y Estancias",
    description: "Gestiona los boxes, dietas y tarifas de caballos estabulados de clientes.",
    icon: Layers,
    className: "md:col-span-1 bg-white border border-border/50",
  },
  {
    title: "Facturación Veri*Factu",
    description: "Emite facturas legales, genera cuotas automáticas y envía recibos SEPA. Todo adaptado a la nueva normativa de la AEAT.",
    icon: Receipt,
    className: "md:col-span-2 bg-[#222222] text-white", // Dark charcoal for contrast
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32 bg-white relative">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6">
        
        <div className="max-w-2xl mb-16 md:mb-24">
          <h2 className="font-heading text-4xl md:text-6xl text-foreground mb-6">
            Todo lo que necesitas. <br/> Y nada más.
          </h2>
          <p className="text-lg text-muted-foreground">
            Hemos eliminado el ruido para que puedas centrarte en lo que de verdad importa: tus caballos. Relincho simplifica tu día a día.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`p-8 md:p-10 rounded-[2rem] flex flex-col justify-between overflow-hidden shadow-sm transition-transform duration-300 hover:scale-[1.02] ${feature.className}`}
            >
              <div className="mb-8 md:mb-16">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-6 ${
                  feature.className.includes('bg-[#222222]') 
                    ? 'bg-white/10 text-white' 
                    : 'bg-white shadow-sm border border-border/50 text-foreground'
                }`}>
                  <feature.icon strokeWidth={2} className="h-5 w-5" />
                </div>
                <h3 className={`text-2xl font-bold font-heading mb-3 ${
                  feature.className.includes('bg-[#222222]') ? 'text-white' : 'text-foreground'
                }`}>
                  {feature.title}
                </h3>
                <p className={`text-base leading-relaxed ${
                  feature.className.includes('bg-[#222222]') ? 'text-white/70' : 'text-muted-foreground'
                }`}>
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
      </div>
    </section>
  );
}
