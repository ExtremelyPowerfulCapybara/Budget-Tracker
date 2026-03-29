# Cuenta Field for Recurring Entries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional account (`Cuenta`) field to recurring rules so generated entries inherit the account, the rule card shows the account, and the recurring list can be filtered by account.

**Architecture:** Three surgical changes: (1) `selectors.js` propagates `accountId` through `sanitizeRecurringRule` (already implicit via spread) and copies it in `createRecurringEntry`; (2) `recurring.js` renders the account dot in the card; (3) `index.html` adds the form select, filter bar, and wires everything together.

**Tech Stack:** Plain vanilla JS, no bundler. Tests run with `node tests/selectors.test.js`. Manual browser verify for UI changes.

---

## File Map

| File | What changes |
|------|-------------|
| `js/core/selectors.js` | `createRecurringEntry`: add `accountId: rule.accountId \|\| null` |
| `tests/selectors.test.js` | Add inline `createRecurringEntry` + tests for accountId pass-through and copy |
| `js/features/recurring.js` | `renderRecurringListMarkup`: accept `accounts` option, render account dot in meta line |
| `index.html` | Add `#recurAccountId` select + `#recurAccountFilterBar` div to HTML; add `let recurAccountFilter = null`; update `addRecurring`, `openEditRecurring`, `renderRecurring`; add `renderRecurringFilter` and `setRecurAccountFilter` functions |

---

## Task 1: Propagate `accountId` in `createRecurringEntry` + tests

**Files:**
- Modify: `tests/selectors.test.js`
- Modify: `js/core/selectors.js`

### Step 1: Write failing tests

Append to the bottom of `tests/selectors.test.js`:

```js
// createRecurringEntry — inline copy for testing
function createRecurringEntry(rule, date) {
  return {
    id: 'recur_' + rule.id + '_' + date,
    type: rule.type,
    amount: rule.amount,
    description: rule.description,
    category: rule.category,
    date,
    recurringId: rule.id,
    recurringDate: date,
    goalId: rule.goalId || null
    // accountId intentionally omitted — test will fail until we add it
  };
}

const baseRule = { id: 'r1', type: 'expense', amount: 100, description: 'Netflix', category: 'entertainment', frequency: 'monthly', day: 1, anchorDate: '2026-03-01', createdAt: '2026-03-01', lastApplied: null, goalId: null };

// sanitizeRecurringRule: accountId pass-through
assert.strictEqual(sanitizeRecurringRule({ ...baseRule, accountId: 'acc1' }).accountId, 'acc1', 'accountId preserved through sanitize');
assert.strictEqual(sanitizeRecurringRule({ ...baseRule, accountId: null }).accountId, null, 'null accountId preserved');
assert.strictEqual(sanitizeRecurringRule({ ...baseRule }).accountId, undefined, 'missing accountId stays missing');

// createRecurringEntry: accountId copied
const entryWithAccount = createRecurringEntry({ ...baseRule, accountId: 'acc1' }, '2026-03-01');
assert.strictEqual(entryWithAccount.accountId, 'acc1', 'accountId copied to generated entry');

const entryNoAccount = createRecurringEntry({ ...baseRule, accountId: null }, '2026-03-01');
assert.strictEqual(entryNoAccount.accountId, null, 'null accountId → null on entry');

const entryMissingAccount = createRecurringEntry({ ...baseRule }, '2026-03-01');
assert.strictEqual(entryMissingAccount.accountId, null, 'missing accountId → null on entry');

console.log('All createRecurringEntry accountId tests passed ✓');
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node tests/selectors.test.js
```

Expected: crashes with `AssertionError` on the `accountId copied to generated entry` assertion (since `accountId` is not yet on the returned object).

- [ ] **Step 3: Fix `createRecurringEntry` in `js/core/selectors.js`**

Find `createRecurringEntry` (around line 75). Change:

