#!/usr/bin/env node
const fs = require('fs');
const REPO = process.argv.includes('--repo') ? process.argv[process.argv.indexOf('--repo')+1] : 'thoth-tech/splashkit.io-starlight';
const TOKEN = process.argv.includes('--token') ? process.argv[process.argv.indexOf('--token')+1] : process.env.GITHUB_TOKEN || null;
const TRACKER_PATH = './tracker.json';
const DRY_RUN = process.argv.includes('--dry-run');
const headers = {'Accept':'application/vnd.github+json','User-Agent':'splashkit-tracker-sync'};
if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

async function fetchAllPRs() {
  const prs = []; let page = 1;
  console.log(`Fetching PRs from ${REPO}...`);
  while (true) {
    const r = await fetch(`https://api.github.com/repos/${REPO}/pulls?state=all&per_page=100&page=${page}`, {headers});
    if (!r.ok) { const b = await r.text(); if (b.includes('rate limit')) console.error('Rate limited. Use --token ghp_xxx'); break; }
    const batch = await r.json(); if (!batch.length) break;
    prs.push(...batch);
    console.log(`  Page ${page}: ${batch.length} PRs (${prs.length} total)`);
    if (batch.length < 100) break; page++;
    await new Promise(r => setTimeout(r, 200));
  }
  return prs;
}

function extractFunctionNames(prTitle) {
  const title = prTitle.toLowerCase();
  const names = [];
  const ignore = new Set([
    'usage','example','examples','add','update','fix','create',
    'added','updated','fixed','created','new','for','and',
    'the','with','from','this','that','splashkit','splash_kit',
    'pull_request','issue','branch','merge','review',
    'readme','docs','documentation','guide','tutorial',
  ]);
  // Snake_case matches
  const snakeMatches = title.match(/\b[a-z][a-z_]{2,}[a-z]\b/g) || [];
  for (const m of snakeMatches) {
    if (!ignore.has(m) && m.includes('_')) names.push(m);
  }
  // PascalCase to snake_case
  for (const m of prTitle.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) || []) {
    const snake = m.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    if (snake.includes('_')) names.push(snake);
  }
  // Space-separated words → snake_case candidates
  const words = title.split(/[^a-z]+/).filter(w => w.length > 1 && !ignore.has(w));
  for (let i = 0; i < words.length - 1; i++) {
    for (let len = 2; len <= Math.min(5, words.length - i); len++) {
      const candidate = words.slice(i, i + len).join('_');
      if (candidate.length > 5) names.push(candidate);
    }
  }
  return [...new Set(names)];
}

function findBestMatch(funcNames, entries) {
  const entryMap = new Map();
  entries.forEach(e => entryMap.set(e.functionName.toLowerCase().replace(/[^a-z0-9_]/g,'_'), e));
  for (const name of funcNames) {
    const norm = name.toLowerCase().replace(/[^a-z0-9_]/g,'_');
    if (entryMap.has(norm)) return entryMap.get(norm);
    for (const [key, entry] of entryMap) {
      if (key.includes(norm) || norm.includes(key)) return entry;
    }
  }
  return null;
}

async function main() {
  console.log('==================================================');
  console.log('SplashKit Tracker Sync');
  console.log('==================================================');
  console.log(`Repo: ${REPO} | Auth: ${TOKEN?'yes':'no (60/hr)'} | Dry run: ${DRY_RUN}\n`);

  if (!fs.existsSync(TRACKER_PATH)) { console.error('tracker.json not found'); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf-8'));
  const entries = data.entries || [];
  console.log(`Loaded ${entries.length} tracker entries.\n`);

  const prs = await fetchAllPRs();
  console.log(`\nFetched ${prs.length} PRs total.\n`);

  const usagePRs = prs.filter(pr => {
    const t = pr.title.toLowerCase();
    return t.includes('usage') || t.includes('example') || extractFunctionNames(pr.title).length > 0;
  });
  console.log(`Found ${usagePRs.length} usage-example-related PRs.\n`);

  let matched = 0, unmatched = [];
  const statusRank = { available:0, claimed:1, in_progress:2, in_review:3, merged:4 };

  for (const pr of usagePRs) {
    const funcNames = extractFunctionNames(pr.title);
    if (!funcNames.length) continue;
    const entry = findBestMatch(funcNames, entries);
    if (!entry) { unmatched.push({pr:`#${pr.number}`,title:pr.title,extracted:funcNames}); continue; }
    const isMerged = pr.merged_at != null;
    const isOpen = pr.state === 'open';
    let newStatus = entry.status;
    if (isMerged) newStatus = 'merged';
    else if (isOpen) newStatus = 'in_review';
    if (statusRank[newStatus] >= statusRank[entry.status]) {
      const old = entry.status;
      entry.status = newStatus;
      entry.prLink = pr.html_url;
      entry.claimedBy = entry.claimedBy || pr.user.login;
      if ((!entry.description || entry.description.startsWith('(add description')) && pr.body) {
        const lines = pr.body.split('\n').map(l=>l.trim()).filter(l=>l.length>20&&!l.startsWith('#')&&!l.startsWith('-')&&!l.startsWith('['));
        if (lines.length) entry.description = lines[0].slice(0,200);
      }
      console.log(`  ✓ ${entry.functionName}: ${old} → ${newStatus} (PR #${pr.number} by ${pr.user.login})`);
      matched++;
    }
  }

  console.log(`\nMatched ${matched} PRs to tracker entries.`);
  if (unmatched.length) {
    console.log(`\n${unmatched.length} PRs could not be matched:`);
    unmatched.slice(0,15).forEach(u => console.log(`  ? ${u.pr} "${u.title}" → tried: ${u.extracted.join(', ')}`));
    if (unmatched.length > 15) console.log(`  ... and ${unmatched.length-15} more`);
  }

  const stats = {};
  entries.forEach(e => { stats[e.status] = (stats[e.status]||0)+1; });
  console.log('\nFinal stats:');
  Object.entries(stats).sort().forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  if (!DRY_RUN) {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(TRACKER_PATH, JSON.stringify(data, null, 2));
    console.log(`\nSaved to ${TRACKER_PATH}`);
  } else { console.log('\nDry run — nothing saved.'); }
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
