import "@fontsource-variable/schibsted-grotesk";
import "@fontsource/fragment-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// A desktop app, not a page: no browser menu, and none of the browser's reload, print, find, view-source,
// new-window or history keys. Development keeps the menu for Inspect.
if (import.meta.env.PROD) window.addEventListener("contextmenu", (event) => event.preventDefault());
const browserKeys = new Set(["F3", "F5", "F7", "BrowserBack", "BrowserForward", "BrowserRefresh", "BrowserSearch"]);
window.addEventListener(
  "keydown",
  (event) => {
    const ctrl = event.ctrlKey || event.metaKey;
    const history = event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight");
    if (browserKeys.has(event.key) || history || (ctrl && /^[fghjnoprsu]$/i.test(event.key))) event.preventDefault();
  },
  { capture: true },
);
// The mouse's back and forward buttons.
for (const type of ["mousedown", "mouseup"] as const) {
  window.addEventListener(type, (event) => {
    if (event.button === 3 || event.button === 4) event.preventDefault();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
