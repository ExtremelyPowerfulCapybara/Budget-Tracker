# Payment Method Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `accountId` field to entries that tags each transaction with a payment method (BBVA Débito, Efectivo, Tarjeta de crédito), surfaced as a colored badge on cards, a Cuenta column in exports, a "Por cuenta" bar chart, and a management modal on the goals tab.

**Architecture:** New top-level `accounts[]` state key stored in localStorage (`bl_accounts`) and Firestore, injected as a parameter through storage/cloud/wiring layers. `accountId: string|null` on entries is purely a display label — no balance tracking. Account management mirrors category customization exactly (same CSS classes, same draft+save pattern, same `colorPickerPop`).

**Tech Stack:** Plain HTML/CSS/JS, Firebase Firestore, Chart.js 4.4.1 via CDN, SheetJS 0.18.5 via CDN. No bundler.

---

## File Map

| File | Change |
|------|--------|
| `js/core/config.js` | Add `DEFAULT_ACCOUNTS` |
| `js/core/storage.js` | Add `bl_accounts` key, `accounts` to all state functions, `sanitizeAccount` helper |
| `js/core/cloud.js` | Pass `defaultAccounts` through `loadUserState` → `readLocalState` |
| `index.html` | State init, `applyState`, `getStateSnapshot`, `loadUserState` call, `renderAccountSelect`, log form select, edit modal select, `logEntry`/`saveEdit`/`openEdit`, account management modal, goals tab button, charts tab/panel, `renderActiveChart` |
| `js/features/entries.js` | Account badge in `renderEntryMarkup`, `entry-account-dot` CSS |
| `js/features/export.js` | `Cuenta` column in Movimientos sheet |
| `js/features/charts.js` | New `renderAccountBarChart` function |

---

## Task 1: State Foundation (config.js + storage.js + cloud.js)

> All three files in one atomic commit — state-changes skill requires this.

**Files:**
- Modify: `js/core/config.js`
- Modify: `js/core/storage.js`
- Modify: `js/core/cloud.js`

---

- [ ] **Step 1.1 — Add DEFAULT_ACCOUNTS to config.js**

In `js/core/config.js`, add `DEFAULT_ACCOUNTS` after `SG_COLORS`:

```js
    SG_COLORS:['#3dd68c','#5b8af0','#f0d45b','#ff9f1c','#f05b5b','#ff5d8f','#9b5de5','#2ec4b6'],
    DEFAULT_ACCOUNTS:[
      {id:'acc_bbva', label:'BBVA Débito',       type:'debit',  color:'#5b8af0'},
      {id:'acc_cash', label:'Efectivo',           type:'cash',   color:'#3dd68c'},
      {id:'acc_cc',   label:'Tarjeta de crédito', type:'credit', color:'#f05b5b'}
    ]
```

---

- [ ] **Step 1.2 — Add `accounts` key to STORAGE_KEYS in storage.js**

Replace:
```js
  const STORAGE_KEYS={
    entries:'bl_entries',
    goals:'bl_goals',
    recurring:'bl_recurring',
    savingsGoals:'bl_savings',
    customCategories:'bl_catcustom'
  };
```
With:
```js
  const STORAGE_KEYS={
    entries:'bl_entries',
    goals:'bl_goals',
    recurring:'bl_recurring',
    savingsGoals:'bl_savings',
    customCategories:'bl_catcustom',
    accounts:'bl_accounts'
  };
```

---

- [ ] **Step 1.3 — Add `sanitizeAccount` helper in storage.js**

Add this function immediately before `createEmptyState`:

```js
  function sanitizeAccount(a){
    if(!a||typeof a!=='object')return null;
    return {
      id:typeof a.id==='string'?a.id:String(a.id||''),
      label:typeof a.label==='string'?a.label.slice(0,80):'',
      type:['debit','credit','cash'].includes(a.type)?a.type:'debit',
      color:typeof a.color==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(a.color)?a.color:'#5b8af0'
    };
  }
```

---

- [ ] **Step 1.4 — Update `createEmptyState` to accept and return `accounts`**

Replace:
```js
  function createEmptyState(defaultGoals){
    return {
      entries:[],
      goals:{...defaultGoals},
      recurring:[],
      savingsGoals:[],
      customCategories:{}
    };
  }
```
With:
```js
  function createEmptyState(defaultGoals,defaultAccounts){
    return {
      entries:[],
      goals:{...defaultGoals},
      recurring:[],
      savingsGoals:[],
      customCategories:{},
      accounts:Array.isArray(defaultAccounts)?defaultAccounts.map(a=>({...a})):[]
    };
  }
```

---

- [ ] **Step 1.5 — Update `normalizeState` signature and body**

Replace:
```js
  function normalizeState(rawState,{defaultGoals,sanitizeRecurringRule}){
    const fallback=createEmptyState(defaultGoals);
```
With:
```js
  function normalizeState(rawState,{defaultGoals,defaultAccounts,sanitizeRecurringRule}){
    const fallback=createEmptyState(defaultGoals,defaultAccounts);
```

Then add `accounts` to the returned object inside `normalizeState`, after `customCategories`:

```js
      accounts:(()=>{
        const src=source.accounts;
        if(Array.isArray(src)&&src.length>0){
          const sanitized=src.map(sanitizeAccount).filter(Boolean);
          if(sanitized.length>0)return sanitized;
        }
        return Array.isArray(defaultAccounts)?defaultAccounts.map(a=>({...a})):[];
      })()
```

