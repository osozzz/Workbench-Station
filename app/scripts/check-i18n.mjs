// Fails when text marked for translation in src/ has no Spanish in src/es.ts, or when a translation
// drops or invents a {placeholder}. Runs before every build (package.json "build").
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { es, esPlurals } from "../src/es.ts";

const src = fileURLToPath(new URL("../src/", import.meta.url));
const files = readdirSync(src, { recursive: true }).filter((name) => /\.tsx?$/.test(name) && !/^es\.ts$|guides\.es\.ts$/.test(name));
const literal = String.raw`"((?:[^"\\]|\\.)*)"`;
const unescape = (raw) => JSON.parse(`"${raw}"`);
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

const problems = [];
const used = new Set();
const check = (file, english, spanish) => {
  used.add(english);
  if (spanish === undefined) problems.push(`${file}: no Spanish for "${english}"`);
  else if (placeholders(english) !== placeholders(spanish)) problems.push(`${file}: placeholders differ in "${english}" -> "${spanish}"`);
};

for (const file of files) {
  const text = readFileSync(join(src, file), "utf8");
  for (const [, raw] of text.matchAll(new RegExp(String.raw`\b(?:t|msg)\(\s*${literal}`, "g"))) check(file, unescape(raw), es[unescape(raw)]);
  for (const [, one, other] of text.matchAll(new RegExp(String.raw`\btn\([^\n]*?,\s*${literal},\s*${literal}`, "g"))) {
    const forms = esPlurals[unescape(other)];
    check(file, unescape(one), forms?.one);
    check(file, unescape(other), forms?.other);
  }
  // A template literal can't match a dictionary key; pass the changing part as a {placeholder}.
  for (const match of text.matchAll(/\b(?:t|msg|tn)\(\s*`/g)) problems.push(`${file}: t() with a template literal at offset ${match.index}`);
}

for (const key of [...Object.keys(es), ...Object.keys(esPlurals)]) {
  if (!used.has(key)) console.warn(`i18n: unused Spanish text "${key}"`);
}
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`i18n: ${used.size} texts, all translated.`);
