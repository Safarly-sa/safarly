import { useTranslation } from "@/providers/I18nProvider";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StubPageProps {
  id: string;
  icon: LucideIcon;
}

export function StubPage({ id, icon: Icon }: StubPageProps) {
  const { t, language } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-20 pb-24">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center shadow-[0_12px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)] relative overflow-hidden"
      >
        <div className="absolute top-0 start-0 w-full h-1 bg-gradient-to-r from-accent to-indigo" />
        
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 text-primary">
          <Icon className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t(`page.${id}.title`)}
        </h1>
        
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {t(`page.${id}.desc`)}
        </p>

        <div className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-border bg-muted/50">
          <div className="w-2 h-2 rounded-full bg-accent me-2 animate-pulse" />
          <span className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            {language === "en" ? "Coming Soon" : "قريبًا"}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
