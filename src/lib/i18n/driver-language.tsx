import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DRIVER_STRINGS, type DriverLang, type DriverStrings } from "./driver";

const STORAGE_KEY = "iab.driver.lang";

interface DriverLanguageValue {
  lang: DriverLang;
  setLang: (l: DriverLang) => void;
  t: DriverStrings;
  dir: "ltr" | "rtl";
}

const Ctx = createContext<DriverLanguageValue | null>(null);

export function DriverLanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<DriverLang>("en");

  // Read persisted preference after hydration so SSR output stays stable.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") setLangState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<DriverLanguageValue>(
    () => ({
      lang,
      setLang: (l) => {
        setLangState(l);
        try {
          window.localStorage.setItem(STORAGE_KEY, l);
        } catch {
          /* storage unavailable */
        }
      },
      t: DRIVER_STRINGS[lang],
      dir: lang === "ar" ? "rtl" : "ltr",
    }),
    [lang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDriverLang(): DriverLanguageValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDriverLang must be used inside DriverLanguageProvider");
  return ctx;
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useDriverLang();
  const base =
    "px-2.5 h-7 text-xs font-medium rounded-md transition-colors active:scale-[0.99]";
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-1 ${className}`}
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`${base} ${lang === "en" ? "bg-background text-foreground shadow-sm" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLang("ar")}
        aria-pressed={lang === "ar"}
        className={`${base} ${lang === "ar" ? "bg-background text-foreground shadow-sm" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}`}
      >
        العربية
      </button>
    </div>
  );
}
