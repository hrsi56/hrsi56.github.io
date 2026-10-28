import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
let localReferences = 0;
let htmlPages = 0;
const htmlCache = new Map();
const ignored = new Set(['.git', 'node_modules', 'tmp', '.tmp', 'preview', 'screenshots']);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function attributes(tag) {
  const result = new Map();
  const attrPattern = /\s([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(attrPattern)) {
    result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

const label = file => path.relative(root, file) || '.';
const report = (file, message) => errors.push(`${label(file)}: ${message}`);
const decodeEntities = value => value.replaceAll('&amp;', '&');

async function readHtml(file) {
  if (!htmlCache.has(file)) {
    const html = await readFile(file, 'utf8');
    const ids = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]));
    htmlCache.set(file, { html, ids });
  }
  return htmlCache.get(file);
}

async function checkReference(file, originalReference) {
  const reference = decodeEntities(originalReference.trim());
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) return;
  let parsed;
  try {
    parsed = new URL(reference, `https://local.invalid/${path.relative(root, file).split(path.sep).join('/')}`);
  } catch {
    report(file, `Invalid local URL: ${reference}`);
    return;
  }
  let target;
  try {
    target = path.resolve(root, `.${decodeURIComponent(parsed.pathname)}`);
  } catch {
    report(file, `Invalid URL encoding: ${reference}`);
    return;
  }
  if (target !== root && !target.startsWith(root + path.sep)) {
    report(file, `Reference leaves the site directory: ${reference}`);
    return;
  }
  try {
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    await stat(target);
  } catch {
    report(file, `Missing local file: ${reference}`);
    return;
  }
  localReferences += 1;
  if (parsed.hash && /\.html?$/i.test(target)) {
    let fragment;
    try { fragment = decodeURIComponent(parsed.hash.slice(1)); }
    catch { report(file, `Invalid fragment encoding: ${reference}`); return; }
    if (fragment && !(await readHtml(target)).ids.has(fragment)) {
      report(file, `Missing anchor: ${reference}`);
    }
  }
}

try {
  await stat(path.join(root, 'index.html'));
} catch {
  errors.push('Required file is missing: index.html');
}

for (const file of await filesIn(root)) {
  if (/\.html?$/i.test(file)) {
    htmlPages += 1;
    const { html, ids } = await readHtml(file);
    const htmlTag = html.match(/<html\b[^>]*>/i)?.[0];
    const htmlAttributes = attributes(htmlTag ?? '');
    if (htmlAttributes.get('lang') !== 'he') report(file, 'Expected <html lang="he">.');
    if (htmlAttributes.get('dir') !== 'rtl') report(file, 'Expected <html dir="rtl">.');
    if (!/<title\b[^>]*>\s*[^<\s]/i.test(html)) report(file, 'Page title is missing or empty.');
    for (const match of html.matchAll(/<(a|link|script|img|source|video|audio|iframe|dialog)\b[^>]*>/gi)) {
      const tag = match[1].toLowerCase();
      const attrs = attributes(match[0]);
      for (const attribute of ['href', 'src', 'poster']) {
        if (attrs.has(attribute)) await checkReference(file, attrs.get(attribute));
      }
      if (tag === 'img' && !attrs.has('alt')) report(file, 'Image is missing an alt attribute.');
      if (tag === 'a' && attrs.get('target') === '_blank') {
        const relations = new Set((attrs.get('rel') ?? '').split(/\s+/));
        if (!relations.has('noopener') && !relations.has('noreferrer')) {
          report(file, `External new-tab link needs rel="noopener": ${attrs.get('href')}`);
        }
      }
      if (tag === 'dialog') {
        const labelledBy = (attrs.get('aria-labelledby') ?? '').trim().split(/\s+/).filter(Boolean);
        if (!attrs.get('aria-label')?.trim() && !labelledBy.length) {
          report(file, 'Dialog is missing an accessible name.');
        }
        for (const id of labelledBy) {
          if (!ids.has(id)) report(file, `Dialog label does not exist: ${id}`);
        }
      }
    }
  } else if (/\.css$/i.test(file)) {
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi)) {
      await checkReference(file, match[1] ?? match[2] ?? match[3]);
    }
  }
}

if (errors.length) {
  console.error(`Site checks failed (${errors.length}):\n${errors.map(error => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Site checks passed: ${htmlPages} HTML page(s), ${localReferences} local reference(s).`);
}
