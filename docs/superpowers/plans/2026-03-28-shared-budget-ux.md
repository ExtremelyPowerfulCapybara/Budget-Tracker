# Shared Budget UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real member names instead of UID prefixes in the Miembros section, and let the creator rename the shared budget.

**Architecture:** Both features are purely client-side changes in `index.html`. Member names are stored in a new `memberNames: {uid: string}` map on the space Firestore doc — written when creating or joining a space, read as part of `spaceMeta`. Rename writes `spaces/{spaceId}.name` via Firestore update and refreshes local state + the context switcher option text.

**Tech Stack:** Plain JS, Firebase Firestore (client SDK), no bundler.

---

## Files Modified

| File | Changes |
|---|---|
| `index.html` | All changes — `spaceMeta` shape, space creation, `acceptInvite`, `openUserModal`, `onRawDoc`, `renderUserModal`, new `renameSpace()` function, context switcher name update |

---

### Task 1: Store `memberNames` when creating a space

**Files:**
- Modify: `index.html` — `sendInvite()` function, space creation block (~line 1338)

The space doc currently gets `name`, `createdBy`, `members`, etc. Add `memberNames` with the creator's display name.

- [ ] **Step 1: Find the space creation block in `sendInvite()`**

In `index.html`, locate the block starting at ~line 1338:
```js
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
```

- [ ] **Step 2: Add `memberNames` to the space doc on creation**

Replace the `spaceRef.set(...)` call with:
```js
await spaceRef.set({
  name:'Hogar',
  createdBy:currentUser.uid,
  members:[currentUser.uid],
  memberNames:{[currentUser.uid]:currentUser.displayName||currentUser.email||currentUser.uid},
  entries:[],goals:{},recurring:[],savingsGoals:[],customCategories:{},
  updatedAt:firebase.firestore.FieldValue.serverTimestamp()
});
```

- [ ] **Step 3: Update local `spaceMeta` initialization to include `memberNames`**

Two lines below the `spaceRef.set(...)` call, the local `spaceMeta` is set:
```js
spaceMeta={name:'Hogar',createdBy:currentUser.uid,members:[currentUser.uid]};
```
Replace with:
```js
spaceMeta={name:'Hogar',createdBy:currentUser.uid,members:[currentUser.uid],memberNames:{[currentUser.uid]:currentUser.displayName||currentUser.email||currentUser.uid}};
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): store memberNames on space creation"
```

---

### Task 2: Store `memberNames` when accepting an invite

**Files:**
- Modify: `index.html` — `acceptInvite()` function (~line 1110)

When a user accepts an invite, write their name into the space's `memberNames` map using Firestore dot notation.

- [ ] **Step 1: Locate `acceptInvite()` (~line 1116)**

Find the block that updates the space doc:
```js
await db.collection('spaces').doc(inv.spaceId).update({
  members:firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
});
```

- [ ] **Step 2: Add `memberNames` entry in the same update call**

Replace with:
```js
await db.collection('spaces').doc(inv.spaceId).update({
  members:firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
  ['memberNames.'+currentUser.uid]:currentUser.displayName||currentUser.email||currentUser.uid
});
```

