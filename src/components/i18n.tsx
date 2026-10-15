'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Languages } from 'lucide-react';
import { greekTranslations } from '@/lib/messages';
export type Language = 'en' | 'el';
type I18n = {
  language: Language;
  setLanguage: (value: Language) => void;
  t: (text: string) => string;
};
const Context = createContext<I18n>({ language: 'en', setLanguage: () => {}, t: (text) => text });
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('agentrelay.language.v1');
      if (stored === 'el' || stored === 'en') setLanguage(stored);
    } catch {
      /* Storage can be unavailable in restricted browsing modes. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const change = useCallback((next: Language) => {
    setLanguage(next);
    try {
      localStorage.setItem('agentrelay.language.v1', next);
    } catch {
      /* The current tab still supports switching languages. */
    }
  }, []);
  const t = useCallback(
    (text: string) => (language === 'el' ? greekTranslations[text] || text : text),
    [language],
  );
  return (
    <Context.Provider value={{ language, setLanguage: change, t }}>{children}</Context.Provider>
  );
}
export const useI18n = () => useContext(Context);
export function LanguageSwitch() {
  const { language, setLanguage, t } = useI18n();
  return (
    <label className="language-switch">
      <Languages size={15} />
      <select
        aria-label={t('Interface language')}
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
      >
        <option value="en">English</option>
        <option value="el">Ελληνικά</option>
      </select>
    </label>
  );
}
