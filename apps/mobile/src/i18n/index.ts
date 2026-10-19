import * as Localization from "expo-localization";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/common.json";
import ptBR from "./locales/pt-BR/common.json";

const deviceLocale = Localization.getLocales()[0]?.languageTag ?? "en";
const supportedLng = deviceLocale.toLowerCase().startsWith("pt") ? "pt-BR" : "en";

void i18next.use(initReactI18next).init({
  resources: {
    en: { common: en },
    "pt-BR": { common: ptBR },
  },
  lng: supportedLng,
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export default i18next;