```js
  function createRecurringEntry(rule,date){
    return {
      id:'recur_'+rule.id+'_'+date,
      type:rule.type,
      amount:rule.amount,
      description:rule.description,
      category:rule.category,
      date,
      recurringId:rule.id,
      recurringDate:date,
      goalId:rule.goalId||null
    };
  }
```

To:

```js
  function createRecurringEntry(rule,date){
    return {
      id:'recur_'+rule.id+'_'+date,
      type:rule.type,
      amount:rule.amount,
      description:rule.description,
      category:rule.category,
      date,
      recurringId:rule.id,
      recurringDate:date,
      goalId:rule.goalId||null,
      accountId:rule.accountId||null
    };
  }
```

- [ ] **Step 4: Update the inline copy in `tests/selectors.test.js`**

In the `createRecurringEntry` function you added in Step 1, add `accountId: rule.accountId || null` to the returned object:

```js
function createRecurringEntry(rule, date) {
  return {
    id: 'recur_' + rule.id + '_' + date,
    type: rule.type,
    amount: rule.amount,
    description: rule.description,
    category: rule.category,
    date,
    recurringId: rule.id,
    recurringDate: date,
    goalId: rule.goalId || null,
    accountId: rule.accountId || null
  };
}
```

- [ ] **Step 5: Run tests to verify all pass**

```bash
node tests/selectors.test.js
```

Expected output:
```
All sanitizeRecurringRule tests passed ✓
All createRecurringEntry accountId tests passed ✓
```

- [ ] **Step 6: Commit**

```bash
git add js/core/selectors.js tests/selectors.test.js
git commit -m "feat(recurring): propagate accountId from rule to generated entry"
```

---

## Task 2: Show account dot in recurring card

**Files:**
- Modify: `js/features/recurring.js`

- [ ] **Step 1: Update `renderRecurringListMarkup`**

In `js/features/recurring.js`, replace the entire `renderRecurringListMarkup` function:

```js
  function renderRecurringListMarkup(options){
    const {
      recurring,
      sanitizeRecurringRule,
      categories,
      savingsGoals,
      formatMoney,
      currentMonthKey,
      accounts
    }=options;

    if(!recurring.length)return '';

    return recurring.map(rule=>{
      const normalized=sanitizeRecurringRule(rule);
      const category=categories.find(item=>item.id===normalized.category);
      const goal=savingsGoals.find(item=>item.id===normalized.goalId);
      const account=Array.isArray(accounts)&&normalized.accountId?accounts.find(a=>a.id===normalized.accountId):null;
      const color=normalized.type==='income'?'var(--income)':(category?category.color:'var(--muted)');
      const startText='Inicia: '+normalized.anchorDate;
      const goalText=goal?' \u00b7 Meta: '+goal.name:'';
      const accountText=account?' \u00b7 <span class="entry-account-dot" style="background:'+esc(account.color)+'"></span>'+esc(account.label):'';
      const appliedBadge=(currentMonthKey&&normalized.lastApplied===currentMonthKey)?'<span class="recur-applied-badge">Este mes \u2713</span>':'';
      return '<div class="recur-card" data-rule-id="'+esc(normalized.id)+'"><div class="entry-dot" style="background:'+esc(color)+'"></div><div class="recur-info"><div class="recur-name">'+esc(normalized.description)+appliedBadge+'</div><div class="recur-meta">'+FREQUENCY_LABELS[normalized.frequency]+' \u00b7 '+startText+esc(goalText)+accountText+'</div></div><div class="recur-amount '+normalized.type+'">'+(normalized.type==='income'?'+':'-')+formatMoney(normalized.amount)+'</div><button class="entry-btn" data-recurring-edit="'+esc(normalized.id)+'" aria-label="Editar recurrente">&#9998;</button><button class="entry-btn delete" data-recurring-delete="'+esc(normalized.id)+'" aria-label="Eliminar recurrente">&#10005;</button></div>';
    }).join('');
  }
```

- [ ] **Step 2: Commit**

