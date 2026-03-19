# Skill: Adding a New Feature Tab to BudgetLog

Use this skill when adding a new major section to the app that requires a new navigation tab,
a new feature module, and potentially new state.

---

## Checklist

Work through these in order. Do not skip steps.

### 1. Plan state changes first
- Does this feature need new state? (new array, new object key)
- If yes, read `.claude/skills/state-changes/SKILL.md` before touching any files
- New state must be added to: `storage.js` (createEmptyState + normalizeState), `cloud.js` (serializeCloudState), and the Firestore write

### 2. Add the nav button in index.html
Find the `.nav` section and add a new `.nav-btn`:
```html
<button class="nav-btn" data-tab="myFeature">
  <span class="nav-icon">🔖</span>
  <span>Label</span>
</button>
```
- Icon must be an emoji (no external icon libraries)
- Label in Spanish, max 8 characters to fit mobile
- `data-tab` value must be camelCase and unique

### 3. Add the tab panel in index.html
Find the `.tab-content` section and add:
```html
<div class="tab-panel" id="tab-myFeature">
  <!-- content rendered by js/features/my-feature.js -->
</div>
```
The tab panel ID must match: `tab-` + the `data-tab` value.

### 4. Create the feature module
Create `js/features/my-feature.js`:
```js
(function(){
  const root = window.BudgetLogFeatures = window.BudgetLogFeatures || {};

  function renderMyFeatureMarkup(options) {
    const { /* destructure what you need from state */ } = options;
    // return HTML string
  }

  root.myFeature = {
    renderMyFeatureMarkup
  };
})();
```

Rules for feature modules:
- IIFE pattern, namespace under `window.BudgetLogFeatures`
- Return HTML strings, never directly manipulate the DOM
- Accept all dependencies via the `options` parameter
- Never access `window.BudgetLogCore` directly — receive utils/selectors as passed options
- Never use `document.getElementById` inside the module

### 5. Load the script in index.html
Add the `<script>` tag AFTER all core modules and BEFORE the closing `</body>`:
```html
<script src="js/features/my-feature.js"></script>
```
Load order is: core scripts first, then features. Features can be in any order among themselves.

### 6. Wire it into the composition layer in index.html
Find the `renderTab()` function (or equivalent render dispatch) in the inline script and add a case:
```js
case 'myFeature':
  document.getElementById('tab-myFeature').innerHTML =
    window.BudgetLogFeatures.myFeature.renderMyFeatureMarkup({
      entries: state.entries,
      // ... pass what the module needs
      formatMoney: BudgetLogCore.utils.MXN
    });
  break;
```

### 7. Handle events
Add event delegation in the inline script's main event listener:
```js
// Inside the delegated click handler
const myAction = e.target.closest('[data-myfeature-action]');
if (myAction) {
  const action = myAction.dataset.myfeatureAction;
  // handle action
}
```
- Always use `data-` attributes for action triggers
- Always use `e.target.closest()` for event delegation
- Never add inline `onclick` handlers in the HTML strings returned by modules

### 8. Add to export if relevant
If the feature has financial data, add a new sheet in `js/features/export.js`.
See `.claude/skills/charts/SKILL.md` if you're adding charts.

### 9. Test manually
- Tab switches correctly
- Content renders on first load
- Content re-renders when navigating back to tab
- Empty state shows when no data
- Works after sign-out and sign-in

---

## Common Mistakes

- **Forgetting to add state to normalizeState()** — new state keys silently become undefined for existing users
- **Mutating state directly** — always create a new object/array, never `state.entries.push()`
- **Using innerHTML of the panel before the module script loads** — script tag must be before the inline wiring code
- **Spanish strings** — every user-visible string must be in Spanish
- **Hardcoded colors** — use `var(--accent)` or category colors, never `#5b8af0` inline in JS strings
