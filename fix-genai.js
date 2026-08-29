#!/usr/bin/env node
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./tracker.json', 'utf-8'));
 
const fixes = [
  { func: 'conversation_get_reply_piece', status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/750', by: 'ralphweng2023' },
  { func: 'conversation_get_reply',       status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/750', by: 'ralphweng2023' },
  { func: 'conversation_is_thinking',     status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/789', by: 'ekam313' },
  { func: 'conversation_is_replying',     status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/809', by: 'jasveena15' },
  { func: 'conversation_add_message',     status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/792', by: 'jankiluitel' },
  { func: 'free_all_conversations',       status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/808', by: 'jasveena15' },
  { func: 'generate_reply',              status: 'in_review', pr: 'https://github.com/thoth-tech/splashkit.io-starlight/pull/759', by: '222448082Ashen' },
];
 
let fixed = 0;
for (const f of fixes) {
  const entry = data.entries.find(e => e.functionName === f.func);
  if (!entry) { console.log(`  ? ${f.func}: not found`); continue; }
  if (entry.status === 'merged') { console.log(`  - ${f.func}: already merged`); continue; }
  if (entry.status === 'in_review') { console.log(`  - ${f.func}: already in_review`); continue; }
  const old = entry.status;
  entry.status = f.status; entry.prLink = f.pr; entry.claimedBy = f.by;
  console.log(`  ✓ ${f.func}: ${old} → ${f.status} (${f.by})`);
  fixed++;
}
 
data.lastUpdated = new Date().toISOString();
fs.writeFileSync('./tracker.json', JSON.stringify(data, null, 2));
console.log(`\nFixed ${fixed}. Generative AI section is now fully accounted for.`);
