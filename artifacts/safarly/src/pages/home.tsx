import { useTranslation } from "@/providers/I18nProvider";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  MapPin, 
  MessageCircle, 
  Camera, 
  Languages, 
  Compass, 
  ArrowRight,
  Globe
} from "lucide-react";

export function Home() {
  const { t } = useTranslation();

  const features = [
    { id: "planner", icon: MapPin, titleKey: "feature.planner.title", descKey: "feature.planner.desc" },
    { id: "dialect", icon: MessageCircle, titleKey: "feature.dialect.title", descKey: "feature.dialect.desc" },
    { id: "lens", icon: Camera, titleKey: "feature.lens.title", descKey: "feature.lens.desc" },
    { id: "translation", icon: Languages, titleKey: "feature.translation.title", descKey: "feature.translation.desc" },
    { id: "guides", icon: Compass, titleKey: "feature.guides.title", descKey: "feature.guides.desc" },
  ];

  const agentChips = [
    "agents.chips.goal",
    "agents.chips.discovery",
    "agents.chips.restaurant",
    "agents.chips.budget",
    "agents.chips.culture",
    "agents.chips.safety",
    "agents.chips.sustainability",
    "agents.chips.verification"
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden px-4">
        {/* Subtle geometric background shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-[0.03] dark:opacity-5">
          <svg viewBox="0 0 800 800" className="w-[150%] h-[150%] md:w-full md:h-full text-foreground animate-spin-slow" style={{ animationDuration: '120s' }}>
            <circle cx="400" cy="400" r="300" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="10 20" />
            <polygon points="400,150 616,525 184,525" fill="none" stroke="currentColor" strokeWidth="1" />
            <polygon points="400,650 184,275 616,275" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-accent font-arabic font-bold text-lg mb-4 tracking-wider">
              {t("hero.greeting")}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-[-0.02em] leading-tight mb-6 text-foreground">
              {t("hero.headline")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              {t("hero.subtext")}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/onboarding" 
                className="w-full sm:w-auto px-8 py-4 bg-accent hover:bg-accent-hover text-[#0A0E16] rounded font-semibold text-lg transition-colors shadow-[0_0_20px_rgba(0,216,164,0.3)] hover:shadow-[0_0_30px_rgba(0,216,164,0.5)] flex items-center justify-center gap-2"
              >
                {t("cta.start")}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </Link>
              <Link 
                href="/lens" 
                className="w-full sm:w-auto px-8 py-4 border border-indigo text-indigo hover:bg-indigo hover:text-white rounded font-semibold text-lg transition-colors flex items-center justify-center gap-2"
              >
                {t("cta.howItWorks")}
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 start-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground opacity-50 hidden md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1, duration: 1 }}
        >
          <div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-current to-transparent animate-pulse" />
        </motion.div>
      </section>

      {/* 2. Feature Cards */}
      <section className="py-20 bg-muted/30 px-4 border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group p-6 rounded-lg bg-card border border-border hover:border-indigo hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <feature.icon className="w-8 h-8 text-indigo mb-4 relative z-10" />
                <h3 className="text-xl font-bold mb-2 text-foreground relative z-10">{t(feature.titleKey)}</h3>
                <p className="text-muted-foreground relative z-10">{t(feature.descKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Agents at Work Strip */}
      <section className="py-16 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-8">
            {t("agents.title")}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {agentChips.map((chipKey, i) => (
              <motion.div
                key={chipKey}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="px-4 py-2 rounded bg-secondary border border-secondary-border text-sm font-semibold text-foreground whitespace-nowrap"
              >
                {t(chipKey)}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section className="py-24 px-4 bg-muted/20 relative">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t("how.title")}</h2>
          
          <div className="relative border-s-2 border-border ms-4 md:ms-8 space-y-12">
            {[1, 2, 3].map((step, i) => (
              <motion.div 
                key={step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.2 }}
                className="relative ps-8"
              >
                <div className="absolute -start-[9px] top-1.5 w-4 h-4 rounded-full bg-accent border-[3px] border-background shadow-[0_0_10px_rgba(0,216,164,0.5)]" />
                <h3 className="text-xl font-bold mb-2">
                  <span className="text-accent text-sm me-2 font-mono">0{step}</span>
                  {t(`how.step${step}`)}
                </h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Vision 2030 Alignment Band */}
      <section className="w-full py-8 bg-muted border-y border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-4 relative z-10 text-center">
          <Globe className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm md:text-base font-medium text-foreground max-w-2xl">
            {t("vision.text")}
          </p>
        </div>
      </section>

      {/* 6. Final CTA */}
      <section className="py-32 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight text-foreground">
            {t("hero.headline")}
          </h2>
          <Link 
            href="/onboarding" 
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent hover:bg-accent-hover text-[#0A0E16] rounded font-semibold text-lg transition-colors shadow-[0_0_20px_rgba(0,216,164,0.3)] hover:shadow-[0_0_30px_rgba(0,216,164,0.5)]"
          >
            {t("cta.start")}
            <ArrowRight className="w-5 h-5 rtl:rotate-180" />
          </Link>
        </div>
      </section>
    </div>
  );
}
