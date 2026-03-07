import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { prefetchInvoiceSettings } from "@/hooks/useInvoiceSettingsSync";

// ✅ Fix: Override ar-LY locale for numbers to use en-US formatting
// This ensures comma (,) is used as thousands separator instead of dot (.)
const _origToLocaleString = Number.prototype.toLocaleString;
Number.prototype.toLocaleString = function (locale?: any, options?: any) {
  if (locale === 'ar-LY') {
    return _origToLocaleString.call(this, 'en-US', options);
  }
  return _origToLocaleString.call(this, locale, options);
};

// Prefetch invoice settings early for faster print dialogs
prefetchInvoiceSettings();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
