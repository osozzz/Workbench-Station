import { CaretRight, FolderOpen, HardDrives } from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { describeFailure, inApp, listDrives, loadSpace, pickFolder, scanSpace, type AppError, type SpaceNode, type SpaceScan } from "../data";
import { describeAge, language, t, tn } from "../i18n";
import { Cleanup } from "./Cleanup";

const units = ["B", "KB", "MB", "GB", "TB"];

/** Bytes as Windows shows them: 1024-based, one decimal below 10. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit > 0 && value < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(language(), { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

const isDrive = (path: string) => /^[A-Za-z]:\\$/.test(path);

type TileKind = "folder" | "files" | "other" | "system";
interface Tile {
  key: string;
  label: string;
  bytes: number;
  kind: TileKind;
  node?: SpaceNode;
}
interface Placed extends Tile {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A folder and, while it holds only one folder and almost nothing else, that folder too. */
function chainOf(node: SpaceNode): SpaceNode[] {
  const chain = [node];
  let last = node;
  while (last.children.length === 1 && last.children[0].bytes >= last.bytes * 0.9) {
    last = last.children[0];
    chain.push(last);
  }
  return chain;
}

/** A placed tile as CSS percentages of the area it was laid out in. */
const box = (tile: Placed, width: number, height: number) => ({
  left: `${(tile.x / width) * 100}%`,
  top: `${(tile.y / height) * 100}%`,
  width: `${(tile.w / width) * 100}%`,
  height: `${(tile.h / height) * 100}%`,
});

/** A share of the shown total, like 54% or 0.8%. */
const formatShare = (share: number) =>
  new Intl.NumberFormat(language(), { style: "percent", maximumFractionDigits: share < 0.1 ? 1 : 0 }).format(share);

/** Squarified treemap: fills rows along the short side while that keeps the tiles closest to squares. */
function squarify(tiles: Tile[], width: number, height: number): Placed[] {
  const placed: Placed[] = [];
  let rest = tiles.filter((tile) => tile.bytes > 0);
  let total = rest.reduce((sum, tile) => sum + tile.bytes, 0);
  let [x, y, w, h] = [0, 0, width, height];
  const worst = (row: Tile[], side: number, scale: number) => {
    const areas = row.map((tile) => tile.bytes * scale);
    const sum = areas.reduce((a, b) => a + b, 0);
    return Math.max((side * side * Math.max(...areas)) / (sum * sum), (sum * sum) / (side * side * Math.min(...areas)));
  };
  while (rest.length > 0 && w > 0 && h > 0) {
    const side = Math.min(w, h);
    const scale = (w * h) / total;
    const row = [rest[0]];
    let best = worst(row, side, scale);
    while (row.length < rest.length) {
      const next = worst([...row, rest[row.length]], side, scale);
      if (next > best) break;
      row.push(rest[row.length]);
      best = next;
    }
    const rowBytes = row.reduce((sum, tile) => sum + tile.bytes, 0);
    const thick = (rowBytes * scale) / side;
    let offset = 0;
    for (const tile of row) {
      const length = (tile.bytes * scale) / thick;
      placed.push(w >= h ? { ...tile, x, y: y + offset, w: thick, h: length } : { ...tile, x: x + offset, y, w: length, h: thick });
      offset += length;
    }
    if (w >= h) {
      x += thick;
      w -= thick;
    } else {
      y += thick;
      h -= thick;
    }
    total -= rowBytes;
    rest = rest.slice(row.length);
  }
  return placed;
}

/** The tiles for one folder: its subfolders, the files directly in it, the folders too small to list and, at the
 * top of a drive measured in fast mode, what no file explains. */
function tilesOf(node: SpaceNode, system: number): Tile[] {
  const tiles: Tile[] = node.children.map((child) => ({ key: child.name, label: child.name, bytes: child.bytes, kind: "folder", node: child }));
  tiles.push({ key: "~files", label: t("Files in this folder"), bytes: node.own, kind: "files" });
  tiles.push({ key: "~other", label: t("Smaller folders"), bytes: node.other, kind: "other" });
  if (system > 0) tiles.push({ key: "~system", label: t("System and reserved space"), bytes: system, kind: "system" });
  return tiles.filter((tile) => tile.bytes > 0).sort((a, b) => b.bytes - a.bytes);
}

