import { Fragment, type ReactNode } from "react";
import { es, esPlurals } from "./es";

// The app's text is written in English, and the English text is the key: a missing translation shows
// English, never a raw key. scripts/check-i18n.mjs fails the build when a marked text has no Spanish.

export type Language = "en" | "es";

const storageKey = "language";

function saved(): Language | null {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "en" || value === "es" ? value : null;
  } catch {
    return null;
  }
}

/** Windows' display language, as the webview reports it: Spanish for any es-*, English otherwise. */
const windowsLanguage = (): Language => (navigator.language.toLowerCase().startsWith("es") ? "es" : "en");

let current: Language = saved() ?? windowsLanguage();
document.documentElement.lang = current;

export const language = () => current;

/** "windows" while the app follows Windows' language, otherwise the language chosen in Settings. */
export const languageChoice = (): Language | "windows" => saved() ?? "windows";

/** Sets the language and remembers the choice on this PC; "windows" follows Windows again. */
export function chooseLanguage(choice: Language | "windows") {
  try {
    if (choice === "windows") localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, choice);
  } catch {
    // Kept for this session only.
  }
  current = choice === "windows" ? windowsLanguage() : choice;
  document.documentElement.lang = current;
}

type Vars = Record<string, string | number>;

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text);

/** Text in the app's language. {name} placeholders are filled from vars. */
export function t(text: string, vars?: Vars): string {
  return fill(current === "es" ? (es[text] ?? text) : text, vars);
}

/** Text that depends on a count, given in English as its "one" and "other" forms; {n} is the count. */
export function tn(count: number, one: string, other: string, vars?: Vars): string {
  const forms = current === "es" ? (esPlurals[other] ?? { one, other }) : { one, other };
  const form = new Intl.PluralRules(current).select(count) === "one" ? forms.one : forms.other;
  return fill(form, { n: count, ...vars });
}

/** Marks text that is translated later with t(), such as labels in a table, so the check can find it. */
export const msg = (text: string) => text;

/** Translated text with elements in its placeholders, such as bold names: rich(translated, { name: <b>…</b> }). */
export function rich(text: string, parts: Record<string, ReactNode>): ReactNode {
  return text.split(/\{(\w+)\}/).map((piece, index) => <Fragment key={index}>{index % 2 === 1 ? (parts[piece] ?? `{${piece}}`) : piece}</Fragment>);
}

/** A date and time in the app's language. */
export const formatDate = (iso: string | Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(current, options).format(new Date(iso));

/** "2 hours ago", "yesterday", "hace 3 días". */
export function describeAge(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return t("less than an hour ago");
  const relative = new Intl.RelativeTimeFormat(current, { numeric: "auto" });
  return hours < 24 ? relative.format(-Math.floor(hours), "hour") : relative.format(-Math.floor(hours / 24), "day");
}
