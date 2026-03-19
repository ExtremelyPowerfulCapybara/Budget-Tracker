# Skill: Creating a New JS Module

Use this skill when creating a new file in `js/core/` or `js/features/`.

---

## Core Module Template (js/core/)

Core modules expose shared utilities, data, or logic. They use `window.BudgetLogCore`.

```js
// js/core/my-module.js
(function(){
  const root = window.BudgetLogCore = window.BudgetLogCore || {};

  // Functions go here
  function myHelper(input) {
    return input;
  }

  // Expose on the namespace
  root.myModule = {
    myHelper
  };
})();
```

Rules for core modules:
- Must be usable with no DOM, no Firebase SDK, no Chart.js
- Only pure functions — no side effects
- No references to `document`, `window.localStorage`, or any browser API
- Other core modules can be accessed via `root.utils`, `root.config`, etc. — but only if loaded first

Load order for core: `config → utils → selectors → storage → cloud`
A new core module should slot into this chain at the right dependency level.

---

## Feature Module Template (js/features/)

Feature modules render HTML or coordinate UI behavior. They use `window.BudgetLogFeatures`.

```js
// js/features/my-feature.js
(function(){
  const root = window.BudgetLogFeatures = window.BudgetLogFeatures || {};

  /**
   * Returns an HTML string for the feature panel.
   * @param {Object} options
   * @param {Array}  options.entries     - current state entries
   * @param {Function} options.formatMoney - BudgetLogCore.utils.MXN
   */
  function renderMyFeatureMarkup(options) {
    const { entries, formatMoney } = options;

    if (!entries.length) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Sin datos</div>
          <div class="empty-sub">Descripción de qué hacer aquí.</div>
        </div>
      `;
    }

    return entries.map(entry => `
      <div class="my-item" data-id="${entry.id}">
        <span>${entry.description}</span>
        <span>${formatMoney(entry.amount)}</span>
      </div>
    `).join('');
  }

  root.myFeature = {
    renderMyFeatureMarkup
  };
})();
```

Rules for feature modules:
- Return HTML strings — never directly manipulate the DOM
- Accept ALL dependencies via the `options` parameter (entries, formatMoney, categories, etc.)
- Never read from `window.BudgetLogCore` directly — receive what you need as options
- Never call `document.getElementById()` or `document.querySelector()` inside the module
- Every user-visible string must be in **Spanish**
- Use `formatMoney` (which is `BudgetLogCore.utils.MXN`) for all currency display

---

## Registering the Module in index.html

After creating the file, add the `<script>` tag in index.html:

**For core modules** — in the core scripts block, in dependency order:
```html
<script src="js/core/config.js"></script>
<script src="js/core/utils.js"></script>
<script src="js/core/my-new-core-module.js"></script>  <!-- ← insert here -->
<script src="js/core/selectors.js"></script>
```

**For feature modules** — in the features scripts block (order doesn't matter among features):
```html
<script src="js/features/dashboard.js"></script>
<script src="js/features/my-feature.js"></script>  <!-- ← add anywhere here -->
<script src="js/features/charts.js"></script>
```

---

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| File name | kebab-case | `debt-tracker.js` |
| Namespace key | camelCase | `root.debtTracker` |
| Exported functions | camelCase | `renderDebtMarkup` |
| HTML data attributes | kebab-case with feature prefix | `data-debt-action="add"` |
| CSS class names | kebab-case | `.debt-card`, `.debt-item` |

---

## Empty State Pattern

Every list view must have an empty state. Use this HTML pattern:
```js
if (!items.length) {
  return `
    <div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-title">Sin [elementos]</div>
      <div class="empty-sub">Descripción de qué hacer para agregar datos.</div>
    </div>
  `;
}
```

---

## Event Handling Pattern

In HTML strings, never use `onclick`. Use `data-` attributes:
```js
// In the module — return markup with data attributes
return `<button data-myfeature-action="delete" data-myfeature-id="${item.id}">Eliminar</button>`;

// In index.html inline script — handle via delegation
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-myfeature-action]');
  if (!btn) return;
  const action = btn.dataset.myfeatureAction;
  const id = btn.dataset.myfeatureId;
  if (action === 'delete') handleDelete(id);
});
```
