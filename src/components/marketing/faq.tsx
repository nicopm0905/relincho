import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqItem = { question: string; answer: string };

/**
 * Sin animacion de entrada: la seccion se abre desde el enlace /#faq del
 * header y antes aparecia en blanco hasta que framer-motion se hidrataba.
 */
export async function Faq() {
  const t = await getTranslations("marketing.faq");
  const faqs = t.raw("items") as FaqItem[];

  return (
    <section id="faq" className="bg-background py-20 md:py-28">
      <div className="container mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="mb-4 font-heading text-3xl text-foreground sm:text-4xl md:text-5xl">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
          <div className="relative mt-8 hidden aspect-[4/3] overflow-hidden rounded-3xl shadow-bento lg:block">
            <Image
              src="/landing/box.jpg"
              alt=""
              fill
              sizes="440px"
              className="object-cover"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card px-6 py-2 shadow-bento sm:px-8">
          <Accordion className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-b border-border/60 last:border-0"
              >
                <AccordionTrigger className="py-5 text-left text-base font-semibold transition-colors hover:text-primary-ink hover:no-underline sm:text-lg">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
