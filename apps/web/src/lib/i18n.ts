import React, { createContext, useContext, useState } from 'react'

export type Lang = 'en' | 'hi'

const translations: Record<string, Record<Lang, string>> = {
  'nav.dashboard':       { en: 'Dashboard',       hi: 'डैशबोर्ड' },
  'nav.products':        { en: 'Products',         hi: 'उत्पाद' },
  'nav.inventory':       { en: 'Inventory',        hi: 'इन्वेंटरी' },
  'nav.billing':         { en: 'Billing',          hi: 'बिलिंग' },
  'nav.aiTools':         { en: 'AI Tools',         hi: 'AI टूल्स' },
  'nav.aiAssistant':     { en: 'AI Assistant',     hi: 'AI सहायक' },
  'nav.scanBill':        { en: 'Scan Bill',        hi: 'बिल स्कैन' },
  'nav.voice':           { en: 'Voice',            hi: 'आवाज़' },
  'nav.suppliers':       { en: 'Suppliers',        hi: 'सप्लायर' },
  'nav.purchaseOrders':  { en: 'Purchase Orders',  hi: 'खरीद ऑर्डर' },
  'nav.notifications':   { en: 'Notifications',    hi: 'सूचनाएं' },
  'nav.settings':        { en: 'Settings',         hi: 'सेटिंग्स' },
  'nav.help':            { en: 'Help / Feedback',  hi: 'सहायता / फीडबैक' },
  'btn.save':            { en: 'Save',             hi: 'सहेजें' },
  'btn.cancel':          { en: 'Cancel',           hi: 'रद्द करें' },
  'btn.delete':          { en: 'Delete',           hi: 'हटाएं' },
  'btn.edit':            { en: 'Edit',             hi: 'संपादित करें' },
  'btn.add':             { en: 'Add',              hi: 'जोड़ें' },
  'btn.confirm':         { en: 'Confirm',          hi: 'पुष्टि करें' },
  'btn.signOut':         { en: 'Sign out',         hi: 'साइन आउट' },
  'common.loading':      { en: 'Loading…',         hi: 'लोड हो रहा है…' },
  'common.noData':       { en: 'No data yet.',     hi: 'अभी कोई डेटा नहीं।' },
}

type I18nContext = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string }
const Ctx = createContext<I18nContext | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('lang') as Lang) ?? 'en'
  })

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  function t(key: string): string {
    return translations[key]?.[lang] ?? key
  }

  return React.createElement(Ctx.Provider, { value: { lang, setLang, t } }, children)
}

export function useTranslation() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTranslation must be inside LanguageProvider')
  return ctx
}
