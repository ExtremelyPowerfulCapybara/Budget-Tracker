# Shared Budget — Design Spec
**Date:** 2026-03-20
**Status:** Approved

---

## Overview

Allow couples or small groups (up to ~6 people) to share a single budget in BudgetLog. Each user keeps their personal budget unchanged. Joining a shared space adds a second context — users switch between "Yo" (personal) and "Hogar" (shared) via a header pill. All shared entries are attributed to the person who added them.

---

## Decisions Made

| Question | Decision |
|---|---|
| Group size | Up to ~6 people (designed for couples, scales to small groups) |
| Entry attribution | Each entry shows who added it (avatar/initials badge); filterable by member |
| Existing data on join | Personal data stays private; shared space starts empty |
| Personal vs shared | Both coexist; user switches context via header toggle |
| Who can invite | Only the space creator |
| Invite mechanism | Enter invitee's Google email; banner appears on their next login |

---

## Data Model

### `spaces/{spaceId}` — new collection

Budget state fields (entries, goals, recurring, savingsGoals, customCategories) follow the same shape as `users/{uid}`. Space metadata is stored alongside but handled separately — never passed through `normalizeState` (see Storage note below).

```js
{
  // space metadata — never passed through normalizeState
  name: string,              // e.g. "Hogar" (set by creator)
  createdBy: string,         // uid
  members: [string],         // array of UIDs with full read/write access
  updatedAt: timestamp,

  // standard budget state (same shape as user doc)
  entries: [...],
  goals: { [categoryId]: number },
  recurring: [...],
  savingsGoals: [...],
  customCategories: { [id]: { label, color, isCustom? } }
}
```

### `users/{uid}` — one new field

```js
{ spaceId: string | null }   // null = no shared space
```

**Important:** `spaceId` is written with `userDocRef.update({ spaceId })`, never via `serializeCloudState`. The existing `serializeCloudState` whitelist (entries, goals, recurring, savingsGoals, customCategories) must not be changed — a normal `persistUserState` call must never overwrite `spaceId`.

### `invites/{inviteId}` — new collection

Document ID is deterministic: `${spaceId}_${inviteeEmail}` — makes duplicate creation idempotent.

```js
{
  spaceId: string,
  inviterUid: string,
  inviterName: string,
  inviteeEmail: string,       // Google email of the invitee
  status: 'pending' | 'accepted' | 'declined',
  createdAt: timestamp
}
```

### Entry attribution (shared context only)

Entries in a shared space get one additional field:

```js
{ createdBy: { uid: string, displayName: string, photoURL: string } }
```

Personal entries are unchanged. `normalizeState` already spreads `{...e}` on entries, so `createdBy` survives round-trips with no changes to `storage.js`. Missing `createdBy` (personal entries, old shared entries) renders without a badge.

### Document size limit

Firestore caps documents at 1 MB. A shared space accumulates entries at up to 6× the rate of a personal doc. The implementation must enforce a **soft limit of 500 entries** in the shared space: warn the user when approaching 450, block new entries at 500 with a prompt to export and clear old data.

---

## Storage / `normalizeState` Interaction

`normalizeState` in `storage.js` outputs only the five state fields (entries, goals, recurring, savingsGoals, customCategories). It strips any other fields including `name`, `createdBy`, and `members`.

- When **loading** a shared space doc, call `normalizeState` only on the state portion: `normalizeState({ entries: doc.entries, goals: doc.goals, ... })`. Read `name`, `createdBy`, `members` directly from `doc.data()` before normalizing.
- When **saving** to a shared space, use `serializeCloudState(state)` for the budget fields plus spread the metadata explicitly: `{ ...serializeCloudState(state), name, createdBy, members, updatedAt }`.
- `spaceId` on user docs is always written via `update()`, never via `set()` from `serializeCloudState`.

---

## Context Switching

`activeContext` in `index.html`: `'personal'` or a `spaceId` string.

`userDocRef` is a mutable variable (currently closed over in `index.html`). Both load and save paths reference it — switching context means updating `userDocRef` to point to either `db.collection('users').doc(uid)` or `db.collection('spaces').doc(spaceId)`. The `persistUserState` call in the save path picks up the new ref automatically.

**On login:**
1. Load `users/{uid}`
2. If `spaceId` exists, show context switcher pill in header (next to avatar)
3. Default context is `'personal'`

**Switcher UI:** Two pills in the header — `[ Yo ]  [ Hogar ]`. Hidden entirely for users with no shared space.

