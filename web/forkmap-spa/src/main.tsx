// T-39 — fork-map SPA entry (the sibling rearchitecture of web/forkmap/).

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./styles/views.css";
import "./styles/changes.css";
import "./styles/alignment.css";
import "./styles/journal.css";
import "./styles/configure.css";
import "./styles/study.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element missing");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
