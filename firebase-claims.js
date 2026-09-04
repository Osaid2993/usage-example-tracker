// firebase-claims.js
// Real-time claim persistence using Firebase Realtime Database
// Claims are stored separately from tracker.json and overlaid on load

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, onValue, remove }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

let db = null;
let claimsRef = null;
let liveClaims = {};
let onClaimsUpdate = null;

function initFirebase(config, callback) {
  try {
    const app = initializeApp(config);
    db = getDatabase(app);
    claimsRef = ref(db, 'claims');
    onClaimsUpdate = callback;

    onValue(claimsRef, (snapshot) => {
      liveClaims = snapshot.val() || {};
      if (onClaimsUpdate) onClaimsUpdate(liveClaims);
    });

    console.log('Firebase connected');
    return true;
  } catch (e) {
    console.error('Firebase init failed:', e);
    return false;
  }
}

function saveClaim(functionName, claimData) {
  if (!db) return;
  const key = functionName.replace(/[.#$[\]]/g, '_');
  set(ref(db, 'claims/' + key), {
    status: claimData.status,
    claimedBy: claimData.claimedBy || '',
    prLink: claimData.prLink || '',
    updatedAt: new Date().toISOString()
  });
}

function removeClaim(functionName) {
  if (!db) return;
  const key = functionName.replace(/[.#$[\]]/g, '_');
  remove(ref(db, 'claims/' + key));
}

function applyClaimsToEntries(entries, claims) {
  const statusRank = { available: 0, claimed: 1, in_progress: 2, in_review: 3, merged: 4 };

  entries.forEach(entry => {
    const key = entry.functionName.replace(/[.#$[\]]/g, '_');
    const claim = claims[key];
    if (!claim) return;

    const claimRank = statusRank[claim.status] || 0;
    const entryRank = statusRank[entry.status] || 0;

    // Firebase claim wins if it's a higher or equal status,
    // OR if the entry is still "available" (student just claimed it)
    if (claimRank >= entryRank || entry.status === 'available') {
      entry.status = claim.status;
      if (claim.claimedBy) entry.claimedBy = claim.claimedBy;
      if (claim.prLink) entry.prLink = claim.prLink;
    }
    // If the sync script already moved it to merged/in_review via a real PR,
    // the tracker.json version wins and the Firebase claim is stale
  });

  return entries;
}

export { initFirebase, saveClaim, removeClaim, applyClaimsToEntries, liveClaims };