**Switching context:**
1. Update `activeContext` and `userDocRef`
2. Call `loadUserState()` with the new ref
3. Re-render everything (same flow as existing `applyState()` + render calls)

**Space name** shown in switcher comes from `spaces/{spaceId}.name`. Default: `"Hogar"`.

---

## Entry Attribution

**Saving (shared context only):** attach `createdBy: { uid, displayName, photoURL }` to the entry object.

**Rendering:** `entries.js` renders a small avatar/initials badge on entry cards when `entry.createdBy` is present. No badge in personal context or for entries without the field.

**Filtering:** A member filter appears in the entries tab only in shared context — same chip style as type/category filters. `"Todos"` shows all; selecting a member filters by `entry.createdBy.uid`.

**Dashboard and charts:** always show all shared entries — the household view, not per-member.

---

## Invite Flow

### Sending

In the user modal, a "Compartir" section appears for any user who is not already in a shared space (or is the space creator adding more members):

1. Enter invitee's Google email
2. Use deterministic document ID `${spaceId}_${inviteeEmail}` — `set()` with merge is safe to call again if invite already exists
3. If no space exists yet: create `spaces/{spaceId}` with `members: [uid]`, write `users/{uid}.spaceId` via `update()`
4. Create `invites/${spaceId}_${inviteeEmail}` doc with `status: 'pending'`

### Receiving

On every login, after loading `users/{uid}`, call the `getPendingInvite` Cloud Function (see below) — **not** a client-side Firestore query. The function applies the `inviteeEmail` filter server-side and returns only the caller's own invite, so no `allow list` rule is needed on the `invites` collection.

If the function returns an invite, show an invite banner above the tab bar:
> *"[InviterName] te invitó al presupuesto compartido. ¿Aceptar?"* — **[Aceptar]** **[Rechazar]**

**A user can have at most one pending invite at a time.** If they already have a `pending` invite (either for the same or a different space), a new invite create is rejected client-side (check before creating) and the Firestore create rule validates that no pending invite exists for that inviteeEmail (see rules below). This prevents a user seeing two simultaneous invite banners.

**Accepting:**
1. Update invite `status → 'accepted'`
2. Write `users/{uid}.spaceId = spaceId` via `update()`
3. Add `uid` to `spaces/{spaceId}.members` via `FieldValue.arrayUnion(uid)` — permitted by the Firestore `allow update` self-join rule (see rules below)
4. Switch `activeContext` to shared space

**Declining:** Update invite `status → 'declined'`. Banner disappears.

**Edge cases:**
- Inviting someone not yet registered: invite sits as `pending` until they sign up with that Google email
- Duplicate invites: deterministic document ID makes creation idempotent

---

## Member Management

Accessed via the user modal, visible when in a shared space.

### Creator view
- List of members (avatar + name)
- Remove (✕) button per member
- Invite input (if `members.length < 6`)
- "Eliminar presupuesto compartido" (destructive, confirmation required)

### Non-creator view
- Member list, read-only
- "Salir del presupuesto compartido" button

### Creator cannot leave
The "Salir" button is hidden for the creator. If the creator wants to leave, they must delete the space. Ownership transfer is out of scope for v1 — show a tooltip: *"Eres el creador. Para salir, elimina el presupuesto compartido."*

### Removing a member
1. Call `removeMember` Cloud Function (see below)
2. Function atomically removes UID from `members` and clears `users/{removedUid}.spaceId`
3. **Stale access window:** If the removed member has the app open, they retain live access until next reload (no real-time listener). This is acceptable in v1 — Firestore rules enforce access, so their next write after removal will fail gracefully.

### Leaving (non-creator)
1. Remove own UID from `spaces/{spaceId}.members` via `FieldValue.arrayRemove(uid)`
2. Write `users/{uid}.spaceId = null` via `update()`
3. Switch `activeContext` to `'personal'`

### Deleting the space (creator only)
1. Confirmation dialog required
2. Call `deleteSpace` Cloud Function (see below)
3. Switch all affected clients to personal context on next app open

---

## Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /spaces/{spaceId} {
      // Existing members can read and write budget state
      allow read, write: if request.auth != null
        && request.auth.uid in resource.data.members;

      // Creator can create the space
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.createdBy;

      // Invitee can add only themselves to members (invite acceptance)
      // Proof: new array = old array + exactly one new element = caller's uid
      allow update: if request.auth != null
        && !(request.auth.uid in resource.data.members)
        && request.resource.data.members.hasAll(resource.data.members)
        && request.resource.data.members.size() == resource.data.members.size() + 1
        && request.auth.uid in request.resource.data.members;
    }

    match /invites/{inviteId} {
      // Only authenticated space members can create an invite for their own space,
      // and only for themselves as inviterUid
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.inviterUid
        && request.auth.uid in get(/databases/$(database)/documents/spaces/$(request.resource.data.spaceId)).data.members;

      // Inviter can read/update their own invites
      allow read, update: if request.auth != null
        && request.auth.uid == resource.data.inviterUid;

      // Invitee can read/update invites addressed to their verified email
      allow read, update: if request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email == resource.data.inviteeEmail;

      // No allow list — pending invite lookup is done via getPendingInvite Cloud Function
    }

  }
}
```

**Notes:**
- `request.auth.token.email_verified` is always `true` for Google Sign-In (the only auth provider). The check future-proofs against adding password/phone auth.
- No `allow list` on `invites` — the login-time invite lookup uses the `getPendingInvite` Cloud Function (server-side query), which eliminates both the enumeration risk and the need for a permissive list rule.
- The `allow create` on `invites` cross-reads the space doc to verify the caller is a member, preventing forged invites from non-members.
- The self-join `allow update` on `spaces` uses `in` membership check (not array position) for robustness — the `hasAll` + size + `in` combination proves exactly one element was added and it is the caller's UID.

---

## Cloud Functions

### `getPendingInvite` (HTTPS callable)

Needed to safely query the `invites` collection without a permissive `allow list` rule.

**Auth:** Any authenticated user.
**Input:** none (caller identity from Firebase Auth context)
**Actions:**
1. Query `invites` where `inviteeEmail == caller.email` and `status == 'pending'` limit 1
2. Return the invite doc (id + data) or `null`

### `removeMember` (HTTPS callable)

Needed because a client cannot write another user's `users/{uid}` doc.

**Auth:** Caller must be the space creator.
**Input:** `{ spaceId, memberUid }`
**Actions (Firestore transaction):**
1. Read `spaces/{spaceId}` — verify caller is `createdBy`
2. Reject if `memberUid == spaceDoc.createdBy` (creator cannot remove themselves)
3. Remove `memberUid` from members array
4. Write `users/{memberUid}.spaceId = null`
5. Commit transaction atomically

### `deleteSpace` (HTTPS callable)

**Auth:** Caller must be the space creator.
**Input:** `{ spaceId }`
**Actions (Firestore transaction):**
1. Read `spaces/{spaceId}` inside a transaction to get the current members list
2. For each member UID: write `users/{uid}.spaceId = null`
3. Delete `spaces/{spaceId}`
4. Query `invites` where `spaceId == spaceId` and delete all results (batched write)
5. Commit — members list is locked for the duration, no race condition; orphaned invites are cleaned up

---

## Known Limitations (v1)

- **No real-time sync:** Members see each other's changes only after reload or context switch. No Firestore `onSnapshot` listener.
- **Stale access on removal:** A removed member retains read/write access until their next reload. Their next write will fail with a Firestore permission error if they have been removed.
- **`budgetAlerts` and `weeklyDigest` Cloud Functions** scan only `users` collection. Shared space spending does not trigger push alerts. Members using shared context will not receive budget threshold notifications based on shared entries.
- **Ownership transfer:** Not supported. Creator must delete the space to leave.
- **Per-member roles:** All members have equal read/write access.
- **Shared savings goals with per-member contribution tracking:** Not supported.
- **Notifications when another member adds an entry:** Not supported.

---

## Files Changed

| File | Change |
|---|---|
| `firestore.rules` | Add `spaces` and `invites` rules (replace existing) |
| `firestore.indexes.json` | **Create** — composite index on `invites` (inviteeEmail ASC + status ASC) |
| `js/core/cloud.js` | Accept swappable `docRef`; add invite query on login; handle space metadata load/save |
| `js/features/app-shell.js` | Context switcher pill; invite banner |
| `js/features/entries.js` | `createdBy` badge on cards; member filter chip |
| `index.html` | `activeContext` var; `userDocRef` made mutable; context switch logic; user modal membership UI; invite/share UI |
| `functions/index.js` | `getPendingInvite`, `removeMember`, and `deleteSpace` callable functions |

`js/core/storage.js` — **no changes needed.** `normalizeState` and `serializeCloudState` are reused as-is; space metadata is handled separately (see Storage section above).
