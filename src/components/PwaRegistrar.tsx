"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Abaikan bila lingkungan browser menonaktifkan SW
      });
    }
  }, []);

  return null;
}
