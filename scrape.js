#!/usr/bin/env node
// scrape.js — server-side scraper for the Karz & Dolls stock dashboard.
// Runs in GitHub Actions (or locally with `node scrape.js`, Node 18+).
// This executes on a server, not in a browser, so CORS does not apply.

import fs from 'fs/promises';

const CATEGORIES_FILE = './categories.json';
const DATA_FILE = './data.json';
const IMG_BASE = 'https://www.karzanddolls.com/karzOffice/public/assets/productimages/product/';

function categoryLabelFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || url;
  } catch {
    return url;
  }
}

function extractNextData(html) {
  const m = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// Recursively find every object that looks like a product record
function findProducts(node, out, seen) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) findProducts(item, out, seen);
    return;
  }
  if (
    Object.prototype.hasOwnProperty.call(node, 'pro_stock') &&
    Object.prototype.hasOwnProperty.call(node, 'pro_name')
  ) {
    const key = node.pid || node.id || node.pro_name;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(node);
    }
  }
  for (const k in node) findProducts(node[k], out, seen);
}

function getFirstImageFilename(p) {
  if (Array.isArray(p.prd_images) && p.prd_images.length && p.prd_images[0].pro_images) {
    return p.prd_images[0].pro_images;
  }
  if (p.pro_image) return p.pro_image;
  if (p.image) return p.image;
  return null;
}

async function loadJson(path, fallback) {
  try {
    const text = await fs.readFile(path, 'utf-8');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function fetchCategory(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockDashboardBot/1.0)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function main() {
  const categories = await loadJson(CATEGORIES_FILE, []);
  if (!categories.length) {
    console.error('categories.json is empty — add category URLs first.');
    process.exit(1);
  }

  const store = await loadJson(DATA_FILE, { products: {}, meta: {} });
  store.products = store.products || {};
  store.meta = store.meta || {};

  const now = Date.now();
  let totalAdded = 0, totalUpdated = 0, totalErrors = 0;

  for (const url of categories) {
    const label = categoryLabelFromUrl(url);
    try {
      const html = await fetchCategory(url);
      const nextData = extractNextData(html);
      if (!nextData) throw new Error('No __NEXT_DATA__ found (page structure may have changed)');

      const found = [];
      findProducts(nextData, found, new Set());
      if (!found.length) throw new Error('No product records found in __NEXT_DATA__');

      for (const p of found) {
        const key = String(p.pid || p.id || p.pro_name);
        const filename = getFirstImageFilename(p);
        const image = filename ? (IMG_BASE.replace(/\/+$/, '') + '/' + filename) : null;
        const stock = (typeof p.pro_stock === 'number') ? p.pro_stock : parseInt(p.pro_stock || '0', 10);
        const name = p.pro_name || '(unnamed)';
        const brand = p.product_sname || '';

        const prev = store.products[key];
        const changed = !prev || prev.name !== name || prev.stock !== stock ||
          prev.image !== image || prev.brand !== brand;

        store.products[key] = {
          pid: p.pid || null,
          id: p.id || null,
          name,
          brand,
          stock,
          image,
          category: label,
          firstSeen: prev ? prev.firstSeen : now,   // "created at"
          lastUpdated: changed ? now : (prev ? prev.lastUpdated : now) // "updated at"
        };

        if (!prev) totalAdded++;
        else if (changed) totalUpdated++;
      }

      store.meta[label] = { url, lastChecked: now, lastCount: found.length, lastError: null };
      console.log(`OK ${label}: ${found.length} products`);
    } catch (err) {
      totalErrors++;
      store.meta[label] = {
        ...(store.meta[label] || {}),
        url,
        lastChecked: now,
        lastError: String(err.message || err)
      };
      console.error(`FAIL ${label}: ${err.message || err}`);
    }
  }

  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
  console.log(`Done. Added ${totalAdded}, updated ${totalUpdated}, errors ${totalErrors}.`);
}

main();
