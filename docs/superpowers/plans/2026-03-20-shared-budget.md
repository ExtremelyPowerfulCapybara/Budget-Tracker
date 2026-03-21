# Shared Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow couples/small groups to share a budget in BudgetLog, with personal and shared contexts switchable per user.

**Architecture:** A new `spaces/{spaceId}` Firestore collection holds the shared budget (same shape as a user doc plus metadata). Each `users/{uid}` doc gets a `spaceId` pointer. The `userDocRef` variable in `index.html` is swapped between personal and shared on context switch — all existing load/save paths work without modification.

**Tech Stack:** Plain JS (IIFE modules), Firebase Firestore, Firebase Auth (Google only), Firebase Cloud Functions (Node.js), Chart.js (untouched)

**Spec:** `docs/superpowers/specs/2026-03-20-shared-budget-design.md`

---

## File Map

| File | What changes |
|---|---|
| `firestore.rules` | Add `spaces` and `invites` rules |
| `firestore.indexes.json` | **Create** — composite index on `invites` |
| `functions/index.js` | Add `getPendingInvite`, `removeMember`, `deleteSpace` callable functions |
| `js/core/cloud.js` | Add optional `onRawDoc` callback to `loadUserState` |
| `js/features/entries.js` | `createdBy` badge, `buildMemberFilters`, member filter in `filterEntries` |
| `index.html` | Shared state vars, context routing, switcher UI, invite banner, user modal changes, entry attribution, member filter wiring |

`js/core/storage.js` — **no changes needed.**

---

## Task 1: Firestore Rules + Index

**Files:**
- Modify: `firestore.rules`
- Create: `firestore.indexes.json`

- [ ] **Step 1: Replace `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /spaces/{spaceId} {
      allow read, write: if request.auth != null
        && request.auth.uid in resource.data.members;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.createdBy;
      allow update: if request.auth != null
        && !(request.auth.uid in resource.data.members)
        && request.resource.data.members.hasAll(resource.data.members)
        && request.resource.data.members.size() == resource.data.members.size() + 1
        && request.auth.uid in request.resource.data.members;
    }

    match /invites/{inviteId} {
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.inviterUid
        && request.auth.uid in get(/databases/$(database)/documents/spaces/$(request.resource.data.spaceId)).data.members;
      allow read, update: if request.auth != null
        && request.auth.uid == resource.data.inviterUid;
      allow read, update: if request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email == resource.data.inviteeEmail;
    }

  }
}
```

- [ ] **Step 2: Create `firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "invites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "inviteeEmail", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 3: Deploy rules and indexes**

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Expected: `Deploy complete!` with no errors.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat(shared-budget): add Firestore rules and indexes for spaces and invites"
```

---

## Task 2: Cloud Functions

**Files:**
- Modify: `functions/index.js`

Add three callable functions at the end of the file (after the existing `weeklyDigest` export).

- [ ] **Step 1: Add `getPendingInvite` function**

Append to `functions/index.js`:

```js
// Returns the caller's pending invite, if any.
// Called on every login — uses Admin SDK to query server-side (no client list permission needed).
exports.getPendingInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const email = context.auth.token.email;
  if (!email) throw new functions.https.HttpsError('failed-precondition', 'No email on account');

  const db = admin.firestore();
  const snap = await db.collection('invites')
    .where('inviteeEmail', '==', email)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
});
```

- [ ] **Step 2: Add `removeMember` function**

```js
// Atomically removes a member from a space and clears their spaceId pointer.
// Only the space creator can call this. Creator cannot remove themselves.
exports.removeMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const { spaceId, memberUid } = data;
  if (!spaceId || !memberUid) throw new functions.https.HttpsError('invalid-argument', 'spaceId and memberUid required');

  const db = admin.firestore();
  await db.runTransaction(async (tx) => {
    const spaceRef = db.collection('spaces').doc(spaceId);
    const spaceDoc = await tx.get(spaceRef);
    if (!spaceDoc.exists) throw new functions.https.HttpsError('not-found', 'Space not found');

    const spaceData = spaceDoc.data();
    if (spaceData.createdBy !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the creator can remove members');
    }
    if (memberUid === spaceData.createdBy) {
      throw new functions.https.HttpsError('invalid-argument', 'Creator cannot be removed');
    }

    const memberRef = db.collection('users').doc(memberUid);
    tx.update(spaceRef, { members: admin.firestore.FieldValue.arrayRemove(memberUid) });
    tx.update(memberRef, { spaceId: null });
  });

  return { success: true };
});
```

- [ ] **Step 3: Add `deleteSpace` function**

