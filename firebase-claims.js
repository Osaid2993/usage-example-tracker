// firebase-claims.js
// Real-time claim persistence using Firebase Realtime Database
// With GitHub authentication for claim ownership

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, onValue, remove }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getAuth, GithubAuthProvider, signInWithPopup, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

let db = null;
let auth = null;
let claimsRef = null;
let liveClaims = {};
let currentUser = null;
let isLeadUser = false;
let onClaimsUpdate = null;

function initFirebase(config, callback) {
  try {
    const app = initializeApp(config);
    db = getDatabase(app);
    auth = getAuth(app);
    claimsRef = ref(db, 'claims');
    onClaimsUpdate = callback;

    onValue(claimsRef, (snapshot) => {
      liveClaims = snapshot.val() || {};
      if (onClaimsUpdate) onClaimsUpdate(liveClaims);
    });

    // Watch lead status
    const leadsRef = ref(db, 'leads');
    onValue(leadsRef, (snapshot) => {
      const leads = snapshot.val() || {};
      if (currentUser) isLeadUser = !!leads[currentUser.uid];
    });

    onAuthStateChanged(auth, (user) => {
      if (user) {
        const ghData = user.providerData.find(p => p.providerId === 'github.com');
        currentUser = {
          uid: user.uid,
          displayName: ghData?.displayName || user.displayName || '',
          photoURL: user.photoURL || '',
          githubUsername: localStorage.getItem('gh_username') || ''
        };
      } else {
        currentUser = null;
        isLeadUser = false;
      }
    });

    console.log('Firebase connected');
    return true;
  } catch (e) {
    console.error('Firebase init failed:', e);
    return false;
  }
}

function canModifyClaim(functionName) {
  if (!currentUser) return false;
  const key = functionName.replace(/[.#$[\]]/g, '_');
  const claim = liveClaims[key];
  if (!claim) return true;
  if (claim.uid === currentUser.uid) return true;
  if (isLeadUser) return true;
  return false;
}

function saveClaim(functionName, claimData) {
  if (!db || !currentUser) return;
  const key = functionName.replace(/[.#$[\]]/g, '_');
  const existing = liveClaims[key];

  if (existing && existing.uid && existing.uid !== currentUser.uid && !isLeadUser) {
    return false;
  }

  set(ref(db, 'claims/' + key), {
    status: claimData.status,
    claimedBy: claimData.claimedBy || currentUser.githubUsername || '',
    prLink: claimData.prLink || '',
    uid: existing?.uid || currentUser.uid,
    updatedAt: new Date().toISOString()
  });
  return true;
}

function removeClaim(functionName) {
  if (!db || !currentUser) return;
  const key = functionName.replace(/[.#$[\]]/g, '_');
  const existing = liveClaims[key];

  if (existing && existing.uid && existing.uid !== currentUser.uid && !isLeadUser) {
    return false;
  }

  remove(ref(db, 'claims/' + key));
  return true;
}

function applyClaimsToEntries(entries, claims) {
  const statusRank = { available: 0, claimed: 1, in_progress: 2, in_review: 3, merged: 4 };

  entries.forEach(entry => {
    const key = entry.functionName.replace(/[.#$[\]]/g, '_');
    const claim = claims[key];
    if (!claim) return;

    const claimRank = statusRank[claim.status] || 0;
    const entryRank = statusRank[entry.status] || 0;

    if (claimRank >= entryRank || entry.status === 'available') {
      entry.status = claim.status;
      if (claim.claimedBy) entry.claimedBy = claim.claimedBy;
      if (claim.prLink) entry.prLink = claim.prLink;
    }
  });

  return entries;
}

export { initFirebase, saveClaim, removeClaim, canModifyClaim, applyClaimsToEntries, liveClaims, currentUser, isLeadUser };