```bash
git add js/features/recurring.js
git commit -m "feat(recurring): show account dot in recurring rule card"
```

---

## Task 3: Form field, filter bar, and wiring in `index.html`

**Files:**
- Modify: `index.html`

This task has many small changes to one file. Work through them in order.

### 3a — Add HTML elements

- [ ] **Step 1: Add `#recurAccountId` select to the recurring form**

Find this block (around line 630):

```html
      <div class="form-group" id="recurGoalGroup" style="display:none;"><label class="form-label">Meta de ahorro</label><select class="form-input" id="recurGoalId"></select></div>
      <div class="form-group"><label class="form-label">Frecuencia</label><div class="freq-grid" id="freqGrid"></div></div>
      <div class="form-group"><label class="form-label" id="recurDateLabel">Fecha de inicio</label><input class="form-input" type="date" id="recurStartDate"></div>
```

Add the account select between the goal group and the frequency group:

```html
      <div class="form-group" id="recurGoalGroup" style="display:none;"><label class="form-label">Meta de ahorro</label><select class="form-input" id="recurGoalId"></select></div>
      <div class="form-group"><label class="form-label" for="recurAccountId">Cuenta (opcional)</label><select class="form-input" id="recurAccountId"><option value="">&#8212; Sin cuenta &#8212;</option></select></div>
      <div class="form-group"><label class="form-label">Frecuencia</label><div class="freq-grid" id="freqGrid"></div></div>
      <div class="form-group"><label class="form-label" id="recurDateLabel">Fecha de inicio</label><input class="form-input" type="date" id="recurStartDate"></div>
```

- [ ] **Step 2: Add `#recurAccountFilterBar` div**

Find this block (around line 635):

```html
    <div id="recurApplyBanner" style="display:none"></div>
    <div class="section-title">Movimientos recurrentes</div>
    <div id="recurList"></div>
```

Add the filter bar container between the section title and the list:

```html
    <div id="recurApplyBanner" style="display:none"></div>
    <div class="section-title">Movimientos recurrentes</div>
    <div id="recurAccountFilterBar"></div>
    <div id="recurList"></div>
```

### 3b — State variable

- [ ] **Step 3: Add `recurAccountFilter` state variable**

Find this line (around line 858):

```js
let recurFreq='monthly',editCat='food',editId=null,activeFilter='all',editingRecurringId=null;
```

Change it to:

```js
let recurFreq='monthly',editCat='food',editId=null,activeFilter='all',editingRecurringId=null,recurAccountFilter=null;
```

### 3c — Update `addRecurring`

- [ ] **Step 4: Read `recurAccountId` and include in rule; clear on reset**

Find `function addRecurring()` (around line 1476). It is a single minified line. Make these two additions:

**After** `const goalId=document.getElementById('recurGoalId').value||null;`, add:
```js
const accountId=document.getElementById('recurAccountId').value||null;
```

**In** the `sanitizeRecurringRule({...})` call, after `goalId:recurType==='expense'&&recurCat==='savings'?goalId:null,`, add:
```js
accountId,
```

**In** the reset block after `document.getElementById('recurGoalId').value='';`, add:
```js
document.getElementById('recurAccountId').value='';
```

