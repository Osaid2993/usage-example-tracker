#!/usr/bin/env node

/**
 * rescrape.js
 * 
 * Scrapes the current SplashKit API docs and merges any new functions
 * into tracker.json without touching existing entries.
 * 
 * Usage: node rescrape.js
 *   --dry-run    Show what would be added without writing
 */

const fs = require('fs');
const TRACKER_PATH = './tracker.json';
const DRY_RUN = process.argv.includes('--dry-run');

const CATEGORIES = [
  { slug: 'animations', name: 'Animations' },
  { slug: 'audio', name: 'Audio' },
  { slug: 'camera', name: 'Camera' },
  { slug: 'color', name: 'Color' },
  { slug: 'generative-ai', name: 'Generative AI' },
  { slug: 'geometry', name: 'Geometry' },
  { slug: 'graphics', name: 'Graphics' },
  { slug: 'input', name: 'Input' },
  { slug: 'interface', name: 'Interface' },
  { slug: 'json', name: 'Json' },
  { slug: 'logging', name: 'Logging' },
  { slug: 'networking', name: 'Networking' },
  { slug: 'physics', name: 'Physics' },
  { slug: 'raspberry', name: 'Raspberry' },
  { slug: 'resource-bundles', name: 'Resource Bundles' },
  { slug: 'resources', name: 'Resources' },
  { slug: 'sprites', name: 'Sprites' },
  { slug: 'terminal', name: 'Terminal' },
  { slug: 'timers', name: 'Timers' },
  { slug: 'types', name: 'Types' },
  { slug: 'utilities', name: 'Utilities' },
  { slug: 'windows', name: 'Windows' },
];

function extractFunctions(html) {
  const funcs = new Set();

  // Match C++ function signatures: return_type function_name(
  // These appear in the signature blocks as snake_case
  const sigRegex = /(?:void|bool|int|float|double|string|unsigned|point_2d|vector_2d|circle|line|triangle|rectangle|quad|color|window|bitmap|sprite|font|timer|music|sound_effect|animation|json|server_socket|connection|message|http_response|adc_device|gpio_pin|servo_device|motor_device)\s+([a-z][a-z0-9_]+)\s*\(/g;
  let match;
  while ((match = sigRegex.exec(html)) !== null) {
    const name = match[1];
    // Skip common non-function words
    if (!['const', 'var', 'ref', 'int', 'void', 'bool', 'float', 'double', 'string'].includes(name)) {
      funcs.add(name);
    }
  }

  // Also match from "Section titled" headings which contain PascalCase names
  // Convert PascalCase to snake_case
  const sectionRegex = /Section titled "([A-Z][a-zA-Z ]+?)(?:\s*\{<\/>\})?"/g;
  while ((match = sectionRegex.exec(html)) !== null) {
    const title = match[1].trim();
    // Skip "Note", "Functions", "Overview" etc
    if (['Note', 'Functions', 'Overview', 'Output'].includes(title)) continue;
    // Skip overload labels like "Circle At {</>}"
    const snake = title
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/\s+/g, '_')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    if (snake.length > 2 && snake.includes('_')) {
      funcs.add(snake);
    }
  }

  return [...funcs];
}

async function fetchCategory(slug) {
  const url = `https://splashkit.io/api/${slug}/`;
  const r = await fetch(url);
  if (!r.ok) {
    console.error(`  Failed to fetch ${url}: ${r.status}`);
    return [];
  }
  const html = await r.text();
  return extractFunctions(html);
}

async function main() {
  console.log('==================================================');
  console.log('SplashKit API Re-Scraper');
  console.log('==================================================');
  console.log(`Dry run: ${DRY_RUN}\n`);

  if (!fs.existsSync(TRACKER_PATH)) {
    console.error('tracker.json not found. Run from your tracker directory.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf-8'));
  const entries = data.entries || [];
  const existing = new Set(entries.map(e => e.functionName.toLowerCase()));
  console.log(`Loaded ${entries.length} existing tracker entries.\n`);

  let totalNew = 0;
  const newEntries = [];

  for (const cat of CATEGORIES) {
    process.stdout.write(`Scraping ${cat.name}...`);
    const funcs = await fetchCategory(cat.slug);
    const unique = [...new Set(funcs)];

    let added = 0;
    for (const func of unique) {
      const norm = func.toLowerCase();
      if (!existing.has(norm)) {
        existing.add(norm);
        const entry = {
          functionName: func,
          category: cat.name,
          status: 'available',
          description: '(add description)',
          claimedBy: '',
          prLink: '',
        };
        newEntries.push(entry);
        added++;
      }
    }

    console.log(` ${unique.length} functions found, ${added} new`);
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nTotal new functions to add: ${newEntries.length}`);

  if (newEntries.length > 0) {
    console.log('\nNew functions:');
    for (const e of newEntries) {
      console.log(`  + ${e.functionName} (${e.category})`);
    }
  }

  if (!DRY_RUN && newEntries.length > 0) {
    entries.push(...newEntries);
    data.entries = entries;
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(TRACKER_PATH, JSON.stringify(data, null, 2));
    console.log(`\nAdded ${newEntries.length} entries. Total: ${entries.length}`);
    console.log(`Saved to ${TRACKER_PATH}`);
    console.log('\nNext steps:');
    console.log('  1. node sync.js          (to match new entries against PRs)');
    console.log('  2. git add tracker.json');
    console.log('  3. git commit -m "Re-scrape: add new API functions"');
    console.log('  4. git push');
  } else if (DRY_RUN) {
    console.log('\nDry run — nothing saved. Remove --dry-run to apply.');
  } else {
    console.log('\nNo new functions found. Tracker is up to date.');
  }

  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
