import { ClockCounterClockwise, DownloadSimple, GearSix, SquaresFour } from "@phosphor-icons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ComponentType } from "react";
import { inApp } from "./data";

export type View = "overview" | "updates" | "history" | "settings";

const tabs: { view: View; label: string; Icon: ComponentType<{ size?: number; weight?: "regular" | "fill"; "aria-hidden"?: "true" }> }[] = [
  { view: "overview", label: "Overview", Icon: SquaresFour },
  { view: "updates", label: "Updates", Icon: DownloadSimple },
  { view: "history", label: "History", Icon: ClockCounterClockwise },
  { view: "settings", label: "Settings", Icon: GearSix },
];

/** Ctrl+1 to Ctrl+4 open the views in tab order. */
export const viewOrder = tabs.map((tab) => tab.view);

/** Windows 11's caption glyphs, drawn on a 10 px grid. */
const glyphs = {
  minimize: <path d="M0 5.5h10" />,
  maximize: <rect x="0.5" y="0.5" width="9" height="9" />,
  restore: (
    <>
      <rect x="0.5" y="2.5" width="7" height="7" />
      <path d="M2.5 2.5v-2h7v7h-2" />
    </>
  ),
  close: <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />,
};

function Glyph({ name }: { name: keyof typeof glyphs }) {
  return <svg viewBox="0 0 10 10" aria-hidden="true">{glyphs[name]}</svg>;
}

/** Follows the window: Maximize turns into Restore, and the bar dims while another window has focus. */
function useWindowState() {
  const [maximized, setMaximized] = useState(false);
  const [focused, setFocused] = useState(true);
  useEffect(() => {
    if (!inApp) return;
    const appWindow = getCurrentWindow();
    const readMaximized = () => void appWindow.isMaximized().then(setMaximized);
    readMaximized();
    const listening = [appWindow.onResized(readMaximized), appWindow.onFocusChanged(({ payload }) => setFocused(payload))];
    return () => listening.forEach((unlisten) => void unlisten.then((stop) => stop()));
  }, []);
  return { maximized, focused };
}

/** The floating bar is also the window's title bar, so it can be dragged and holds the window buttons. */
export function Bar({ host, view, ready, onSelect }: { host: string; view: View; ready: number; onSelect(view: View): void }) {
  const row = useRef<HTMLElement>(null);
  const [lens, setLens] = useState<CSSProperties>({ opacity: 0 });
  const { maximized, focused } = useWindowState();

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
    <header className="bar" data-tauri-drag-region data-inactive={!focused || undefined}>
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
            <button className="window-button" aria-label="Minimize" onClick={() => void getCurrentWindow().minimize()}>
              <Glyph name="minimize" />
            </button>
            <button className="window-button" aria-label={maximized ? "Restore" : "Maximize"} onClick={() => void getCurrentWindow().toggleMaximize()}>
              <Glyph name={maximized ? "restore" : "maximize"} />
            </button>
            <button className="window-button" data-close aria-label="Close" onClick={() => void getCurrentWindow().close()}>
              <Glyph name="close" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