The full updated return block becomes:
```js
    return {
      entries:Array.isArray(source.entries)
        ?source.entries.map(e=>{const amt=parseFloat(e.amount);return{...e,amount:isFinite(amt)&&amt>=0?amt:0};})
        :[],
      goals:mergedGoals,
      recurring:Array.isArray(source.recurring)?source.recurring.map(sanitizeRecurringRule):[],
      savingsGoals:Array.isArray(source.savingsGoals)?source.savingsGoals.map(sg=>{
        const target=parseFloat(sg.target);
        return {
          id:typeof sg.id==='string'?sg.id:String(sg.id||''),
          name:typeof sg.name==='string'?sg.name.slice(0,200):'',
          target:isFinite(target)&&target>0?target:0,
          color:typeof sg.color==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(sg.color)?sg.color:'#3dd68c'
        };
      }):[],
      customCategories:(()=>{
        const src=source.customCategories&&typeof source.customCategories==='object'?source.customCategories:{};
        const out={};
        Object.entries(src).forEach(([id,v])=>{
          if(!v||typeof v!=='object')return;
          out[id]={
            label:typeof v.label==='string'?v.label.slice(0,100):'',
            color:typeof v.color==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(v.color)?v.color:'#5b8af0',
            ...(v.isCustom?{isCustom:true}:{})
          };
        });
        return out;
      })(),
      accounts:(()=>{
        const src=source.accounts;
        if(Array.isArray(src)&&src.length>0){
          const sanitized=src.map(sanitizeAccount).filter(Boolean);
          if(sanitized.length>0)return sanitized;
        }
        return Array.isArray(defaultAccounts)?defaultAccounts.map(a=>({...a})):[];
      })()
    };
```

---

- [ ] **Step 1.6 — Update `readLocalState` to read `accounts`**

Replace:
```js
  function readLocalState({storage=window.localStorage,defaultGoals,sanitizeRecurringRule}){
    return normalizeState({
      entries:JSON.parse(storage.getItem(STORAGE_KEYS.entries)||'[]'),
      goals:JSON.parse(storage.getItem(STORAGE_KEYS.goals)||'null'),
      recurring:JSON.parse(storage.getItem(STORAGE_KEYS.recurring)||'[]'),
      savingsGoals:JSON.parse(storage.getItem(STORAGE_KEYS.savingsGoals)||'[]'),
      customCategories:JSON.parse(storage.getItem(STORAGE_KEYS.customCategories)||'{}')
    },{defaultGoals,sanitizeRecurringRule});
  }
```
With:
```js
  function readLocalState({storage=window.localStorage,defaultGoals,defaultAccounts,sanitizeRecurringRule}){
    return normalizeState({
      entries:JSON.parse(storage.getItem(STORAGE_KEYS.entries)||'[]'),
      goals:JSON.parse(storage.getItem(STORAGE_KEYS.goals)||'null'),
      recurring:JSON.parse(storage.getItem(STORAGE_KEYS.recurring)||'[]'),
      savingsGoals:JSON.parse(storage.getItem(STORAGE_KEYS.savingsGoals)||'[]'),
      customCategories:JSON.parse(storage.getItem(STORAGE_KEYS.customCategories)||'{}'),
      accounts:JSON.parse(storage.getItem(STORAGE_KEYS.accounts)||'null')
    },{defaultGoals,defaultAccounts,sanitizeRecurringRule});
  }
```

---

- [ ] **Step 1.7 — Update `writeLocalState` to write `accounts`**

Replace:
```js
  function writeLocalState(state,{storage=window.localStorage}={}){
    storage.setItem(STORAGE_KEYS.entries,JSON.stringify(state.entries));
    storage.setItem(STORAGE_KEYS.goals,JSON.stringify(state.goals));
    storage.setItem(STORAGE_KEYS.recurring,JSON.stringify(state.recurring));
    storage.setItem(STORAGE_KEYS.savingsGoals,JSON.stringify(state.savingsGoals));
    storage.setItem(STORAGE_KEYS.customCategories,JSON.stringify(state.customCategories));
  }
```
With:
```js
  function writeLocalState(state,{storage=window.localStorage}={}){
    storage.setItem(STORAGE_KEYS.entries,JSON.stringify(state.entries));
    storage.setItem(STORAGE_KEYS.goals,JSON.stringify(state.goals));
    storage.setItem(STORAGE_KEYS.recurring,JSON.stringify(state.recurring));
    storage.setItem(STORAGE_KEYS.savingsGoals,JSON.stringify(state.savingsGoals));
    storage.setItem(STORAGE_KEYS.customCategories,JSON.stringify(state.customCategories));
    storage.setItem(STORAGE_KEYS.accounts,JSON.stringify(state.accounts));
  }
```

---

- [ ] **Step 1.8 — Update `serializeCloudState` to include `accounts`**

Replace:
```js
  function serializeCloudState(state){
    return {
      entries:state.entries,
      goals:state.goals,
      recurring:state.recurring,
      savingsGoals:state.savingsGoals,
      customCategories:state.customCategories
    };
  }
```
With:
```js
  function serializeCloudState(state){
    return {
      entries:state.entries,
      goals:state.goals,
      recurring:state.recurring,
      savingsGoals:state.savingsGoals,
      customCategories:state.customCategories,
      accounts:state.accounts
    };
  }
```

---

- [ ] **Step 1.9 — Update `cloud.js` to pass `defaultAccounts` through `loadUserState`**

In `js/core/cloud.js`, the `loadUserState` function destructures its options and calls `readLocalState`. Update it to accept and pass through `defaultAccounts`:

Replace the destructure at the top of `loadUserState`:
```js
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
With:
```js
    const {
      userDocRef,
      defaultGoals,
      defaultAccounts,
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

Then update both `readLocalState` calls in `loadUserState`. Replace:
```js
        const localState=readLocalState({defaultGoals,sanitizeRecurringRule});
```
With:
```js
        const localState=readLocalState({defaultGoals,defaultAccounts,sanitizeRecurringRule});
```

And replace (in the catch block):
```js
      applyState(readLocalState({defaultGoals,sanitizeRecurringRule}));
```
With:
```js
      applyState(readLocalState({defaultGoals,defaultAccounts,sanitizeRecurringRule}));
```

---

- [ ] **Step 1.10 — Commit the state foundation**

```bash
git add js/core/config.js js/core/storage.js js/core/cloud.js
git commit -m "feat(accounts): add accounts[] state shape to config, storage, and cloud"
```

---

## Task 2: index.html — State Wiring

**Files:**
- Modify: `index.html` (state init, applyState, getStateSnapshot, loadUserState call, renderAccountSelect)

---

- [ ] **Step 2.1 — Add `accounts` to the state variable declaration**

Find (line ~837):
```js
let {entries,goals,recurring,savingsGoals,customCategories}=createEmptyState(DEFAULT_GOALS);
```
Replace with:
```js
const {DEFAULT_ACCOUNTS}=BudgetLogCore.config;
let {entries,goals,recurring,savingsGoals,customCategories,accounts}=createEmptyState(DEFAULT_GOALS,DEFAULT_ACCOUNTS);
```

Note: `DEFAULT_ACCOUNTS` is added to the config destructure. Find the existing config destructure line (search for `const {CATEGORIES,DEFAULT_GOALS`) and add `DEFAULT_ACCOUNTS` to it instead of declaring a new const:

Find:
```js
const {CATEGORIES,DEFAULT_GOALS,
```
The exact line will vary — search for `DEFAULT_GOALS` in the const destructure block at the top of the inline JS. Add `,DEFAULT_ACCOUNTS` to that same destructure.

---

- [ ] **Step 2.2 — Update `applyState` to include `accounts`**

Find (line ~847):
```js
function applyState(nextState){
  ({entries,goals,recurring,savingsGoals,customCategories}=normalizeState(nextState,{defaultGoals:DEFAULT_GOALS,sanitizeRecurringRule}));
}
```
Replace with:
```js
function applyState(nextState){
  ({entries,goals,recurring,savingsGoals,customCategories,accounts}=normalizeState(nextState,{defaultGoals:DEFAULT_GOALS,defaultAccounts:DEFAULT_ACCOUNTS,sanitizeRecurringRule}));
}
```

---

- [ ] **Step 2.3 — Update `getStateSnapshot` to include `accounts`**

Find (line ~846):
```js
function getStateSnapshot(){return {entries,goals,recurring,savingsGoals,customCategories};}
```
Replace with:
```js
function getStateSnapshot(){return {entries,goals,recurring,savingsGoals,customCategories,accounts};}
```

---

- [ ] **Step 2.4 — Add `defaultAccounts` to the `loadUserState` call**

Search for the `loadUserState(` call in index.html (around line 1185). It looks like:
```js
    loadUserState({
      userDocRef,
      defaultGoals:DEFAULT_GOALS,
      sanitizeRecurringRule,
      readLocalState,
      ...
```
Add `defaultAccounts:DEFAULT_ACCOUNTS,` after `defaultGoals:DEFAULT_GOALS,`:
```js
    loadUserState({
      userDocRef,
      defaultGoals:DEFAULT_GOALS,
      defaultAccounts:DEFAULT_ACCOUNTS,
      sanitizeRecurringRule,
      readLocalState,
      ...
```

---

- [ ] **Step 2.5 — Add `renderAccountSelect` helper function**

Find the `// Charts` comment (around line 1528) and add the helper just before it:

```js
// Account select helper
function renderAccountSelect(selectEl){
  if(!selectEl)return;
  const current=selectEl.value;
  const esc=window.BudgetLogCore.utils.esc;
  selectEl.innerHTML='<option value="">\u2014 Sin cuenta \u2014</option>'+
    accounts.map(a=>'<option value="'+esc(a.id)+'"'+(current===a.id?' selected':'')+'>'+esc(a.label)+'</option>').join('');
}
```

---

- [ ] **Step 2.6 — Commit the index.html state wiring**

```bash
git add index.html
git commit -m "feat(accounts): wire accounts state into index.html — applyState, getStateSnapshot, loadUserState, renderAccountSelect"
```

---

## Task 3: entries.js — Account Badge

**Files:**
- Modify: `js/features/entries.js`
- Modify: `index.html` (CSS for `.entry-account-dot`, update `renderEntryMarkup` call sites to pass `accounts`)

---

- [ ] **Step 3.1 — Add `accounts` to `renderEntryMarkup` options and compute account meta**

In `js/features/entries.js`, find `renderEntryMarkup`:

```js
  function renderEntryMarkup(entry,options){
    const {categories,savingsGoals,formatMoney}=options;
```

Replace the destructure line with:
```js
  function renderEntryMarkup(entry,options){
    const {categories,savingsGoals,formatMoney,accounts=[]}=options;
    const account=entry.accountId?accounts.find(a=>a.id===entry.accountId):null;
    const accountMeta=account?' \u00b7 <span class="entry-account-dot" style="background:'+esc(account.color)+'"></span>'+esc(account.label):'';
    const accountDetailRow=account?'<div class="entry-detail-row"><span class="entry-detail-label">Cuenta</span><span class="entry-detail-value"><span class="entry-detail-dot" style="background:'+esc(account.color)+'"></span>'+esc(account.label)+'</span></div>':'';
```

---

- [ ] **Step 3.2 — Inject `accountMeta` and `accountDetailRow` into the markup**

In the same `renderEntryMarkup` function, find the `entry-meta` div inside the returned markup string:
```js
'<div class="entry-meta">'+esc(entry.date)+' \u00b7 '+esc(categoryLabel)+esc(goalLabel)+'</div>'
```
Replace with:
```js
'<div class="entry-meta">'+esc(entry.date)+' \u00b7 '+esc(categoryLabel)+esc(goalLabel)+accountMeta+'</div>'
```

Then find `detailRows` — the string that contains `'<div class="entry-detail-row"><span class="entry-detail-label">Tipo</span>` and ends before `entry-detail-actions`. The account detail row should be inserted after the goal row and before the actions div.

Find in `detailRows`:
```js
      (goal?'<div class="entry-detail-row"><span class="entry-detail-label">Meta</span><span class="entry-detail-value">'+esc(goal.name)+'</span></div>':'')+
      '<div class="entry-detail-actions">
```
Replace with:
```js
      (goal?'<div class="entry-detail-row"><span class="entry-detail-label">Meta</span><span class="entry-detail-value">'+esc(goal.name)+'</span></div>':'')+
      accountDetailRow+
      '<div class="entry-detail-actions">
```

---

- [ ] **Step 3.3 — Add `.entry-account-dot` CSS to index.html**

In `index.html`, find the existing `.entry-detail-dot` CSS rule (search for `entry-detail-dot`):
```css
  .entry-detail-dot {
```
Add after it:
```css
  .entry-account-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:3px;vertical-align:middle;}
```

---

- [ ] **Step 3.4 — Pass `accounts` to all `renderEntryMarkup` call sites in index.html**

Search for every place in `index.html` where `renderEntryMarkup` is called (search for `renderEntryMarkup(`). There should be two — one in `renderEntries` and one in `renderDashboard` (for recent entries). In each, add `accounts` to the options object:

Before (example pattern):
```js
entry=>renderEntryMarkup(entry,{categories:CATEGORIES,savingsGoals,formatMoney:MXN})
```
After:
```js
entry=>renderEntryMarkup(entry,{categories:CATEGORIES,savingsGoals,formatMoney:MXN,accounts})
```

---

- [ ] **Step 3.5 — Commit**

```bash
git add js/features/entries.js index.html
git commit -m "feat(accounts): show account badge on entry cards"
```

---

## Task 4: export.js — Cuenta Column

**Files:**
- Modify: `js/features/export.js`
- Modify: `index.html` (pass `accounts` to `exportBudgetData`)

---

- [ ] **Step 4.1 — Add `accounts` parameter and `accMap` to `exportBudgetData`**

In `js/features/export.js`, find the function signature destructure:
```js
    const {
      XLSX,
      entries,
      monthEntries,
      categories,
      savingsGoals,
      goals,
      entryMonth,
      exportScope,
      monthKey,
      fallbackMonthKey,
      filenamePrefix='BudgetLog'
    }=options;
```
Replace with:
```js
    const {
      XLSX,
      entries,
      monthEntries,
      categories,
      savingsGoals,
      goals,
      accounts=[],
      entryMonth,
      exportScope,
      monthKey,
      fallbackMonthKey,
      filenamePrefix='BudgetLog'
    }=options;
```

Then add `accMap` right after `goalMap`:
```js
    const goalMap=Object.fromEntries(savingsGoals.map(goal=>[goal.id,goal.name]));
    const accMap=Object.fromEntries(accounts.map(a=>[a.id,a.label]));
```

---

- [ ] **Step 4.2 — Add Cuenta column to Movimientos sheet**

Find the `entriesData` array definition:
```js
    const entriesData=[
      ['Fecha','Tipo','Descripción','Notas','Categoría','Meta de ahorro','Monto (MXN)'],
      ...[...entries].sort((a,b)=>a.date.localeCompare(b.date)).map(entry=>[
        entry.date,
        entry.type==='income'?'Ingreso':'Gasto',
        entry.description,
        entry.notes||'',
        entry.type==='income'?'Ingreso':(catMap[entry.category]||entry.category),
        goalMap[entry.goalId]||'',
        entry.type==='income'?entry.amount:-entry.amount
      ])
    ];
    const ws1=XLSX.utils.aoa_to_sheet(entriesData);
    ws1['!cols']=[{wch:12},{wch:10},{wch:32},{wch:28},{wch:18},{wch:22},{wch:16}];
```
Replace with:
```js
    const entriesData=[
      ['Fecha','Tipo','Descripción','Notas','Categoría','Meta de ahorro','Cuenta','Monto (MXN)'],
      ...[...entries].sort((a,b)=>a.date.localeCompare(b.date)).map(entry=>[
        entry.date,
        entry.type==='income'?'Ingreso':'Gasto',
        entry.description,
        entry.notes||'',
        entry.type==='income'?'Ingreso':(catMap[entry.category]||entry.category),
        goalMap[entry.goalId]||'',
        accMap[entry.accountId]||'',
        entry.type==='income'?entry.amount:-entry.amount
      ])
    ];
    const ws1=XLSX.utils.aoa_to_sheet(entriesData);
    ws1['!cols']=[{wch:12},{wch:10},{wch:32},{wch:28},{wch:18},{wch:22},{wch:18},{wch:16}];
```

---

- [ ] **Step 4.3 — Pass `accounts` to the `exportBudgetData` call in index.html**

Find the `runExport` function in `index.html` (around line 1468). Find the `exportBudgetData({` call and add `accounts,` after `savingsGoals,`:

```js
  const fname=exportBudgetData({
    XLSX,
    entries:subset,
    monthEntries:entries,
    categories:CATEGORIES,
    savingsGoals,
    accounts,           // ← add this line
    goals,
    entryMonth,
    ...
```

---

- [ ] **Step 4.4 — Commit**

```bash
git add js/features/export.js index.html
git commit -m "feat(accounts): add Cuenta column to Movimientos export sheet"
```

---

## Task 5: charts.js — renderAccountBarChart

**Files:**
- Modify: `js/features/charts.js`

---

- [ ] **Step 5.1 — Add `renderAccountBarChart` function**

In `js/features/charts.js`, add this function before the `root.charting={` export line:

```js
  function renderAccountBarChart(options){
    const {Chart,instances,canvas,titleEl,entries,viewYear,viewMonth,monthKey,entryMonth,accounts,monthNames}=options;
    destroyChart(instances,'accountChart');
    const currentMonthKey=monthKey(viewYear,viewMonth);
    const monthEntries=entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='expense'&&entry.accountId);
    titleEl.textContent='Gastos por cuenta \u2014 '+monthNames[viewMonth]+' '+viewYear;
    const accs=accounts.map(acc=>({
      label:acc.label,
      id:acc.id,
      color:acc.color,
      total:sumAmounts(monthEntries.filter(entry=>entry.accountId===acc.id))
    })).filter(acc=>acc.total>0);
    if(!accs.length)return false;
    canvas.height=Math.max(120,accs.length*52);
    instances.accountChart=new Chart(canvas,{
      type:'bar',
      data:{
        labels:accs.map(acc=>acc.label),
        datasets:[{
          label:'Gasto',
          data:accs.map(acc=>acc.total),
          backgroundColor:accs.map(acc=>acc.color+'cc'),
          borderColor:accs.map(acc=>acc.color),
          borderWidth:1,
          borderRadius:6
        }]
      },
      options:{
        ...CHART_DEFAULTS,
        indexAxis:'y',
        scales:{
          x:CHART_DEFAULTS.scales.x,
          y:{grid:{display:false},ticks:{color:'#f0f0f5',font:{family:'Lexend',size:11,weight:'600'}}}
        }
      }
    });
    return true;
  }
```

---

- [ ] **Step 5.2 — Export `renderAccountBarChart`**

Find the `root.charting={` export block:
```js
  root.charting={
    destroyChart,
    getLastMonths,
    buildCategorySelectorMarkup,
    renderCategoryBarChart,
    renderTrendChart,
    renderNetChart,
    renderCategoryLineChart,
    renderPieChart,
    renderSpendingDonut,
    renderSavingsProgress
  };
```
Replace with:
```js
  root.charting={
    destroyChart,
    getLastMonths,
    buildCategorySelectorMarkup,
    renderCategoryBarChart,
    renderTrendChart,
    renderNetChart,
    renderCategoryLineChart,
    renderPieChart,
    renderSpendingDonut,
    renderSavingsProgress,
    renderAccountBarChart
  };
```

---

- [ ] **Step 5.3 — Commit**

```bash
git add js/features/charts.js
git commit -m "feat(accounts): add renderAccountBarChart to charts.js"
```

---

## Task 6: index.html — Log Form + Edit Modal Account Selects

**Files:**
- Modify: `index.html` (form HTML, `logEntry`, `saveEdit`, `openEdit`, `initLog`)

---

- [ ] **Step 6.1 — Add account select to log form**

Find in the log form (`#view-log`):
```html
      <div class="form-group" id="goalGroup" style="display:none;"><label class="form-label" for="logGoalId">Meta de ahorro</label><select class="form-input" id="logGoalId"></select></div>
      <div class="form-group"><label class="form-label" for="logDate">Fecha</label><input class="form-input" type="date" id="logDate"></div>
```
Replace with:
```html
      <div class="form-group" id="goalGroup" style="display:none;"><label class="form-label" for="logGoalId">Meta de ahorro</label><select class="form-input" id="logGoalId"></select></div>
      <div class="form-group"><label class="form-label" for="logAccountId">Cuenta (opcional)</label><select class="form-input" id="logAccountId"><option value="">&#8212; Sin cuenta &#8212;</option></select></div>
      <div class="form-group"><label class="form-label" for="logDate">Fecha</label><input class="form-input" type="date" id="logDate"></div>
```

---

- [ ] **Step 6.2 — Add account select to edit modal**

Find in the edit modal (`#editModal`):
```html
    <div class="form-group" id="editGoalGroup" style="display:none;"><label class="form-label" for="editGoalId">Meta de ahorro</label><select class="form-input" id="editGoalId"></select></div>
    <div class="form-group"><label class="form-label" for="editDate">Fecha</label><input class="form-input" type="date" id="editDate"></div>
```
Replace with:
```html
    <div class="form-group" id="editGoalGroup" style="display:none;"><label class="form-label" for="editGoalId">Meta de ahorro</label><select class="form-input" id="editGoalId"></select></div>
    <div class="form-group"><label class="form-label" for="editAccountId">Cuenta (opcional)</label><select class="form-input" id="editAccountId"><option value="">&#8212; Sin cuenta &#8212;</option></select></div>
    <div class="form-group"><label class="form-label" for="editDate">Fecha</label><input class="form-input" type="date" id="editDate"></div>
```

---

- [ ] **Step 6.3 — Call `renderAccountSelect` in `initLog`**

Find `initLog` (around line 1398). It ends with something like `renderCatGrid('catGrid',currentCat,false);...`. Add two `renderAccountSelect` calls at the start of `initLog`:

Find:
```js
function initLog(){const today=toISODate(new Date());document.getElementById('logDate').value=today;document.getElementById('logAmount').value='';document.getElementById('logDesc').value='';
```
Add `renderAccountSelect(document.getElementById('logAccountId'));renderAccountSelect(document.getElementById('editAccountId'));` at the very beginning of `initLog`. The full first line becomes:

```js
function initLog(){renderAccountSelect(document.getElementById('logAccountId'));renderAccountSelect(document.getElementById('editAccountId'));const today=toISODate(new Date());document.getElementById('logDate').value=today;document.getElementById('logAmount').value='';document.getElementById('logDesc').value='';document.getElementById('logGoalId').value='';document.getElementById('logAccountId').value='';document.getElementById('logNotes').value='';currentType='expense';currentCat='food';document.getElementById('typeExpense').classList.add('active');document.getElementById('typeIncome').classList.remove('active');renderCatGrid('catGrid',currentCat,false);document.getElementById('catGroup').style.display='block';toggleSavingsGoalField(currentType,currentCat,'goalGroup','logGoalId');}
```

The key changes: add `renderAccountSelect(...)` calls at the top, and add `document.getElementById('logAccountId').value='';` to the reset block.

---

- [ ] **Step 6.4 — Read `accountId` in `logEntry`**

Find `logEntry()` (around line 1402). It builds an entry object with `{id:Date.now().toString(), type:currentType, amount, description:desc, ...}`.

Find the entry object construction. It ends with `...createdByField}`. Add `accountId` before `...createdByField`:

Find inside `logEntry`:
```js
entries.unshift({id:Date.now().toString(),type:currentType,amount,description:desc,notes,category:currentType==='expense'?currentCat:'income',date,goalId:currentType==='expense'&&currentCat==='savings'?goalId:null,...createdByField});
```
Replace with:
```js
const accountId=document.getElementById('logAccountId').value||null;
entries.unshift({id:Date.now().toString(),type:currentType,amount,description:desc,notes,category:currentType==='expense'?currentCat:'income',date,goalId:currentType==='expense'&&currentCat==='savings'?goalId:null,accountId,...createdByField});
```

---

- [ ] **Step 6.5 — Read `accountId` in `saveEdit`**

Find `saveEdit()` (around line 1422). It reads form fields and updates `e.amount`, `e.description`, etc.

After the existing field reads (after `const goalId=...`), add:
```js
const accountId=document.getElementById('editAccountId').value||null;
```

Then, before `save();closeModal();`, add:
```js
e.accountId=accountId;
```

---

- [ ] **Step 6.6 — Set `accountId` in `openEdit`**

Find `openEdit` (around line 1420). It reads the entry and populates form fields. After:
```js
document.getElementById('editGoalId').value=e.goalId||'';
```
Add:
```js
document.getElementById('editAccountId').value=e.accountId||'';
```

---

- [ ] **Step 6.7 — Commit**

```bash
git add index.html
git commit -m "feat(accounts): add account selects to log form and edit modal"
```

---

## Task 7: index.html — Account Management Modal

**Files:**
- Modify: `index.html` (modal HTML, goals tab button, account modal JS functions, event listeners)

---

- [ ] **Step 7.1 — Add the account management modal HTML**

Find the category customization modal:
```html
<!-- Category customization modal -->
<div class="modal-overlay" id="catCustomModal">
```
Add the following HTML block immediately before it:

```html
<!-- Account management modal -->
<div class="modal-overlay" id="accountModal">
  <div class="cat-custom-modal">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><div class="modal-title" style="margin-bottom:0;">Cuentas</div><button class="modal-close" onclick="closeAccountModal()" aria-label="Cerrar">&#10005;</button></div>
    <div id="accountCustomList"></div>
    <button class="cat-custom-add" id="accountAddBtn">+ Agregar cuenta</button>
    <button class="submit-btn" style="margin-top:12px;" onclick="saveAccountCustomize()">Guardar cambios</button>
  </div>
</div>
```

---

- [ ] **Step 7.2 — Add Cuentas button to goals tab header**

Find the goals tab header in `#view-goals`:
```html
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;margin-top:4px;"><div class="section-title" style="margin:0;">Metas mensuales</div><div style="display:flex;gap:6px;"><button class="cat-customize-btn" onclick="openTemplatesModal()">&#9881; Plantillas</button><button class="cat-customize-btn" onclick="openCatCustomize()">&#9998; Categorías</button></div></div>
```
Replace with:
```html
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;margin-top:4px;"><div class="section-title" style="margin:0;">Metas mensuales</div><div style="display:flex;gap:6px;"><button class="cat-customize-btn" onclick="openTemplatesModal()">&#9881; Plantillas</button><button class="cat-customize-btn" onclick="openAccountModal()">&#128179; Cuentas</button><button class="cat-customize-btn" onclick="openCatCustomize()">&#9998; Categorías</button></div></div>
```

---

- [ ] **Step 7.3 — Add account modal JS functions**

Find the `// ── Category customization` section (around line 1546). Add the following block immediately before it:

```js
// ── Account customization ─────────────────────────────────────────
let accountDraft=[];let acpTargetId=null;
function openAccountModal(){accountDraft=accounts.map(a=>({...a}));renderAccountCustomList();document.getElementById('accountModal').classList.add('open');}
function closeAccountModal(){document.getElementById('accountModal').classList.remove('open');closeAccountColorPicker();}
function renderAccountCustomList(){
  const esc=window.BudgetLogCore.utils.esc;
  document.getElementById('accountCustomList').innerHTML=accountDraft.map(a=>{
    return '<div class="cat-custom-row"><div class="cat-custom-dot" data-acc-color-target="'+esc(a.id)+'" style="background:'+esc(a.color)+'"></div><input class="cat-custom-input" data-acc-label-input="'+esc(a.id)+'" value="'+esc(a.label)+'" placeholder="Nombre de cuenta"><button class="cat-custom-delete" data-acc-delete="'+esc(a.id)+'" aria-label="Eliminar cuenta">&#10005;</button></div>';
  }).join('');
}
function addAccountDraft(){accountDraft.push({id:'acc_'+Date.now().toString(),label:'Nueva cuenta',type:'debit',color:PALETTE[accountDraft.length%PALETTE.length]||'#5b8af0'});renderAccountCustomList();}
function deleteAccountDraft(id){accountDraft=accountDraft.filter(a=>a.id!==id);if(acpTargetId===id)closeAccountColorPicker();renderAccountCustomList();}
function openAccountColorPicker(accId,dotEl){closeColorPicker();if(acpTargetId===accId){closeAccountColorPicker();return;}acpTargetId=accId;const acc=accountDraft.find(a=>a.id===accId);if(!acc)return;const pop=document.getElementById('colorPickerPop');pop.innerHTML=renderColorPickerMarkup(PALETTE,acc.color);const r=dotEl.getBoundingClientRect();pop.style.top=(r.bottom+8)+'px';pop.style.left=Math.min(r.left,window.innerWidth-196)+'px';pop.classList.add('open');}
function pickAccountColor(col){if(!acpTargetId)return;const acc=accountDraft.find(a=>a.id===acpTargetId);if(acc)acc.color=col;renderAccountCustomList();closeAccountColorPicker();}
function closeAccountColorPicker(){document.getElementById('colorPickerPop').classList.remove('open');acpTargetId=null;}
function saveAccountCustomize(){accountDraft.forEach(a=>{const input=document.querySelector('[data-acc-label-input="'+a.id+'"]');if(input)a.label=(input.value||'').trim()||'Cuenta';});accounts=accountDraft.filter(a=>a.label&&a.id);save();renderAccountSelect(document.getElementById('logAccountId'));renderAccountSelect(document.getElementById('editAccountId'));closeAccountModal();showToast('Cuentas actualizadas');}
```

---

- [ ] **Step 7.4 — Add event delegation for account modal interactions**

Find the existing `document.addEventListener('click',e=>{const pop=document.getElementById('colorPickerPop');` handler (around line 1564) that closes the color picker on outside click.

The existing handler closes the color picker when clicking outside and not on `.cat-custom-dot`. Update it to also not close when clicking `.cat-custom-dot[data-acc-color-target]`:

Find:
```js
document.addEventListener('click',e=>{const pop=document.getElementById('colorPickerPop');if(pop&&pop.classList.contains('open')&&!pop.contains(e.target)&&!e.target.classList.contains('cat-custom-dot')){closeColorPicker();}});
```
Replace with:
```js
document.addEventListener('click',e=>{
  const pop=document.getElementById('colorPickerPop');
  if(pop&&pop.classList.contains('open')&&!pop.contains(e.target)&&!e.target.classList.contains('cat-custom-dot')){
    if(cpTargetId)closeColorPicker();
    else if(acpTargetId)closeAccountColorPicker();
  }
  // Account modal delegated clicks
  const accColorDot=e.target.closest('[data-acc-color-target]');
  if(accColorDot){openAccountColorPicker(accColorDot.dataset.accColorTarget,accColorDot);return;}
  const accDelete=e.target.closest('[data-acc-delete]');
  if(accDelete){deleteAccountDraft(accDelete.dataset.accDelete);return;}
  // Color picker swatch for accounts
  if(acpTargetId&&e.target.closest('#colorPickerPop')){
    const swatch=e.target.closest('[data-palette-color]');
    if(swatch){pickAccountColor(swatch.dataset.paletteColor);return;}
  }
});
```

Also find the existing delegated handler for `#accountAddBtn`. Search for the existing `catAddBtn` click listener:

```js
  document.getElementById('catAddBtn').addEventListener('click',addCategoryDraft);
```

Add alongside it:
```js
  document.getElementById('accountAddBtn').addEventListener('click',addAccountDraft);
```

---

- [ ] **Step 7.5 — Commit**

```bash
git add index.html
git commit -m "feat(accounts): add account management modal with color picker and goals tab button"
```

---

## Task 8: index.html — Charts Tab + Panel

**Files:**
- Modify: `index.html` (tab HTML, panel HTML, CSS grid update, `renderActiveChart`, `renderAccountBarChart` wiring, charting destructure)

---

- [ ] **Step 8.1 — Import `renderAccountBarChart` in the charting destructure**

Find (around line 821):
```js
const {destroyChart:destroyFeatureChart,getLastMonths,buildCategorySelectorMarkup,renderCategoryBarChart,renderTrendChart:renderTrendChartFeature,renderNetChart:renderNetChartFeature,renderCategoryLineChart,renderPieChart:renderPieChartFeature,renderSpendingDonut:renderSpendingDonutFeature,renderSavingsProgress:renderSavingsProgressFeature}=charting;
```
Replace with:
```js
const {destroyChart:destroyFeatureChart,getLastMonths,buildCategorySelectorMarkup,renderCategoryBarChart,renderTrendChart:renderTrendChartFeature,renderNetChart:renderNetChartFeature,renderCategoryLineChart,renderPieChart:renderPieChartFeature,renderSpendingDonut:renderSpendingDonutFeature,renderSavingsProgress:renderSavingsProgressFeature,renderAccountBarChart:renderAccountBarChartFeature}=charting;
```

---

- [ ] **Step 8.2 — Add the Cuentas tab button**

Find the chart tabs div:
```html
    <div class="chart-tabs">
      <button class="chart-tab active" id="ctab-cats" data-chart-tab="cats">Gastos</button>
      <button class="chart-tab" id="ctab-trend" data-chart-tab="trend">Tendencia</button>
      <button class="chart-tab" id="ctab-catline" data-chart-tab="catline">Por categoría</button>
      <button class="chart-tab" id="ctab-metas" data-chart-tab="metas">Ahorro</button>
    </div>
```
Replace with:
```html
    <div class="chart-tabs">
      <button class="chart-tab active" id="ctab-cats" data-chart-tab="cats">Gastos</button>
      <button class="chart-tab" id="ctab-trend" data-chart-tab="trend">Tendencia</button>
      <button class="chart-tab" id="ctab-catline" data-chart-tab="catline">Por categoría</button>
      <button class="chart-tab" id="ctab-metas" data-chart-tab="metas">Ahorro</button>
      <button class="chart-tab" id="ctab-cuentas" data-chart-tab="cuentas">Cuentas</button>
    </div>
```

---

- [ ] **Step 8.3 — Add the Cuentas chart panel**

Find the metas panel:
```html
    <div class="chart-panel" id="cpanel-metas">
      <div class="chart-card"><div class="chart-card-title">Progreso de metas de ahorro</div><div class="chart-wrap"><canvas id="savingsProgress"></canvas><div id="savingsProgressEmpty"></div></div></div>
    </div>
```
Add the cuentas panel immediately after it:
```html
    <div class="chart-panel" id="cpanel-cuentas">
      <div class="chart-card"><div class="chart-card-title" id="accountChartTitle">Gastos por cuenta</div><div class="chart-wrap"><canvas id="accountChart"></canvas><div id="accountChartEmpty"></div></div></div>
    </div>
```

---

- [ ] **Step 8.4 — Update chart-tabs CSS grid for 5 tabs**

Find the chart-tabs responsive CSS:
```css
  @media (min-width:560px) {
    .chart-tabs { grid-template-columns:repeat(4,minmax(0,1fr)); }
```
Replace with:
```css
  @media (min-width:560px) {
    .chart-tabs { grid-template-columns:repeat(5,minmax(0,1fr)); }
```

---

- [ ] **Step 8.5 — Add `renderAccountChart` wrapper and update `renderActiveChart`**

Find the `renderSavingsProgressChart` function (around line 1544). Add after it:

```js
function renderAccountChart(){const rendered=renderAccountBarChartFeature({Chart,instances:chartInstances,canvas:document.getElementById('accountChart'),titleEl:document.getElementById('accountChartTitle'),entries,viewYear,viewMonth,monthKey,entryMonth,accounts,monthNames:MONTH_NAMES});toggleChartEmptyState('accountChart','accountChartEmpty',!!rendered,{icon:'\uD83D\uDCB3',title:'Sin movimientos etiquetados',message:'Asigna una cuenta al registrar movimientos para ver este gráfico.',ctaLabel:'+ Agregar movimiento',ctaAction:()=>showView('log'),variant:'card'});}
```

Then find `renderActiveChart` (around line 1532):
```js
function renderActiveChart(){if(activeChartTab==='cats'){renderCatBarChart();renderPieChart();}if(activeChartTab==='trend'){renderTrendChart();renderNetChart();}if(activeChartTab==='catline'){renderCatSelector();renderCatLineChart();}if(activeChartTab==='metas'){renderSavingsProgressChart();}}
```
Replace with:
```js
function renderActiveChart(){if(activeChartTab==='cats'){renderCatBarChart();renderPieChart();}if(activeChartTab==='trend'){renderTrendChart();renderNetChart();}if(activeChartTab==='catline'){renderCatSelector();renderCatLineChart();}if(activeChartTab==='metas'){renderSavingsProgressChart();}if(activeChartTab==='cuentas'){renderAccountChart();}}
```

---

- [ ] **Step 8.6 — Verify `switchChartTab` works with the new tab**

`switchChartTab` uses `document.querySelectorAll('.chart-tab')` to clear all active states, then looks up `'ctab-'+tab` by ID. The new `ctab-cuentas` tab will be handled automatically. No code change needed — just verify by reading the function.

---

- [ ] **Step 8.7 — Commit**

```bash
git add index.html
git commit -m "feat(accounts): add Por cuenta chart tab with bar chart"
```

---

## Manual Verification Checklist

Open the app in browser DevTools (F12) after each task and check:

**After Task 1 (state):**
- [ ] Console: no errors on load
- [ ] `localStorage.getItem('bl_accounts')` after first save returns a valid JSON array

**After Task 2 (wiring):**
- [ ] `accounts` variable is accessible in console
- [ ] `accounts.length` equals 3 (the 3 defaults) for a fresh/existing user
- [ ] Sign out → sign in: Firestore doc includes `accounts` field

**After Task 3 (entry badge):**
- [ ] Log an entry with an account → account label appears in the entry meta line with a colored dot
- [ ] Log an entry without an account → no extra text, no crash

**After Task 4 (export):**
- [ ] Export → open xlsx → Movimientos sheet has a `Cuenta` column at index 6
- [ ] Entries with accounts show the account label; untagged entries show blank

**After Task 5 (chart):**
- [ ] `js/features/charts.js` loads without console errors

**After Task 6 (forms):**
- [ ] Log form shows "Cuenta (opcional)" select with 3 options
- [ ] Edit modal shows "Cuenta (opcional)" select pre-filled for entries that have `accountId`
- [ ] Logging entry with account → entry card shows badge
- [ ] Logging entry without account → no badge, no crash

**After Task 7 (management):**
- [ ] Goals tab shows "💳 Cuentas" button
- [ ] Tap button → modal opens with 3 default rows
- [ ] Rename an account → tap "Guardar" → select in log form reflects new name
- [ ] Add a new account → color picker works → save → appears in selects
- [ ] Delete a non-default account → removed from list after save

**After Task 8 (chart tab):**
- [ ] Charts tab shows 5 tabs: Gastos / Tendencia / Por categoría / Ahorro / Cuentas
- [ ] Tap "Cuentas" → empty state if no tagged entries; bar chart if some entries have accountId
- [ ] Chart bars use account colors correctly