```js
// Deletes a shared space: clears all members' spaceId, deletes the space doc,
// and cleans up any pending invites for the space.
// Only the space creator can call this.
exports.deleteSpace = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const { spaceId } = data;
  if (!spaceId) throw new functions.https.HttpsError('invalid-argument', 'spaceId required');

  const db = admin.firestore();

  // Transaction: read members, clear their spaceId, delete space doc
  await db.runTransaction(async (tx) => {
    const spaceRef = db.collection('spaces').doc(spaceId);
    const spaceDoc = await tx.get(spaceRef);
    if (!spaceDoc.exists) throw new functions.https.HttpsError('not-found', 'Space not found');

    const spaceData = spaceDoc.data();
    if (spaceData.createdBy !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the creator can delete the space');
    }

    const members = spaceData.members || [];
    for (const uid of members) {
      tx.update(db.collection('users').doc(uid), { spaceId: null });
    }
    tx.delete(spaceRef);
  });

  // Clean up orphaned invites (batched write, outside transaction)
  const invitesSnap = await db.collection('invites').where('spaceId', '==', spaceId).get();
  if (!invitesSnap.empty) {
    const batch = db.batch();
    invitesSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  return { success: true };
});
```

- [ ] **Step 4: Deploy functions**

```bash
firebase deploy --only functions
```

Expected: `Deploy complete!` — three new functions listed: `getPendingInvite`, `removeMember`, `deleteSpace`.

- [ ] **Step 5: Commit**

```bash
git add functions/index.js
git commit -m "feat(shared-budget): add getPendingInvite, removeMember, deleteSpace Cloud Functions"
```

---

## Task 3: cloud.js — `onRawDoc` callback

**Files:**
- Modify: `js/core/cloud.js`

This allows `index.html` to capture raw doc fields (`spaceId`, `name`, `members`, etc.) from the Firestore document before `normalizeState` strips them.

- [ ] **Step 1: Add `onRawDoc` to the options destructure in `loadUserState`**

In `js/core/cloud.js`, find the destructure block at the top of `loadUserState` (lines 21–31) and add `onRawDoc`:

```js
// Before (line 21):
async function loadUserState(options){
  const {
    userDocRef,
    defaultGoals,
    sanitizeRecurringRule,
    readLocalState,
    applyState,
    applyCustomCategories,
    hasAnyEntries,
    persistUserState,
    setSyncState,
    showToast
  }=options;

// After:
async function loadUserState(options){
  const {
    userDocRef,
    defaultGoals,
    sanitizeRecurringRule,
    readLocalState,
    applyState,
    applyCustomCategories,
    hasAnyEntries,
    persistUserState,
    setSyncState,
    showToast,
    onRawDoc
  }=options;
```

- [ ] **Step 2: Call `onRawDoc` in the `doc.exists` branch**

In the `try` block, find `applyState(doc.data())` (line 37) and add the callback call just before it:

```js
// Before:
      applyState(doc.data());

// After:
      if(typeof onRawDoc==='function')onRawDoc(doc.data());
      applyState(doc.data());
```

- [ ] **Step 3: Verify the change looks correct**

Read `js/core/cloud.js` lines 19–55 and confirm the two additions are in the right places with no syntax errors.

- [ ] **Step 4: Commit**

```bash
git add js/core/cloud.js
git commit -m "feat(shared-budget): add onRawDoc callback to loadUserState"
```

---

## Task 4: index.html — Shared State Vars + Context Routing

**Files:**
- Modify: `index.html`

This task wires the shared-context plumbing into the existing load/save/auth flow. No UI yet — that comes in Tasks 5–7.

- [ ] **Step 1: Add firebase-functions-compat.js script tag**

After line 746 (the messaging compat script tag), add:

```html
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js"></script>
```

- [ ] **Step 2: Add shared context state vars**

After line 797 (`let recurFreq=...`), add a new line:

```js
// Shared budget context
let activeContext='personal',spaceId=null,spaceMeta=null,activeMemberFilter='all';
```

- [ ] **Step 3: Modify `applyState` to capture space metadata**

Current (line 803):
```js
function applyState(nextState){
  ({entries,goals,recurring,savingsGoals,customCategories}=normalizeState(nextState,{defaultGoals:DEFAULT_GOALS,sanitizeRecurringRule}));
}
```

Replace with:
```js
function applyState(nextState){
  ({entries,goals,recurring,savingsGoals,customCategories}=normalizeState(nextState,{defaultGoals:DEFAULT_GOALS,sanitizeRecurringRule}));
  // Capture space metadata if present (stripped by normalizeState, so read before it runs — but
  // onRawDoc handles the pre-normalize read. applyState itself is called after normalizeState, so
  // metadata must be captured via onRawDoc in loadFromFirestore, not here.)
}
```

Wait — the metadata is captured in `onRawDoc` in `loadFromFirestore` (next step), not in `applyState`. No change needed to `applyState`.

- [ ] **Step 4: Modify `loadFromFirestore` to capture `spaceId` and `spaceMeta` via `onRawDoc`**

Current (lines 1061–1074):
```js
async function loadFromFirestore(){
  await loadUserState({
    userDocRef,
    defaultGoals:DEFAULT_GOALS,
    sanitizeRecurringRule,
    readLocalState,
    applyState,
    applyCustomCategories,
    hasAnyEntries,
    persistUserState:()=>persistToFirestore(),
    setSyncState,
    showToast
  });
}
```