The resulting `addRecurring` function (for reference — verify your edit produces this logic):
```js
function addRecurring(){
  const amount=parseFloat(document.getElementById('recurAmount').value);
  const desc=document.getElementById('recurDesc').value.trim();
  const startDate=document.getElementById('recurStartDate').value||toISODate(new Date());
  const goalId=document.getElementById('recurGoalId').value||null;
  const accountId=document.getElementById('recurAccountId').value||null;
  const anchor=parseISODate(startDate);
  if(!amount||amount<=0){showToast('Ingresa un monto válido');return;}
  if(!desc){showToast('Agrega una descripción');return;}
  if(!anchor){showToast('Elige una fecha de inicio válida');return;}
  const isEditing=!!editingRecurringId;
  const existingRule=isEditing?recurring.find(r=>r.id===editingRecurringId):null;
  const rule=sanitizeRecurringRule({
    id:isEditing?editingRecurringId:Date.now().toString(),
    type:recurType,amount,description:desc,
    category:recurType==='expense'?recurCat:'income',
    frequency:recurFreq,anchorDate:startDate,day:anchor.getDate(),
    goalId:recurType==='expense'&&recurCat==='savings'?goalId:null,
    accountId,
    lastApplied:existingRule?existingRule.lastApplied:null,
    createdAt:existingRule?existingRule.createdAt:toISODate(new Date())
  });
  if(isEditing){recurring=recurring.map(r=>r.id===editingRecurringId?rule:r);editingRecurringId=null;}
  else{recurring.push(rule);}
  save();
  document.getElementById('recurAmount').value='';
  document.getElementById('recurDesc').value='';
  document.getElementById('recurStartDate').value=toISODate(new Date());
  document.getElementById('recurGoalId').value='';
  document.getElementById('recurAccountId').value='';
  renderRecurring();
  showToast(isEditing?'Recurrente actualizada':'Recurrente guardada');
}
```

### 3d — Update `openEditRecurring`

- [ ] **Step 5: Populate account select when editing**

Find `function openEditRecurring(id)` (around line 1478). It is a single minified line.

After `document.getElementById('recurGoalId').value=normalized.goalId||'';`, add:
```js
renderAccountSelect(document.getElementById('recurAccountId'));document.getElementById('recurAccountId').value=normalized.accountId||'';
```

The resulting function (for reference):
```js
function openEditRecurring(id){
  const rule=recurring.find(r=>r.id===id);if(!rule)return;
  const normalized=sanitizeRecurringRule(rule);
  editingRecurringId=id;
  setRecurType(normalized.type);
  document.getElementById('recurAmount').value=normalized.amount;
  document.getElementById('recurDesc').value=normalized.description;
  document.getElementById('recurStartDate').value=normalized.anchorDate||toISODate(new Date());
  if(normalized.type==='expense')setRecurCat(normalized.category);
  setFreq(normalized.frequency);
  document.getElementById('recurGoalId').value=normalized.goalId||'';
  renderAccountSelect(document.getElementById('recurAccountId'));
  document.getElementById('recurAccountId').value=normalized.accountId||'';
  document.querySelector('#view-recurring .form-card-title').textContent='Editar recurrente';
  document.querySelector('#view-recurring .submit-btn').textContent='Guardar cambios';
  document.querySelector('#view-recurring .form-card').scrollIntoView({behavior:'smooth',block:'start'});
}
```

### 3e — Add filter functions

- [ ] **Step 6: Add `renderRecurringFilter` and `setRecurAccountFilter`**

Find `function deleteRecurring(id)` (around line 1477). Add the two new functions immediately before it:

```js
function renderRecurringFilter(){const bar=document.getElementById('recurAccountFilterBar');if(!bar)return;const usedIds=[...new Set(recurring.map(r=>r.accountId).filter(Boolean))];if(recurAccountFilter&&!usedIds.includes(recurAccountFilter))recurAccountFilter=null;if(!usedIds.length){bar.innerHTML='';return;}const esc=window.BudgetLogCore.utils.esc;const chips=['<button class="filter-chip'+(recurAccountFilter===null?' active':'')+'" onclick="setRecurAccountFilter(null)">Todas</button>'].concat(usedIds.map(id=>{const acc=accounts.find(a=>a.id===id);if(!acc)return '';return '<button class="filter-chip'+(recurAccountFilter===id?' active':'')+'" onclick="setRecurAccountFilter(\''+esc(id)+'\')"><span class="entry-account-dot" style="background:'+esc(acc.color)+'"></span>'+esc(acc.label)+'</button>';}));bar.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">'+chips.join('')+'</div>';}
function setRecurAccountFilter(id){recurAccountFilter=id;renderRecurring();}
```

