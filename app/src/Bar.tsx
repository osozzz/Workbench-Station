import { ClockCounterClockwise, CornersOut, DownloadSimple, GearSix, Minus, SquaresFour, X } from "@phosphor-icons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ComponentType } from "react";
import { inApp } from "./data";

export type View = "overview" | "updates" | "history" | "settings";

const tabs: { view: View; label: string; Icon: ComponentType<{ size?: number; weight?: "regular" | "fill"; "aria-hidden"?: "true" }> }[] = [
  { view: "overview", label: "Overview", Icon: SquaresFour },
  { view: "updates", label: "Updates", Icon: DownloadSimple },
  { view: "history", label: "History", Icon: ClockCounterClockwise },
  { view: "settings", label: "Settings", Icon: GearSix },
];

/** The floating bar is also the window's title bar, so it can be dragged and holds the window buttons. */
export function Bar({ host, view, ready, onSelect }: { host: string; view: View; ready: number; onSelect(view: View): void }) {
  const row = useRef<HTMLElement>(null);
  const [lens, setLens] = useState<CSSProperties>({ opacity: 0 });

  // The droplet follows the current tab; its size comes from the tab, which depends on the font and the count.
  useLayoutEffect(() => {
    const measure = () => {
      const tab = row.current?.querySelector<HTMLElement>('[aria-current="page"]');
      if (tab) setLens({ "--x": `${tab.offsetLeft}px`, "--w": `${tab.offsetWidth}px` } as CSSProperties);
    };
    measure();
    void document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, ready]);

  return (
    <header className="bar" data-tauri-drag-region>
      <div className="bar-host" data-tauri-drag-region>
        <span className="app-mark" aria-hidden="true" />
        <span data-tauri-drag-region>{host}</span>
      </div>
      <nav className="tabs" ref={row} aria-label="Sections">
        <span className="tabs-lens" style={lens} aria-hidden="true" />
        {tabs.map(({ view: target, label, Icon }) => (
          <button key={target} className="tab" aria-label={label} title={label} aria-current={view === target ? "page" : undefined} onClick={() => onSelect(target)}>
            <Icon size={18} weight={view === target ? "fill" : "regular"} aria-hidden="true" />
            <span>{label}</span>
            {target === "updates" && ready > 0 && <b>{ready}</b>}
          </button>
        ))}
      </nav>
      <div className="bar-window">
        {inApp && (
          <>
            <button className="window-button" aria-label="Minimize" onClick={() => void getCurrentWindow().minimize()}><Minus size={16} /></button>
            <button className="window-button" aria-label="Maximize" onClick={() => void getCurrentWindow().toggleMaximize()}><CornersOut size={16} /></button>
            <button className="window-button" data-close aria-label="Close" onClick={() => void getCurrentWindow().close()}><X size={16} /></button>
          </>
        )}
      </div>
    </header>
  );
}