Replace with:
```js
async function loadFromFirestore(){
  await loadUserState({
    userDocRef,
    defaultGoals:DEFAULT_GOALS,
    sanitizeRecurringRule,
    readLocalState,
    applyState,
    applyCustomCategories,
    hasAnyEntries,
    persistUserState:()=>persistToFirestore(),
    setSyncState,
    showToast,
    onRawDoc:(data)=>{
      if(activeContext==='personal'){
        // Capture the user's shared space pointer (not processed by normalizeState)
        if(data.spaceId)spaceId=data.spaceId;
      }else{
        // Capture space metadata
        spaceMeta={name:data.name||'Hogar',createdBy:data.createdBy||'',members:Array.isArray(data.members)?data.members:[]};
      }
    }
  });
}
```

- [ ] **Step 5: Modify `persistToFirestore` to spread space metadata in shared context**

Current (lines 1075–1083):
```js
async function persistToFirestore(){
  await persistUserState({
    userDocRef,
    firebase,
    state:getStateSnapshot(),
    serializeCloudState,
    setSyncState
  });
}
```

Replace with:
```js
async function persistToFirestore(){
  const serialize=activeContext==='personal'
    ?serializeCloudState
    :(s)=>({...serializeCloudState(s),name:spaceMeta.name,createdBy:spaceMeta.createdBy,members:spaceMeta.members});
  await persistUserState({
    userDocRef,
    firebase,
    state:getStateSnapshot(),
    serializeCloudState:serialize,
    setSyncState
  });
}
```

- [ ] **Step 6: Add `switchContext` function and `renderAll` helper**

After `persistToFirestore`, add:

```js
function renderAll(){applyCustomCategories();renderDashboard();renderEntries();renderRecurring();renderSavingsGoals();updateMonthLabels();}
async function switchContext(ctx){
  if(ctx===activeContext)return;
  activeContext=ctx;
  activeMemberFilter='all';
  if(ctx==='personal'){
    userDocRef=db.collection('users').doc(currentUser.uid);
    spaceMeta=null;
  }else{
    userDocRef=db.collection('spaces').doc(ctx);
  }
  await loadFromFirestore();
  renderAll();
  document.querySelectorAll('.ctx-pill').forEach(p=>p.classList.toggle('active',p.dataset.ctx===ctx));
}
```

- [ ] **Step 7: Modify `signOut` to reset shared state**

Current (line 1060):
```js
async function signOut(){closeUserModal();await auth.signOut();applyState(createEmptyState(DEFAULT_GOALS));showToast('Sesión cerrada');}
```

Replace with:
```js
async function signOut(){closeUserModal();await auth.signOut();applyState(createEmptyState(DEFAULT_GOALS));activeContext='personal';spaceId=null;spaceMeta=null;activeMemberFilter='all';showToast('Sesión cerrada');}
```

- [ ] **Step 8: Modify `onAuthStateChanged` to check for pending invite after login**

Current (lines 1021–1024):
```js
auth.onAuthStateChanged(async user=>{
  if(user){currentUser=user;userDocRef=createUserDocRef(db,user);await loadFromFirestore();showApp(user);}
  else{currentUser=null;userDocRef=null;showAuth();}
});
```

Replace with:
```js
auth.onAuthStateChanged(async user=>{
  if(user){
    currentUser=user;
    userDocRef=createUserDocRef(db,user);
    activeContext='personal';
    spaceId=null;
    spaceMeta=null;
    await loadFromFirestore();
    // If user already has a shared space, show the context switcher
    if(spaceId)showContextSwitcher(spaceId);
    // Check for pending invite
    try{
      const fn=firebase.functions().httpsCallable('getPendingInvite');
      const result=await fn();
      if(result.data)showInviteBanner(result.data);
    }catch(e){console.warn('Invite check:',e.message);}
    showApp(user);
  }else{
    currentUser=null;userDocRef=null;activeContext='personal';spaceId=null;spaceMeta=null;
    document.getElementById('contextSwitcher').style.display='none';
    document.getElementById('inviteBanner').style.display='none';
    showAuth();
  }
});
```

- [ ] **Step 9: Verify no syntax errors**

