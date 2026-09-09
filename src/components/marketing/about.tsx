"use client";

import { Users, Target, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const values = [
  { key: "local", icon: Heart },
  { key: "tech", icon: Target },
  { key: "welfare", icon: Users },
] as const;

export function About() {
  const t = useTranslations("marketing.about");
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

  return (
    <section id="nosotros" className="relative overflow-hidden bg-white py-20 md:py-32">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6">

        <div className="mb-16 grid grid-cols-1 items-center gap-10 md:mb-24 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="lg:order-1"
          >
            <h2 className="font-heading text-4xl md:text-5xl text-foreground mb-6">
              {t("title")}
            </h2>
            <h3 className="text-xl text-foreground font-semibold mb-6">
              {t("subtitle")}
            </h3>
            <div className="space-y-6 text-lg text-muted-foreground">
              <p>{t("p1")}</p>
              <p>{t.rich("p2", { strong })}</p>
              <p>{t.rich("p3", { strong })}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="group relative flex aspect-[4/3] max-h-[300px] items-center justify-center overflow-hidden rounded-[2rem] border border-border/50 bg-[#f9f9f6] p-8 lg:order-2 lg:max-h-none"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent transition-opacity group-hover:opacity-75"></div>
            <div className="text-center relative z-10">
              <div className="w-24 h-24 bg-[#222222] text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl transform transition-transform group-hover:scale-110 duration-500">
                <Heart strokeWidth={1.5} className="w-10 h-10" />
              </div>
              <h4 className="font-heading text-2xl text-foreground">{t("cardTitle")}</h4>
              <p className="text-muted-foreground mt-2">{t("cardSubtitle")}</p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {values.map((value, i) => (
            <motion.div
              key={value.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="bg-[#f9f9f6] rounded-[2rem] p-8 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-2"
            >
              <div className="w-16 h-16 mx-auto bg-white border border-border/50 text-foreground rounded-full flex items-center justify-center mb-6 shadow-sm">
                <value.icon strokeWidth={2} className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-bold font-heading mb-4 text-foreground">
                {t(`values.${value.key}.title`)}
              </h4>
              <p className="text-muted-foreground">
                {t(`values.${value.key}.description`)}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
