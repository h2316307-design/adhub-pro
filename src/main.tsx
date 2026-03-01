import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { prefetchInvoiceSettings } from "@/hooks/useInvoiceSettingsSync";

// Prefetch invoice settings early for faster print dialogs
prefetchInvoiceSettings();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
