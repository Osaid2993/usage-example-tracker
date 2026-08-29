#!/usr/bin/env node
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./tracker.json', 'utf-8'));

const fixes = [
  { func: 'conversation_is_thinking', status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/789', by: 'ekam313' },
  { func: 'conversation_is_replying', status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/809', by: 'jasveena15' },
  { func: 'conversation_add_message', status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/802', by: 'himanshigaba22' },
];

for (const fix of fixes) {
  const entry = data.entries.find(e => e.functionName === fix.func);
  if (entry && (entry.status === 'available' || !entry.claimedBy)) {
    const old = entry.status;
    entry.status = fix.status;
    entry.prLink = fix.pr;
    entry.claimedBy = fix.by;
    console.log(`  ✓ ${fix.func}: ${old} → ${fix.status} (${fix.by})`);
  } else if (entry) {
    console.log(`  - ${fix.func}: already ${entry.status}`);
  } else {
    console.log(`  ? ${fix.func}: not in tracker`);
  }
}

// replace the broken patch with a working version
if (fs.existsSync('./sync.js')) {
  let code = fs.readFileSync('./sync.js', 'utf-8');
  // Remove the broken patch by finding and fixing the ignore reference
  code = code.replace(
    /if \(candidate\.length > 5 && !ignore\.has\(candidate\)\)/g,
    'if (candidate.length > 5)'
  );
  fs.writeFileSync('./sync.js', code);
  console.log('\n  Fixed sync.js ignore reference too.');
}

data.lastUpdated = new Date().toISOString();
fs.writeFileSync('./tracker.json', JSON.stringify(data, null, 2));
console.log('\nDone!');