(Firestore dot notation `memberNames.{uid}` merges into the map without overwriting other members' names.)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): store memberName when accepting invite"
```

---

### Task 3: Include `memberNames` in `spaceMeta` everywhere it is built

There are two places `spaceMeta` is constructed from a Firestore raw doc:

1. `onRawDoc` callback in `loadFromFirestore()` (~line 1223) — called when switching to shared context
2. `openUserModal()` on-demand load (~line 1263) — called when modal opens and spaceMeta is null

**Files:**
- Modify: `index.html` — both spaceMeta construction sites

- [ ] **Step 1: Update `onRawDoc` in `loadFromFirestore()` (~line 1223)**

Find:
```js
spaceMeta={name:data.name||'Hogar',createdBy:data.createdBy||'',members:Array.isArray(data.members)?data.members:[]};
```
Replace with:
```js
spaceMeta={name:data.name||'Hogar',createdBy:data.createdBy||'',members:Array.isArray(data.members)?data.members:[],memberNames:data.memberNames||{}};
```

- [ ] **Step 2: Update on-demand load in `openUserModal()` (~line 1263)**

Find:
```js
if(doc.exists){const d=doc.data();spaceMeta={name:d.name||'Hogar',createdBy:d.createdBy||'',members:Array.isArray(d.members)?d.members:[]};}
```
Replace with:
```js
if(doc.exists){const d=doc.data();spaceMeta={name:d.name||'Hogar',createdBy:d.createdBy||'',members:Array.isArray(d.members)?d.members:[],memberNames:d.memberNames||{}};}
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): include memberNames in spaceMeta"
```

---

### Task 4: Show member names in `renderUserModal()`

**Files:**
- Modify: `index.html` — `renderUserModal()` member name resolution (~line 1296)

- [ ] **Step 1: Locate the name resolution line (~line 1296)**

Find:
```js
const name=isSelf?(currentUser.displayName||currentUser.email):'UID: '+uid.slice(0,8)+'…';
```

- [ ] **Step 2: Replace with `memberNames` lookup with UID fallback**

Replace with:
```js
const name=isSelf?(currentUser.displayName||currentUser.email):(spaceMeta.memberNames&&spaceMeta.memberNames[uid])||uid.slice(0,8)+'…';
```

This shows the stored display name for other members, falling back to a short UID prefix only if the name wasn't recorded (e.g., members who joined before this feature).

- [ ] **Step 3: Verify in app**

- Open the user modal while in a shared space that has another member
- The other member row should show their Google display name or email instead of "UID: xxxxxxxx…"
- Your own row still shows your name correctly
- The avatar placeholder letter updates to match the first letter of the real name

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): show member display names in Miembros section"
```

---

### Task 5: Add rename field to the user modal (UI)

**Files:**
- Modify: `index.html` — `renderUserModal()` space section HTML (~line 1316), CSS block

- [ ] **Step 1: Add CSS for the rename input**

Find the CSS block for `.space-section-title` (search for `space-section-title` in the `<style>` block). Add after it:

```css
.space-name-input{background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font-ui);font-size:14px;font-weight:600;padding:4px 8px;width:100%;box-sizing:border-box;margin-bottom:8px;}
.space-name-input:focus{outline:none;border-color:var(--accent);}
.space-name-save-btn{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-family:var(--font-ui);font-size:13px;cursor:pointer;margin-bottom:8px;}
```

- [ ] **Step 2: Add the rename input at the top of the members section in `renderUserModal()`**

Find the `el.innerHTML=` block that starts the members section (~line 1316):
```js
el.innerHTML=
  '<div class="space-section">'+
    '<div class="space-section-title">Miembros</div>'+
    memberRows+
```
Replace with:
```js
const spaceNameField=isCreator
  ?'<input class="space-name-input" id="spaceNameInput" type="text" value="'+esc(spaceMeta.name||'Hogar')+'" placeholder="Nombre del presupuesto" maxlength="40">'+
   '<button class="space-name-save-btn" onclick="renameSpace()">Guardar nombre</button>'
  :'<div class="space-section-title" style="font-size:15px;font-weight:700;margin-bottom:8px;">'+esc(spaceMeta.name||'Hogar')+'</div>';

el.innerHTML=
  '<div class="space-section">'+
    spaceNameField+
    '<div class="space-section-title">Miembros</div>'+
    memberRows+
```

- [ ] **Step 3: Verify UI renders**

