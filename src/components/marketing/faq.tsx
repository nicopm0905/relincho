"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  {
    question: "¿Qué es Relincho y para quién está pensado?",
    answer:
      "Relincho es un software integral de gestión diseñado para yeguadas, centros ecuestres, hípicas y profesionales del sector equino que buscan digitalizar y simplificar su día a día. Desde la sanidad hasta la facturación, todo en una sola plataforma.",
  },
  {
    question: "¿Necesito conocimientos técnicos para usar la plataforma?",
    answer:
      "En absoluto. Hemos diseñado Relincho con una interfaz limpia, intuitiva y fácil de usar. Nuestro objetivo es que cualquier persona pueda empezar a gestionar sus caballos desde el primer minuto, sin necesidad de manuales complejos.",
  },
  {
    question: "¿Están mis datos y los de mis clientes seguros?",
    answer:
      "Sí. Utilizamos los más altos estándares de seguridad en la nube. Tus datos y los de tus clientes están encriptados y realizamos copias de seguridad automáticas de forma constante para que nunca pierdas información importante.",
  },
  {
    question: "¿Cumple con la normativa de facturación y Veri*Factu?",
    answer:
      "Totalmente. Nuestro módulo de facturación está actualizado y adaptado a las nuevas normativas de la AEAT (incluyendo Veri*Factu). Puedes emitir facturas legales, generar cuotas automáticas y automatizar el envío de recibos SEPA sin preocupaciones.",
  },
  {
    question: "¿Puedo probar Relincho antes de suscribirme?",
    answer:
      "¡Por supuesto! Entendemos que quieres asegurarte de que Relincho es la herramienta perfecta para ti. Ofrecemos una prueba donde podrás explorar todas las funcionalidades clave y descubrir cómo podemos ayudarte a optimizar tu centro ecuestre.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-24 md:py-32 bg-[#f9f9f6] relative overflow-hidden">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16 md:mb-20"
        >
          <h2 className="font-heading text-4xl md:text-5xl text-foreground mb-6">
            Preguntas Frecuentes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Resolvemos tus dudas sobre cómo Relincho puede ayudar a transformar y facilitar la gestión diaria de tus caballos.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border border-border/50 transition-shadow duration-500 hover:shadow-2xl"
        >
          <Accordion className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b border-border/50 last:border-0">
                <AccordionTrigger className="text-left text-lg font-semibold py-6 hover:no-underline hover:text-primary transition-colors group">
                  <span className="group-hover:translate-x-1 transition-transform duration-300">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
