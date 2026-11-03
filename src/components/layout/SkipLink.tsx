"use client";

import { useLang } from "@/lib/i18n";

// «Негізгі мазмұнға өту» сілтемесі — тек пернетақта фокусында көрінеді (WCAG 2.4.1).
// Клиент компоненті: мәтіні таңдалған тілден (useLang) алынады.
export function SkipLink() {
  const { t } = useLang();
  return (
    <a href="#main" className="skip-link">
      {t("site.skip")}
    </a>
  );
}