- Open user modal while in shared context as creator
- Should see a text input pre-filled with the current space name (e.g. "Hogar") and a "Guardar nombre" button above the Miembros heading
- As a non-creator member, should see the space name as a plain bold heading

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): add rename input to user modal"
```

---

### Task 6: Implement `renameSpace()` function

**Files:**
- Modify: `index.html` — add `renameSpace()` after `deleteSharedSpace()` (~line 1411)

- [ ] **Step 1: Add the `renameSpace()` function**

After the closing `}` of `deleteSharedSpace()` (~line 1411), add:

```js
async function renameSpace(){
  const input=document.getElementById('spaceNameInput');
  if(!input)return;
  const newName=input.value.trim();
  if(!newName){showToast('El nombre no puede estar vacío');return;}
  if(newName===(spaceMeta&&spaceMeta.name)){showToast('Sin cambios');return;}
  try{
    await db.collection('spaces').doc(spaceId).update({name:newName});
    if(spaceMeta)spaceMeta.name=newName;
    // Update context switcher option text
    const spaceOpt=document.getElementById('contextSwitcher').querySelector('[data-ctx-type="space"]');
    if(spaceOpt)spaceOpt.textContent=newName;
    showToast('Nombre actualizado');
  }catch(e){console.error('renameSpace:',e);showToast('Error al renombrar');}
}
```

- [ ] **Step 2: Verify rename works end-to-end**

- Open user modal as creator
- Change name in the input to "Casa" and press "Guardar nombre"
- Toast "Nombre actualizado" appears
- The context switcher dropdown now shows "Casa" instead of "Hogar"
- Reload the app — after switching to shared context, the modal should still show "Casa"

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(shared-budget): implement renameSpace function"
```

---

### Task 7: Update context switcher text to reflect space name on load

**Files:**
- Modify: `index.html` — `showContextSwitcher()` (~line 1093)

Currently `showContextSwitcher` sets the option's `value` but not its `textContent`. The label stays "Hogar" even if the space was renamed.

- [ ] **Step 1: Locate `showContextSwitcher(sid)` (~line 1093)**

Find:
```js
function showContextSwitcher(sid){
  const sw=document.getElementById('contextSwitcher');
  sw.style.display='block';
  // Update the Hogar option value to the real spaceId
  const spaceOpt=sw.querySelector('[data-ctx-type="space"]');
  if(spaceOpt)spaceOpt.value=sid;
  // Reflect current context
  sw.value=activeContext;
}
```

- [ ] **Step 2: Also set the option's display text from `spaceMeta`**

Replace with:
```js
function showContextSwitcher(sid){
  const sw=document.getElementById('contextSwitcher');
  sw.style.display='block';
  const spaceOpt=sw.querySelector('[data-ctx-type="space"]');
  if(spaceOpt){
    spaceOpt.value=sid;
    spaceOpt.textContent=spaceMeta&&spaceMeta.name?spaceMeta.name:'Hogar';
  }
  sw.value=activeContext;
}
```

Note: `showContextSwitcher` is called after `spaceMeta` is populated (either from `loadFromFirestore` or `openUserModal` on-demand load), so `spaceMeta.name` will be available.

- [ ] **Step 3: Verify**

- Sign in. If you have a shared space named "Casa", the context switcher dropdown should show "Casa" not "Hogar".

- [ ] **Step 4: Deploy and final commit**

```bash
firebase deploy --only hosting
git add index.html
git commit -m "feat(shared-budget): show space name in context switcher"
```

---

## Self-Review

**Spec coverage:**
- ✅ Member names shown in Miembros section (Tasks 1–4)
- ✅ Rename shared budget (Tasks 5–6)
- ✅ Context switcher reflects current name (Task 7)

**Placeholder scan:** None found — all steps have exact code.

**Type consistency:**
- `spaceMeta.memberNames` — used consistently in Tasks 1, 2, 3, 4
- `spaceMeta.name` — used consistently in Tasks 5, 6, 7
- `renameSpace()` — defined in Task 6, referenced in Task 5's HTML string ✅
- `spaceOpt.textContent` — used in both Task 6 and Task 7 ✅
