# Skill: Working with Charts in BudgetLog

Use this skill when adding, modifying, or debugging charts.
All charts use Chart.js 4.4.1 via CDN. All chart logic lives in `js/features/charts.js`.

---

## Chart Instance Management

**Critical:** Chart.js instances must be destroyed before re-creating on the same canvas.
Always call `destroyChart()` first:

```js
function destroyChart(instances, id) {
  if (instances[id]) {
    instances[id].destroy();
    delete instances[id];
  }
}

// Then create:
instances.myChart = new Chart(canvas, config);
```

The `instances` object is managed in `index.html`'s inline script and passed to chart functions.
Never store instances inside `charts.js` — they live in the composition layer.

---

## Shared Defaults

All charts inherit from `CHART_DEFAULTS` in `charts.js`:

```js
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e2029',
      borderColor: '#2a2d38',
      borderWidth: 1,
      titleColor: '#f0f0f5',
      bodyColor: '#6b6f80',
      titleFont: { family: 'Lexend', weight: '700' },
      bodyFont: { family: 'Lexend Mono' },
      callbacks: {
        label: ctx => ' $' + Math.abs(ctx.raw).toLocaleString('es-MX', { minimumFractionDigits: 2 })
      }
    }
  },
  scales: {
    x: { grid: { color: '#2a2d38' }, ticks: { color: '#6b6f80', font: { family: 'Lexend Mono', size: 10 } } },
    y: { grid: { color: '#2a2d38' }, ticks: { color: '#6b6f80', font: { family: 'Lexend Mono', size: 10 }, callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) } }
  }
};
```

Always spread `CHART_DEFAULTS` and override only what you need:
```js
options: {
  ...CHART_DEFAULTS,
  plugins: {
    ...CHART_DEFAULTS.plugins,
    legend: { display: true, position: 'top', labels: { color: '#6b6f80', font: { family: 'Lexend Mono', size: 10 }, boxWidth: 12 } }
  }
}
```

---

## The 5 Existing Charts

| Chart ID | Type | Data range | File function |
|----------|------|-----------|---------------|
| `catChart` | Horizontal bar | Current month | `renderCategoryBarChart()` |
| `trendChart` | Grouped bar | Last 6 months | `renderTrendChart()` |
| `netChart` | Bar (green/red) | Last 6 months | `renderNetChart()` |
| `catLineChart` | Line | Last 6 months, 1 category | `renderCategoryLineChart()` |
| `pieChart` | Doughnut | Current month | `renderPieChart()` |

---

## Adding a New Chart

### Step 1: Add a tab button in the chart section (index.html)
Find the chart tab selector and add a new button:
```html
<button class="chart-tab-btn" data-chart="myChart">Mi Gráfica</button>
```

### Step 2: Add a canvas panel
```html
<div class="chart-panel" id="chart-myChart">
  <canvas id="myChartCanvas"></canvas>
</div>
```

### Step 3: Add the render function in charts.js
```js
function renderMyChart(options) {
  const { Chart, instances, canvas, entries, viewYear, viewMonth, monthKey, entryMonth } = options;
  destroyChart(instances, 'myChart');

  // prepare data
  const data = /* ... */;

  instances.myChart = new Chart(canvas, {
    type: 'bar',  // or line, doughnut, etc.
    data: {
      labels: /* string[] */,
      datasets: [{ /* ... */ }]
    },
    options: {
      ...CHART_DEFAULTS,
      // overrides
    }
  });
}

// Export it
root.charting = {
  // ... existing functions
  renderMyChart
};
```

### Step 4: Wire in index.html composition layer
Find the chart render dispatch and add:
```js
case 'myChart':
  window.BudgetLogFeatures.charting.renderMyChart({
    Chart: window.Chart,
    instances: chartInstances,
    canvas: document.getElementById('myChartCanvas'),
    entries: state.entries,
    viewYear, viewMonth,
    monthKey: BudgetLogCore.utils.monthKey,
    entryMonth: BudgetLogCore.utils.entryMonth,
    // pass other needed data
  });
  break;
```

---

## Color Conventions

| Data | Color |
|------|-------|
| Income | `#3dd68c` (var --income) |
| Expense | `#f05b5b` (var --expense) |
| Positive net | `#3dd68c` |
| Negative net | `#f05b5b` |
| Category colors | From `config.CAT_COLORS[categoryId]` |
| Goal/target line | `#2a2d38` with `borderDash: [5, 4]` |
| Over budget | `#f05b5b` |

For semi-transparent fills, append hex opacity: `color + '55'` (33%), `color + 'cc'` (80%).

---

## Formatting Money in Tooltips

Always use `es-MX` locale for currency formatting:
```js
callbacks: {
  label: ctx => ' $' + Math.abs(ctx.raw).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}
```

---

## Dynamic Canvas Height

For horizontal bar charts where the number of bars varies:
```js
canvas.height = Math.max(180, cats.length * 44);
```
Set this BEFORE creating the Chart instance.

---

## Common Mistakes

- **Not destroying before re-creating** — causes "Canvas is already in use" error and memory leaks
- **Using `Chart` without passing it** — Chart.js is a global via CDN, but always receive it as `options.Chart` for testability
- **Hardcoding month data** — always use `getLastMonths()` helper for 6-month lookups
- **Missing `maintainAspectRatio: true`** — charts will not resize correctly on mobile without this
- **Using `family: 'Syne'` or `family: 'DM Mono'`** — project uses Lexend only
