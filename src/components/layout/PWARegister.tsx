"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable and updates itself.
export function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
