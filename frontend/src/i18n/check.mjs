/* Dictionary parity check: `npm run check:i18n`
 * Fails if the three languages drift apart in keys or {placeholders}. */
import path from 'path';
import { fileURLToPath } from 'url';

const base = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dictionaries') + '/';
const hinglish = (await import(base + 'hinglish.js')).default;
const hi = (await import(base + 'hi.js')).default;
const en = (await import(base + 'en.js')).default;

const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`],
  );

const H = new Set(flat(hinglish)), I = new Set(flat(hi)), E = new Set(flat(en));
console.log(`keys: hinglish=${H.size} hi=${I.size} en=${E.size}`);

let bad = 0;
for (const [name, set] of [['hi', I], ['en', E]]) {
  const missing = [...H].filter((k) => !set.has(k));
  const extra = [...set].filter((k) => !H.has(k));
  if (missing.length) { console.log(`\n${name} MISSING ${missing.length}:`, missing.join(', ')); bad += missing.length; }
  if (extra.length) { console.log(`\n${name} EXTRA ${extra.length}:`, extra.join(', ')); bad += extra.length; }
}

// placeholder parity: {x} tokens must match across languages
const get = (o, k) => k.split('.').reduce((a, p) => a?.[p], o);
const toks = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const k of H) {
  const a = toks(get(hinglish, k));
  for (const [name, d] of [['hi', hi], ['en', en]]) {
    const b = toks(get(d, k) ?? '');
    if (get(d, k) !== undefined && a !== b) {
      console.log(`PLACEHOLDER MISMATCH ${k}: hinglish{${a}} vs ${name}{${b}}`);
      bad++;
    }
  }
}
console.log(bad === 0 ? '\nAll three dictionaries are in sync.' : `\n${bad} problems`);
process.exit(bad === 0 ? 0 : 1);