export function Space({ onError }: { onError(error: AppError | null): void }) {
  const [scan, setScan] = useState<SpaceScan | null>(null);
  const [drives, setDrives] = useState<string[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [fast, setFast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trail, setTrail] = useState<SpaceNode[]>([]);
  const [allFiles, setAllFiles] = useState(false);

  useEffect(() => {
    loadSpace().then((last) => {
      if (last?.tree) {
        setScan(last);
        setTarget((current) => current ?? last.root);
      }
    }, () => undefined);
    if (inApp) void listDrives().then((found) => {
      setDrives(found);
      setTarget((current) => current ?? (found.includes("C:\\") ? "C:\\" : (found[0] ?? null)));
    });
  }, []);

  const canBeFast = target !== null && isDrive(target);
  const measure = async () => {
    if (!target) return;
    setBusy(true);
    onError(null);
    try {
      const result = await scanSpace(target, fast && canBeFast);
      setScan(result);
      setTrail([]);
      setAllFiles(false);
    } catch (reason) {
      onError(describeFailure(reason));
    } finally {
      setBusy(false);
    }
  };
  const chooseFolder = async () => {
    const folder = await pickFolder();
    if (folder) {
      setTarget(folder);
      setFast(false);
    }
  };

  const used = scan?.volume ? scan.volume.total - scan.volume.free : null;
  // Only a fast scan of a whole drive measures what Windows counts as used, so only then the rest is the system's.
  const whole = scan !== null && scan.mode === "mft" && used !== null ? Math.max(0, used - scan.bytes) : 0;
  const current = trail.at(-1) ?? scan?.tree ?? null;
  const tiles = useMemo(() => (current ? tilesOf(current, trail.length === 0 ? whole : 0) : []), [current, trail.length, whole]);
  const placed = useMemo(() => squarify(tiles, 200, 100), [tiles]);
  const tintOf = useMemo(() => {
    const folders = tiles.filter((tile) => tile.kind === "folder").map((tile) => tile.key);
    return (key: string) => (folders.includes(key) ? `var(--map-${(folders.indexOf(key) % 6) + 1})` : undefined);
  }, [tiles]);
  const shownTotal = tiles.reduce((sum, tile) => sum + tile.bytes, 0);
  // Opening a folder skips the levels that hold a single folder and almost nothing else, like Users > you.
  const open = (node: SpaceNode) => setTrail([...trail, ...chainOf(node)]);
  const files = allFiles ? (scan?.largest ?? []) : (scan?.largest ?? []).slice(0, 15);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t("Space")}</h1>
      </div>

      <section className="pane space-start">
        <p>{t("See what takes up space on this PC. Measuring only reads; nothing is moved or deleted.")}</p>
        <div className="space-pick">
          <div className="segments" role="group" aria-label={t("What to measure")}>
            {drives.map((drive) => (
              <button key={drive} className="segment" aria-pressed={target === drive} onClick={() => setTarget(drive)}>
                <HardDrives size={16} aria-hidden="true" /> {drive}
              </button>
            ))}
            {target !== null && !drives.includes(target) && (
              <button className="segment space-folder" aria-pressed="true" title={target}>
                <FolderOpen size={16} aria-hidden="true" /> {target}
              </button>
            )}
          </div>
          <button className="button" disabled={!inApp || busy} onClick={() => void chooseFolder()}>
            <FolderOpen size={18} aria-hidden="true" />
            {t("Choose a folder…")}
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={fast && canBeFast} disabled={!canBeFast || busy} onChange={(e) => setFast(e.target.checked)} />
          <span>
            <b>{t("Fast mode")}</b>
            {canBeFast
              ? t("Reads the drive's file table in one pass, in under a minute, and matches the space Windows reports as used. Windows asks for administrator permission each time. NTFS drives only.")
              : t("Available when you measure a whole drive.")}
          </span>
        </label>
        <div className="row-actions">
          <button className="button button-primary" disabled={!inApp || busy || target === null} onClick={() => void measure()}>
            {busy ? t("Measuring…") : t("Measure")}
          </button>
          {busy && <span className="detail-note">{fast && canBeFast ? t("Usually under a minute.") : t("A whole drive can take a few minutes.")}</span>}
        </div>
      </section>

      {scan && current && (
        <>
          <section className="pane space-map" aria-label={t("Space used")}>
            <p className="space-summary">
              {used !== null && isDrive(scan.root)
                ? t("{used} used of {total} on {root}; {free} free.", { used: formatBytes(used), total: formatBytes(scan.volume!.total), free: formatBytes(scan.volume!.free), root: scan.root })
                : t("{size} in {root}.", { size: formatBytes(scan.bytes), root: scan.root })}{" "}
              <span className="row-note">
                {tn(scan.files, "{n} file", "{n} files")} ·{" "}
                {scan.finishedAt !== undefined && scan.finishedAt > 0 && <>{t("measured {age}", { age: describeAge(new Date(scan.finishedAt).toISOString()) })} · </>}
                {scan.mode === "mft" ? t("fast mode") : t("normal mode")}
              </span>
            </p>
            {scan.mode === "walk" && isDrive(scan.root) && (
              <p className="detail-note">
                {t("Normal mode counts a file shared by several folders (a hard link) in each of them and can't open some system folders, so its total won't match Windows. Fast mode does.")}
              </p>
            )}
            {scan.skipped > 0 && <p className="detail-note">{tn(scan.skipped, "{n} folder couldn't be opened and isn't counted.", "{n} folders couldn't be opened and aren't counted.")}</p>}

            <nav className="space-trail" aria-label={t("Folder path")}>
              <button className="space-crumb" aria-current={trail.length === 0 ? "location" : undefined} onClick={() => setTrail([])}>
                {scan.root}
              </button>
              {trail.map((node, index) => (
                <span key={index}>
                  <CaretRight size={12} aria-hidden="true" />
                  <button className="space-crumb" aria-current={index === trail.length - 1 ? "location" : undefined} onClick={() => setTrail(trail.slice(0, index + 1))}>
                    {node.name}
                  </button>
                </span>
              ))}
            </nav>

            <div className="treemap">
              {placed.map((tile) => {
                const share = shownTotal > 0 ? tile.bytes / shownTotal : 0;
                const percent = formatShare(share);
                const label = `${tile.label}, ${formatBytes(tile.bytes)}, ${percent}`;
                // Bigger pieces sit a little lighter, so the eye finds the heavy ones first.
                const style = { ...box(tile, 200, 100), "--tint": tintOf(tile.key), "--shade": `${Math.round(34 + 30 * Math.sqrt(share))}%` } as CSSProperties;
                // Names need room: a tile shows its name and size, only its name, or nothing (the list below has them all).
                const fits = tile.w > 13 && tile.h > 11 ? "full" : tile.w > 8 && tile.h > 7 ? "name" : "none";
                const head = fits !== "none" && (
                  <span className="tile-head">
                    <span className="tile-name">{tile.label}</span>
                    {fits === "full" && (
                      <span className="tile-size">
                        {formatBytes(tile.bytes)} · {percent}
                      </span>
                    )}
                  </span>
                );
                // A big folder previews its own folders one level down, so a large block still says what it holds.
                const inner = fits === "full" && tile.node && tile.h > 24 && tile.w > 22 ? squarify(tilesOf(chainOf(tile.node).at(-1)!, 0), tile.w, tile.h - 9) : [];
                const body = inner.length > 1 && (
                  <span className="tile-inner" aria-hidden="true">
                    {inner.map((child) => (
                      <i key={child.key} className="tile-cell" data-kind={child.kind} style={box(child, tile.w, tile.h - 9)}>
                        {child.w > 15 && child.h > 8 && <span className="tile-cell-name">{child.label}</span>}
                      </i>
                    ))}
                  </span>
                );
                return tile.node ? (
                  <button key={tile.key} className="tile" data-kind={tile.kind} style={style} title={label} aria-label={label} onClick={() => open(tile.node!)}>
                    {head}
                    {body}
                  </button>
                ) : (
                  <div key={tile.key} className="tile" data-kind={tile.kind} style={style} title={label} role="img" aria-label={label}>
                    {head}
                  </div>
                );
              })}
            </div>

            <ul className="rows space-rows">
              {tiles.map((tile) => (
                <li className="row" key={tile.key}>
                  {tile.node ? (
                    <button className="row-title space-open" onClick={() => open(tile.node!)}>
                      {tile.label}
                    </button>
                  ) : (
                    <span className="row-title">{tile.label}</span>
                  )}
                  <span className="row-note space-size">{formatBytes(tile.bytes)}</span>
                  <span className="space-bar" aria-hidden="true">
                    <i style={{ width: `${shownTotal > 0 ? (tile.bytes / shownTotal) * 100 : 0}%`, "--tint": tintOf(tile.key) } as CSSProperties} data-kind={tile.kind} />
                  </span>
                </li>
              ))}
            </ul>
            {trail.length === 0 && whole > 0 && (
              <p className="detail-note">
                {t("System and reserved space is what no file accounts for: space Windows sets aside for updates and the file system's own records.")}
              </p>
            )}
          </section>

          <div className="space-columns">
            <section className="pane" aria-labelledby="space-files">
              <h2 className="section-title" id="space-files">{t("Largest files")}</h2>
              <ul className="rows">
                {files.map((file) => (
                  <li className="row" key={file.path}>
                    <span className="space-path" title={file.path}>{file.path}</span>
                    <span className="row-note space-size">{formatBytes(file.bytes)}</span>
                  </li>
                ))}
              </ul>
              {(scan.largest.length ?? 0) > 15 && (
                <button className="button" onClick={() => setAllFiles(!allFiles)}>
                  {allFiles ? t("Show fewer") : t("Show {n} largest", { n: scan.largest.length })}
                </button>
              )}
            </section>
            <section className="pane" aria-labelledby="space-types">
              <h2 className="section-title" id="space-types">{t("By file type")}</h2>
              <ul className="rows">
                {scan.types.slice(0, 15).map((type) => (
                  <li className="row" key={type.ext}>
                    <span className="row-title">
                      {type.ext ? `.${type.ext}` : t("No extension")} <span className="row-note">{tn(type.files, "{n} file", "{n} files")}</span>
                    </span>
                    <span className="row-note space-size">{formatBytes(type.bytes)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}

      <Cleanup onError={onError} />
    </>
  );
}