### 3f — Update `renderRecurring`

- [ ] **Step 7: Wire up account select, filter, and pass `accounts` to markup**

Find `function renderRecurring()` (around line 1479). It is a single minified line.

Make these three changes inside it:

**Add** after `toggleSavingsGoalField(...)`:
```js
renderAccountSelect(document.getElementById('recurAccountId'));
```

**Replace** the `const markup=renderRecurringListMarkup({...})` call (which currently doesn't pass `accounts`) with:
```js
renderRecurringFilter();
const visibleRecurring=recurAccountFilter?recurring.filter(r=>r.accountId===recurAccountFilter):recurring;
const markup=renderRecurringListMarkup({recurring:visibleRecurring,sanitizeRecurringRule,categories:CATEGORIES,savingsGoals,formatMoney:MXN,currentMonthKey:monthKey(viewYear,viewMonth),accounts});
```

The resulting function (for reference):
```js
function renderRecurring(){
  document.querySelector('#view-recurring .form-card-title').textContent=editingRecurringId?'Editar recurrente':'Nueva recurrente';
  document.querySelector('#view-recurring .submit-btn').textContent=editingRecurringId?'Guardar cambios':'Guardar recurrente';
  renderRecurCatGrid();renderFreqGrid();
  document.getElementById('recurCatGroup').style.display=recurType==='expense'?'block':'none';
  if(!document.getElementById('recurStartDate').value){document.getElementById('recurStartDate').value=toISODate(new Date());}
  toggleSavingsGoalField(recurType,recurCat,'recurGoalGroup','recurGoalId',document.getElementById('recurGoalId').value);
  renderAccountSelect(document.getElementById('recurAccountId'));
  const pending=getPendingRecurring();
  const banner=document.getElementById('recurApplyBanner');
  if(pending.length>0){banner.style.display='block';renderCtaRow(banner,{text:pending.length+' movimiento(s) recurrente(s) pendiente(s)',buttonLabel:'Aplicar',buttonAction:()=>applyRecurring()});}
  else{banner.style.display='none';banner.innerHTML='';}
  renderRecurringFilter();
  const visibleRecurring=recurAccountFilter?recurring.filter(r=>r.accountId===recurAccountFilter):recurring;
  const container=document.getElementById('recurList');
  const markup=renderRecurringListMarkup({recurring:visibleRecurring,sanitizeRecurringRule,categories:CATEGORIES,savingsGoals,formatMoney:MXN,currentMonthKey:monthKey(viewYear,viewMonth),accounts});
  if(markup){container.innerHTML=markup;return;}
  renderEmptyState(container,{icon:'🔁',title:'No tienes movimientos recurrentes',message:'Automatiza tus gastos fijos o suscripciones.',ctaLabel:'Crear recurrente',ctaAction:()=>document.querySelector('#view-recurring .form-card')?.scrollIntoView({behavior:'smooth',block:'start'}),hint:'Los movimientos recurrentes te ayudan a mantener tu presupuesto al día.',variant:'default'});
}
```

### 3g — Verify and commit

- [ ] **Step 8: Verify in browser**

Open the app in a browser. Go to the Recurrentes tab. Verify:
1. A "Cuenta (opcional)" dropdown appears in the add form.
2. Create a recurring rule and assign it to an account — the account dot + label appears in the rule card.
3. The filter bar appears above the list with "Todas" + account chip(s).
4. Clicking an account chip filters the list to show only rules with that account.
5. Apply recurring entries — the generated entries in Movimientos have the correct account.
6. Edit a recurring rule — the account select is pre-populated correctly.
7. If no rules have an account assigned, the filter bar is hidden.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat(recurring): add Cuenta field, card display, and account filter"
```

---

## Done

All three tasks complete. The feature is fully implemented:
- `accountId` is stored on recurring rules and propagated to generated entries
- The account dot + label is shown in each rule card
- The recurring list can be filtered by account