Open the app in a browser. Sign in. Confirm the console shows no errors and the app loads normally (personal context, switcher hidden).

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): add context routing, shared state vars, onAuthStateChanged invite check"
```

---

## Task 5: Context Switcher + Invite Banner UI

**Files:**
- Modify: `index.html`

Add the context switcher pill in the header and the invite banner above the nav bar.

- [ ] **Step 1: Add CSS for context switcher**

In the `<style>` block, add after the existing header styles:

```css
/* Context switcher */
#contextSwitcher{display:none;flex-direction:row;gap:4px;align-items:center;}
.ctx-pill{background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:20px;padding:4px 12px;font-family:var(--font-ui);font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;}
.ctx-pill.active{background:var(--accent);border-color:var(--accent);color:#fff;}

/* Invite banner */
#inviteBanner{display:none;background:var(--surface);border-bottom:1px solid var(--border);padding:10px 16px;gap:10px;align-items:center;font-size:13px;color:var(--text);}
.invite-banner-text{flex:1;}
.invite-banner-actions{display:flex;gap:8px;flex-shrink:0;}
.invite-accept-btn{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:6px 14px;font-family:var(--font-ui);font-size:12px;font-weight:600;cursor:pointer;}
.invite-decline-btn{background:var(--surface2);color:var(--muted);border:1px solid var(--border);border-radius:10px;padding:6px 14px;font-family:var(--font-ui);font-size:12px;cursor:pointer;}
```

- [ ] **Step 2: Add context switcher HTML in the header**

Find the header HTML (around line 505–509):
```html
      <button class="theme-toggle" id="themeToggle" ...>...</button>
      <button class="header-export" id="exportBtn" ...>...</button>
      <div id="avatarWrap"></div>
```

Add the switcher div before `avatarWrap`:
```html
      <button class="theme-toggle" id="themeToggle" aria-label="Cambiar tema">&#9728;</button>
      <button class="header-export" id="exportBtn" aria-label="Exportar datos">&#8659; Exportar</button>
      <div id="contextSwitcher">
        <button class="ctx-pill active" data-ctx="personal">Yo</button>
        <button class="ctx-pill" data-ctx="__space__">Hogar</button>
      </div>
      <div id="avatarWrap"></div>
```

Note: the space pill's `data-ctx` will be set dynamically to the actual `spaceId` by `showContextSwitcher`.

- [ ] **Step 3: Add invite banner HTML**

Immediately after the `<div id="appShell">` opening tag (search for `id="appShell"`), find where the nav bar starts and add the banner div just before the tab bar:

Add this right before `<nav class="tab-bar"` (or equivalent nav element):
```html
<div id="inviteBanner" style="display:none;flex-direction:row;">
  <div class="invite-banner-text" id="inviteBannerText"></div>
  <div class="invite-banner-actions">
    <button class="invite-accept-btn" id="inviteAcceptBtn">Aceptar</button>
    <button class="invite-decline-btn" id="inviteDeclineBtn">Rechazar</button>
  </div>
</div>
```

- [ ] **Step 4: Add `showContextSwitcher` and `showInviteBanner` functions**

After the `renderAll` function added in Task 4, add:

```js
function showContextSwitcher(sid){
  const sw=document.getElementById('contextSwitcher');
  sw.style.display='flex';
  // Update the space pill's data-ctx to the real spaceId
  const spacePill=sw.querySelector('[data-ctx="__space__"]');
  if(spacePill)spacePill.dataset.ctx=sid;
  // Update active state
  sw.querySelectorAll('.ctx-pill').forEach(p=>p.classList.toggle('active',p.dataset.ctx===activeContext));
}

let pendingInviteData=null;
function showInviteBanner(invite){
  pendingInviteData=invite;
  document.getElementById('inviteBannerText').textContent=invite.inviterName+' te invitó al presupuesto compartido. ¿Aceptar?';
  document.getElementById('inviteBanner').style.display='flex';
}
async function acceptInvite(){
  if(!pendingInviteData)return;
  const inv=pendingInviteData;
  pendingInviteData=null;
  document.getElementById('inviteBanner').style.display='none';
  try{
    // Update invite status
    await db.collection('invites').doc(inv.id).update({status:'accepted'});
    // Add self to space members
    await db.collection('spaces').doc(inv.spaceId).update({
      members:firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
    // Set spaceId on user doc
    await db.collection('users').doc(currentUser.uid).update({spaceId:inv.spaceId});
    spaceId=inv.spaceId;
    showContextSwitcher(inv.spaceId);
    showToast('Te uniste al presupuesto compartido');
  }catch(e){console.error('acceptInvite:',e);showToast('Error al aceptar la invitación');}
}
async function declineInvite(){
  if(!pendingInviteData)return;
  const inv=pendingInviteData;
  pendingInviteData=null;
  document.getElementById('inviteBanner').style.display='none';
  try{
    await db.collection('invites').doc(inv.id).update({status:'declined'});
  }catch(e){console.warn('declineInvite:',e);}
}
```

- [ ] **Step 5: Wire context switcher and invite banner events in `bindStaticEvents`**

Inside `bindStaticEvents()`, add:

```js
  document.getElementById('contextSwitcher').addEventListener('click',event=>{
    const pill=event.target.closest('.ctx-pill');
    if(!pill)return;
    switchContext(pill.dataset.ctx);
  });
  document.getElementById('inviteAcceptBtn').addEventListener('click',acceptInvite);
  document.getElementById('inviteDeclineBtn').addEventListener('click',declineInvite);
```

- [ ] **Step 6: Verify**

Build a test scenario manually:
1. User A creates a shared space (Task 7 covers the UI — for now verify switcher shows/hides correctly by temporarily calling `showContextSwitcher('test-id')` from console).
2. Confirm `switchContext` changes `userDocRef` and reloads data.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): add context switcher pill and invite banner UI"
```

---

## Task 6: User Modal — Sharing + Member Management

**Files:**
- Modify: `index.html`

Add the "Compartir" and "Miembros" sections to the user modal.

- [ ] **Step 1: Add CSS for the new user modal sections**

In the `<style>` block, add:

```css
/* Shared budget sections in user modal */
.space-section{margin-top:16px;padding-top:16px;border-top:1px solid var(--border);}
.space-section-title{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;}
.member-row{display:flex;align-items:center;gap:10px;padding:6px 0;}
.member-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;}
.member-avatar-placeholder{width:28px;height:28px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted);font-weight:600;}
.member-name{flex:1;font-size:13px;color:var(--text);}
.member-remove-btn{background:none;border:none;color:var(--expense);font-size:16px;cursor:pointer;padding:2px 6px;line-height:1;}
.invite-input-row{display:flex;gap:8px;margin-top:8px;}
.invite-email-input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:8px 12px;font-family:var(--font-ui);font-size:13px;color:var(--text);}
.invite-email-input::placeholder{color:var(--muted);}
.invite-send-btn{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-family:var(--font-ui);font-size:13px;font-weight:600;cursor:pointer;}
.space-danger-btn{width:100%;background:none;border:1px solid var(--expense);color:var(--expense);border-radius:12px;padding:10px;font-family:var(--font-ui);font-size:13px;cursor:pointer;margin-top:10px;}
.leave-space-btn{width:100%;background:none;border:1px solid var(--border);color:var(--muted);border-radius:12px;padding:10px;font-family:var(--font-ui);font-size:13px;cursor:pointer;margin-top:10px;}
```

- [ ] **Step 2: Add placeholder HTML to user modal**

Find the user modal HTML (lines 644–652). After the `signOutBtn` button and before `</div></div>`, add:

```html
    <div id="spaceSections"></div>
```

The full user modal becomes:
```html
<div class="modal-overlay" id="userModal">
  <div class="user-modal">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><div class="modal-title" style="margin-bottom:0;">Cuenta</div><button class="modal-close" onclick="closeUserModal()" aria-label="Cerrar">&#10005;</button></div>
    <div class="user-info"><img class="user-avatar-lg" id="modalAvatar" src="" alt=""><div><div class="user-name" id="modalName"></div><div class="user-email" id="modalEmail"></div></div></div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:20px;font-size:12px;color:var(--muted);line-height:1.7;">Tus datos se sincronizan automáticamente con Firebase.</div>
    <button class="notif-btn" id="notifBtn">Activar notificaciones</button>
    <button class="signout-btn" id="signOutBtn" style="margin-top:10px;">Cerrar sesión</button>
    <div id="spaceSections"></div>
  </div>
</div>
```

- [ ] **Step 3: Add `renderUserModal` function**

This function rebuilds `#spaceSections` dynamically based on context and role:

```js
function renderUserModal(){
  const esc=window.BudgetLogCore.utils.esc;
  const el=document.getElementById('spaceSections');
  if(!currentUser)return;

  // No shared space yet — show invite input for any user
  if(!spaceId){
    el.innerHTML=
      '<div class="space-section">'+
        '<div class="space-section-title">Presupuesto compartido</div>'+
        '<p style="font-size:12px;color:var(--muted);margin-bottom:8px;">Comparte tu presupuesto con otra persona ingresando su correo de Google.</p>'+
        '<div class="invite-input-row">'+
          '<input class="invite-email-input" id="inviteEmailInput" type="email" placeholder="correo@gmail.com">'+
          '<button class="invite-send-btn" onclick="sendInvite()">Invitar</button>'+
        '</div>'+
      '</div>';
    return;
  }

  // Has a shared space — show members section
  const isCreator=spaceMeta&&spaceMeta.createdBy===currentUser.uid;
  const members=spaceMeta?spaceMeta.members:[];
  const memberRows=members.map(uid=>{
    const isSelf=uid===currentUser.uid;
    const isOwner=spaceMeta&&uid===spaceMeta.createdBy;
    const name=isSelf?(currentUser.displayName||currentUser.email):'UID: '+uid.slice(0,8)+'…';
    const removeBtn=isCreator&&!isSelf
      ?'<button class="member-remove-btn" onclick="removeMemberFromSpace(\''+esc(uid)+'\')" title="Eliminar miembro">&#10005;</button>'
      :'';
    return '<div class="member-row"><div class="member-avatar-placeholder">'+esc(name.charAt(0).toUpperCase())+'</div><div class="member-name">'+esc(name)+(isOwner?' <span style="font-size:10px;color:var(--muted);">(creador)</span>':'')+'</div>'+removeBtn+'</div>';
  }).join('');

  const inviteSection=isCreator&&members.length<6
    ?'<div class="space-section-title" style="margin-top:12px;">Invitar persona</div>'+
      '<div class="invite-input-row">'+
        '<input class="invite-email-input" id="inviteEmailInput" type="email" placeholder="correo@gmail.com">'+
        '<button class="invite-send-btn" onclick="sendInvite()">Invitar</button>'+
      '</div>'
    :'';

  const actionBtn=isCreator
    ?'<button class="space-danger-btn" onclick="deleteSharedSpace()">Eliminar presupuesto compartido</button>'+
      '<p style="font-size:11px;color:var(--muted);text-align:center;margin-top:6px;">Eres el creador. Para salir, elimina el presupuesto compartido.</p>'
    :'<button class="leave-space-btn" onclick="leaveSpace()">Salir del presupuesto compartido</button>';

  el.innerHTML=
    '<div class="space-section">'+
      '<div class="space-section-title">Miembros</div>'+
      memberRows+
      inviteSection+
      actionBtn+
    '</div>';
}
```

- [ ] **Step 4: Modify `openUserModal` to call `renderUserModal`**

Current (line ~1089):
```js
function openUserModal(){if(!currentUser)return;populateUserModal(currentUser);openShellModal('userModal');updateNotifBtn();}
```

Replace with:
```js
function openUserModal(){if(!currentUser)return;populateUserModal(currentUser);renderUserModal();openShellModal('userModal');updateNotifBtn();}
```

- [ ] **Step 5: Add invite/member action functions**

```js
async function sendInvite(){
  const input=document.getElementById('inviteEmailInput');
  if(!input)return;
  const email=input.value.trim().toLowerCase();
  if(!email||!email.includes('@')){showToast('Ingresa un correo válido');return;}
  if(email===currentUser.email){showToast('No puedes invitarte a ti mismo');return;}

  try{
    let sid=spaceId;
    // Create space if it doesn't exist yet
    if(!sid){
      sid=Date.now().toString();
      const spaceRef=db.collection('spaces').doc(sid);
      await spaceRef.set({
        name:'Hogar',
        createdBy:currentUser.uid,
        members:[currentUser.uid],
        entries:[],goals:{},recurring:[],savingsGoals:[],customCategories:{},
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('users').doc(currentUser.uid).update({spaceId:sid});
      spaceId=sid;
      showContextSwitcher(sid);
    }
    // Create invite (deterministic ID prevents duplicates)
    const inviteId=sid+'_'+email;
    await db.collection('invites').doc(inviteId).set({
      spaceId:sid,
      inviterUid:currentUser.uid,
      inviterName:currentUser.displayName||currentUser.email,
      inviteeEmail:email,
      status:'pending',
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
    input.value='';
    showToast('Invitación enviada a '+email);
    renderUserModal();
  }catch(e){console.error('sendInvite:',e);showToast('Error al enviar invitación');}
}

async function removeMemberFromSpace(memberUid){
  if(!confirm('¿Eliminar a este miembro del presupuesto compartido?'))return;
  try{
    const fn=firebase.functions().httpsCallable('removeMember');
    await fn({spaceId,memberUid});
    // Update local spaceMeta
    if(spaceMeta)spaceMeta.members=spaceMeta.members.filter(uid=>uid!==memberUid);
    renderUserModal();
    showToast('Miembro eliminado');
  }catch(e){console.error('removeMember:',e);showToast('Error al eliminar miembro');}
}

async function leaveSpace(){
  if(!confirm('¿Salir del presupuesto compartido? Volverás a tu presupuesto personal.'))return;
  try{
    await db.collection('spaces').doc(spaceId).update({
      members:firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
    });
    await db.collection('users').doc(currentUser.uid).update({spaceId:null});
    // Switch back to personal context
    spaceId=null;spaceMeta=null;
    await switchContext('personal');
    document.getElementById('contextSwitcher').style.display='none';
    closeUserModal();
    showToast('Saliste del presupuesto compartido');
  }catch(e){console.error('leaveSpace:',e);showToast('Error al salir');}
}

async function deleteSharedSpace(){
  if(!confirm('¿Eliminar el presupuesto compartido? Esta acción no se puede deshacer. Todos los miembros volverán a su presupuesto personal.'))return;
  try{
    const fn=firebase.functions().httpsCallable('deleteSpace');
    await fn({spaceId});
    spaceId=null;spaceMeta=null;
    await switchContext('personal');
    document.getElementById('contextSwitcher').style.display='none';
    closeUserModal();
    showToast('Presupuesto compartido eliminado');
  }catch(e){console.error('deleteSpace:',e);showToast('Error al eliminar el espacio');}
}
```

- [ ] **Step 6: Verify**

1. Open user modal → confirm `#spaceSections` shows "Presupuesto compartido" invite section.
2. Enter an email and click "Invitar" → confirm a `spaces/{id}` doc and `invites/{id}` doc are created in Firestore console.
3. Confirm context switcher appears in header after sending first invite.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): user modal sharing section and member management UI"
```

---

## Task 7: Entry Attribution — `entries.js`

**Files:**
- Modify: `js/features/entries.js`

Add `createdBy` badge rendering and member filter building. These are pure rendering changes — no Firebase calls.

- [ ] **Step 1: Add `buildMemberFilters` function**

After `buildEntryFilters` (line 5–15), add:

```js
  function buildMemberFilters(members,activeMemberFilter){
    if(!members||!members.length)return '';
    const allBtn='<button class="filter-chip'+(activeMemberFilter==='all'?' active':'')+'" data-member-filter="all">Todos</button>';
    const memberBtns=members.map(m=>'<button class="filter-chip'+(activeMemberFilter===m.uid?' active':'')+'" data-member-filter="'+esc(m.uid)+'">'+esc(m.displayName||m.uid.slice(0,6))+'</button>').join('');
    return allBtn+memberBtns;
  }
```

- [ ] **Step 2: Modify `renderEntryMarkup` to show `createdBy` badge**

In `renderEntryMarkup` (line 17), after the `const safeType=...` line and before the final `return`, find the entry-compact inner HTML. The entry-info div currently ends with `(entry.notes?...)`. Add the author badge after `.entry-amount`:

The current return has this structure inside `.entry-compact`:
```
<div class="entry-dot" ...></div>
<div class="entry-info">...</div>
<div class="entry-amount ...">...</div>
<div class="entry-actions">...</div>
```

Add a `createdBy` badge between `.entry-amount` and `.entry-actions`:

```js
// Add this variable before the return statement:
    const authorBadge=entry.createdBy
      ?'<div class="entry-author" title="'+esc(entry.createdBy.displayName||'')+'">'+
          (entry.createdBy.photoURL
            ?'<img class="entry-author-avatar" src="'+esc(entry.createdBy.photoURL)+'" referrerpolicy="no-referrer" alt="">'
            :'<div class="entry-author-initial">'+esc((entry.createdBy.displayName||'?').charAt(0).toUpperCase())+'</div>')+
        '</div>'
      :'';
```

Then in the return string, insert `+authorBadge+` between the amount div and the actions div.

- [ ] **Step 3: Modify `filterEntries` to support member filtering**

Current:
```js
  function filterEntries(entries,options){
    const {activeFilter,searchQuery,categories,formatMoney}=options;
    ...
```

Replace with:
```js
  function filterEntries(entries,options){
    const {activeFilter,searchQuery,categories,formatMoney,activeMemberFilter}=options;
    let filtered=entries;
    if(activeFilter==='income')filtered=entries.filter(entry=>entry.type==='income');
    else if(activeFilter==='expense')filtered=entries.filter(entry=>entry.type==='expense');
    else if(activeFilter!=='all')filtered=entries.filter(entry=>entry.category===activeFilter);

    if(activeMemberFilter&&activeMemberFilter!=='all'){
      filtered=filtered.filter(entry=>entry.createdBy&&entry.createdBy.uid===activeMemberFilter);
    }

    if(!searchQuery)return filtered;
    return filtered.filter(entry=>{
      const categoryLabel=(categories.find(category=>category.id===entry.category)?.label||'').toLowerCase();
      return entry.description.toLowerCase().includes(searchQuery)||formatMoney(entry.amount).includes(searchQuery)||categoryLabel.includes(searchQuery);
    });
  }
```

- [ ] **Step 4: Export `buildMemberFilters`**

At the bottom of `entries.js`, update the export:

```js
  root.entriesFeature={
    buildEntryFilters,
    buildMemberFilters,
    renderEntryMarkup,
    filterEntries,
    renderEntriesListMarkup
  };
```

- [ ] **Step 5: Add CSS for `createdBy` badge**

In `index.html`'s `<style>` block:

```css
/* Entry author badge (shared context) */
.entry-author{display:flex;align-items:center;justify-content:center;margin-right:4px;}
.entry-author-avatar{width:20px;height:20px;border-radius:50%;object-fit:cover;border:1px solid var(--border);}
.entry-author-initial{width:20px;height:20px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--muted);}
/* Member filter row */
#memberFilterRow{display:none;padding:0 16px 8px;}
```

- [ ] **Step 6: Commit**

```bash
git add js/features/entries.js index.html
git commit -m "feat(shared-budget): createdBy badge on entry cards, member filter in entries.js"
```

---

## Task 8: Entry Attribution Wiring + Member Filter (index.html)

**Files:**
- Modify: `index.html`

Wire the member filter UI and attach `createdBy` when logging/editing in shared context.

- [ ] **Step 1: Add member filter row HTML to entries view**

Find the entries view section (search for `id="view-entries"`). After the existing `#filterRow` div, add:

```html
<div id="memberFilterRow"></div>
```

- [ ] **Step 2: Modify `renderEntries` to render member filter and pass `activeMemberFilter`**

Find the `renderEntries` function. It calls `filterEntriesFeature` — update the options object to include `activeMemberFilter`:

```js
// In the filterEntriesFeature call, add:
activeMemberFilter
```

Also, add member filter row rendering at the top of `renderEntries`. Find where `buildEntryFilters` is called, and after that, add:

```js
  // Member filter (shared context only)
  const memberFilterEl=document.getElementById('memberFilterRow');
  if(activeContext!=='personal'&&spaceMeta&&spaceMeta.members.length>1){
    // Derive display names from stored createdBy fields on entries (most accurate source)
    const nameMap={};
    entries.forEach(e=>{if(e.createdBy&&e.createdBy.uid)nameMap[e.createdBy.uid]=e.createdBy.displayName||e.createdBy.uid.slice(0,8);});
    // Self is always known
    if(currentUser)nameMap[currentUser.uid]=currentUser.displayName||currentUser.email;
    const memberObjects=spaceMeta.members.map(uid=>({
      uid,
      displayName:nameMap[uid]||uid.slice(0,8)
    }));
    memberFilterEl.innerHTML=buildMemberFilters(memberObjects,activeMemberFilter);
    memberFilterEl.style.display='';
  }else{
    memberFilterEl.innerHTML='';
    memberFilterEl.style.display='none';
  }
```

- [ ] **Step 3: Wire member filter click events in `bindStaticEvents`**

Inside `bindStaticEvents()`, add:

```js
  document.getElementById('memberFilterRow').addEventListener('click',event=>{
    const btn=event.target.closest('[data-member-filter]');
    if(!btn)return;
    activeMemberFilter=btn.dataset.memberFilter;
    renderEntries();
  });
```

- [ ] **Step 4: Modify `logEntry` to attach `createdBy` in shared context**

Find `logEntry` (line ~1113). The current entry object being pushed is:
```js
{id:Date.now().toString(),type:currentType,amount,description:desc,notes,category:...,date,goalId:...}
```

Add `createdBy` field:
```js
// Before entries.unshift:
const createdByField=activeContext!=='personal'&&currentUser
  ?{createdBy:{uid:currentUser.uid,displayName:currentUser.displayName||'',photoURL:currentUser.photoURL||''}}
  :{};
// Change entries.unshift to:
entries.unshift({id:Date.now().toString(),type:currentType,amount,description:desc,notes,category:currentType==='expense'?currentCat:'income',date,goalId:currentType==='expense'&&currentCat==='savings'?goalId:null,...createdByField});
```

- [ ] **Step 5: Add 500-entry limit guard in `logEntry`**

At the top of `logEntry`, before the amount/desc validation, add:

```js
  if(activeContext!=='personal'&&entries.length>=500){
    showToast('Límite de 500 movimientos alcanzado. Exporta y limpia movimientos antiguos.');
    return;
  }
  if(activeContext!=='personal'&&entries.length>=450){
    showToast('Advertencia: acercándote al límite de 500 movimientos del presupuesto compartido.');
  }
```

- [ ] **Step 6: Reset `activeMemberFilter` on context switch**

This is already done in `switchContext` (Task 4, Step 6) — confirm it's there.

- [ ] **Step 7: Verify end-to-end in shared context**

1. Switch to shared context.
2. Add an entry — confirm it appears with the author badge.
3. Member filter row appears — clicking a member name filters the list.
4. Confirm `createdBy` is stored in Firestore.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): entry attribution wiring, member filter UI, 500-entry limit guard"
```

---

## Task 9: Deploy Everything

- [ ] **Step 1: Verify no outstanding changes**

```bash
git status
```

Expected: clean working tree.

- [ ] **Step 2: Deploy**

```bash
firebase deploy
```

This deploys hosting (index.html, js/), functions, and Firestore rules/indexes in one shot.

Expected: `Deploy complete!` — hosting, functions, Firestore rules listed.

- [ ] **Step 3: Smoke test on live app**

1. Open https://budgetlog-b318d.web.app — sign in.
2. Open user modal → "Presupuesto compartido" section visible.
3. Invite a second Google account by email.
4. Sign in with that second account → invite banner appears → accept.
5. Both accounts can switch context with `[ Yo ] [ Hogar ]` pills.
6. First account adds an entry in shared context → second account switches to shared context → entry visible with author badge.
7. Member filter filters by author.
8. First account removes second account from user modal → second account's switcher disappears on next reload.

- [ ] **Step 4: Tag the release**

```bash
git tag -a "backup/shared-budget-v1" -m "Shared budget feature complete"
git push origin main --tags
```

---

## Implementation Notes

### `userDocRef` is the single routing lever
Both `loadFromFirestore` and `persistToFirestore` close over `userDocRef`. Swapping it in `switchContext` is all that's needed — no other changes to the load/save flow.

### Space metadata is not in `normalizeState`
`normalizeState` strips unknown fields. Always read `name`, `createdBy`, `members` from the raw doc via `onRawDoc` before `applyState` runs. Never try to read them from the normalized state.

### `serializeCloudState` whitelist is preserved
The space save path passes a custom `serialize` function to `persistUserState` that wraps `serializeCloudState` and spreads metadata. The whitelist itself is not touched.

### `spaceId` on user doc uses `update()`, not `set()`
`persistUserState` calls `userDocRef.set(...)` which overwrites the doc. Writing `spaceId` always uses `userDocRef.update({spaceId})` separately to avoid being clobbered.

### Firebase Functions compat SDK
`firebase-functions-compat.js` must be loaded (Task 4, Step 1) before any `firebase.functions().httpsCallable(...)` calls. The callable function pattern is: `const fn = firebase.functions().httpsCallable('name'); const result = await fn(data); result.data` is the return value.

### Invite create rule cross-reads the space doc
The Firestore `allow create` rule on `invites` does a `get()` on the space doc to verify the caller is a member. This means a space must exist before the first invite is created — the `sendInvite` function creates the space first if `spaceId` is null.
