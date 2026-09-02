"use client";

import Image from "next/image";
import { Users, Target, Heart } from "lucide-react";
import { motion } from "framer-motion";

const values = [
  {
    title: "Conocimiento del terreno",
    description: "Al ser de Jerez, conocemos de primera mano las tierras, la cultura y lo que realmente necesita el mundo del caballo en su día a día.",
    icon: Heart,
  },
  {
    title: "Excelencia Técnica",
    description: "Desarrollamos software de primer nivel. Una plataforma rápida, segura y moderna que automatiza el trabajo pesado por ti.",
    icon: Target,
  },
  {
    title: "Bienestar Animal",
    description: "Aplicamos conocimientos de biomecánica y entrenamiento deportivo para asegurar que el seguimiento de los caballos sea el óptimo.",
    icon: Users,
  },
];

export function About() {
  return (
    <section id="nosotros" className="py-24 md:py-32 bg-white relative">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="order-2 lg:order-1"
          >
            <h2 className="font-heading text-4xl md:text-5xl text-foreground mb-6">
              ¿Quiénes Somos?
            </h2>
            <h3 className="text-xl text-foreground font-semibold mb-6">
              Dos jóvenes de Jerez uniendo tecnología y conocimiento ecuestre.
            </h3>
            <div className="space-y-6 text-lg text-muted-foreground">
              <p>
                Somos dos chavales de Jerez de la Frontera, una tierra donde el caballo es mucho más que una tradición. Haber crecido aquí nos ha permitido conocer de buena mano cómo funcionan las yeguadas y cuáles son sus problemas reales en el día a día.
              </p>
              <p>
                <strong>Relincho</strong> nace como la combinación perfecta de nuestras dos pasiones. Uno de nosotros es <strong>Ingeniero Informático del Software</strong>, encargado de toda la arquitectura técnica para que la plataforma sea moderna, rápida y segura.
              </p>
              <p>
                El otro está inmerso en estudios de <strong>Fisioterapia y Ciencias del Deporte</strong>. Gracias a esto, aportamos un conocimiento técnico profundo sobre la musculatura del caballo, su recuperación y los diferentes tipos de entrenamientos, trasladando todo ese rigor científico al software.
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="order-1 lg:order-2 relative aspect-square lg:aspect-[4/3] rounded-[2rem] overflow-hidden bg-[#f9f9f6] border border-border/50 flex items-center justify-center p-8 group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent transition-opacity group-hover:opacity-75"></div>
            <div className="text-center relative z-10">
              <div className="w-24 h-24 bg-[#222222] text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl transform transition-transform group-hover:scale-110 duration-500">
                <Heart strokeWidth={1.5} className="w-10 h-10" />
              </div>
              <h4 className="font-heading text-2xl text-foreground">Relincho Team</h4>
              <p className="text-muted-foreground mt-2">Hecho con pasión desde Jerez</p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {values.map((value, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="bg-[#f9f9f6] rounded-[2rem] p-8 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-2"
            >
              <div className="w-16 h-16 mx-auto bg-white border border-border/50 text-foreground rounded-full flex items-center justify-center mb-6 shadow-sm">
                <value.icon strokeWidth={2} className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-bold font-heading mb-4 text-foreground">{value.title}</h4>
              <p className="text-muted-foreground">{value.description}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
