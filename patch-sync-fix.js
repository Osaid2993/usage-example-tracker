#!/usr/bin/env node

/**
 * patch-sync-fix.js
 * 
 * Patches sync.js to also match PR titles with spaces instead of underscores.
 * e.g. "Add conversation is thinking" > matches conversation_is_thinking
 * 
 * Run once:  node patch-sync-fix.js
 * Then:      node sync.js
 */

const fs = require('fs');
const syncPath = './sync.js';

if (!fs.existsSync(syncPath)) {
  console.error('sync.js not found. Run this from the same directory.');
  process.exit(1);
}

let code = fs.readFileSync(syncPath, 'utf-8');

// Find the extractFunctionNames function and add space-to-snake matching
const oldPattern = `  return [...new Set(names)];
}`;

const newPattern = `  // Pattern 3: space-separated words that form a known function name
  // "Add conversation is thinking" → try "conversation_is_thinking"
  const words = title.split(/[^a-z]+/).filter(w => w.length > 1);
  for (let i = 0; i < words.length - 1; i++) {
    for (let len = 2; len <= Math.min(5, words.length - i); len++) {
      const candidate = words.slice(i, i + len).join('_');
      if (candidate.length > 5 && !ignore.has(candidate)) {
        names.push(candidate);
      }
    }
  }

  return [...new Set(names)];
}`;

if (code.includes(oldPattern)) {
  code = code.replace(oldPattern, newPattern);
  fs.writeFileSync(syncPath, code);
  console.log('Patched sync.js — now also matches space-separated function names.');
  console.log('Run: node sync.js');
} else {
  console.log('Could not find the patch target in sync.js.');
  console.log('The function may have already been patched, or the file was modified.');
  console.log('');
  console.log('Manual fix: re-run sync.js, then manually update these in the tracker:');
  console.log('');

  // Fallback: directly patch tracker.json for the known missing matches
  const trackerPath = './tracker.json';
  if (!fs.existsSync(trackerPath)) {
    console.error('tracker.json not found either.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(trackerPath, 'utf-8'));
  const fixes = [
    { func: 'conversation_is_thinking', status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/789', by: 'ekam313' },
    { func: 'conversation_is_replying', status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/809', by: 'jasveena15' },
  ];

  let fixed = 0;
  for (const fix of fixes) {
    const entry = data.entries.find(e => e.functionName === fix.func);
    if (entry && entry.status === 'available') {
      entry.status = fix.status;
      entry.prLink = fix.pr;
      entry.claimedBy = fix.by;
      console.log(`  ✓ ${fix.func}: available → ${fix.status} (${fix.by})`);
      fixed++;
    } else if (entry) {
      console.log(`  - ${fix.func}: already ${entry.status}, skipped`);
    } else {
      console.log(`  ? ${fix.func}: not found in tracker`);
    }
  }

  if (fixed > 0) {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(trackerPath, JSON.stringify(data, null, 2));
    console.log(`\nFixed ${fixed} entries in tracker.json`);
  }
}
