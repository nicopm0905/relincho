"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

type FaqItem = { question: string; answer: string };

export function Faq() {
  const t = useTranslations("marketing.faq");
  const faqs = t.raw("items") as FaqItem[];

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
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
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
