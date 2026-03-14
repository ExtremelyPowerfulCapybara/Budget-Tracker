# BudgetLog patch script — run once then delete
# Double-click or run: python _patch.py

import os, sys

here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, 'index.html')

with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

original = html

# Patch 1: nav label
html = html.replace(
    "showView('dashboard')\">Dashboard</button>",
    "showView('dashboard')\">Inicio</button>",
    1
)

# Patch 2: pie canvas after bar chart
html = html.replace(
    '<div class="chart-card"><div class="chart-card-title" id="catChartTitle">Gastos por categoria</div><div class="chart-wrap"><canvas id="catChart"></canvas></div></div>\n    </div>',
    '<div class="chart-card"><div class="chart-card-title" id="catChartTitle">Gastos por categoria</div><div class="chart-wrap"><canvas id="catChart"></canvas></div></div>\n      <div class="chart-card" style="margin-top:12px;"><div class="chart-card-title">Distribucion de gastos</div><div class="chart-wrap" style="max-width:280px;margin:0 auto;"><canvas id="pieChart"></canvas></div></div>\n    </div>',
    1
)

# Patch 3: renderActiveChart
html = html.replace(
    "function renderActiveChart(){if(activeChartTab==='cats')renderCatBarChart();",
    "function renderActiveChart(){if(activeChartTab==='cats'){renderCatBarChart();renderPieChart();}",
    1
)

# Patch 4: renderPieChart function
PIE = """
function renderPieChart(){
  destroyChart('pieChart');
  var mk=monthKey(viewYear,viewMonth);
  var mes=entries.filter(function(e){return entryMonth(e)===mk&&e.type==='expense';});
  var cats=CATEGORIES.map(function(c){return{label:c.label,color:CAT_COLORS[c.id],total:mes.filter(function(e){return e.category===c.id;}).reduce(function(s,e){return s+e.amount;},0)};}).filter(function(c){return c.total>0;}).sort(function(a,b){return b.total-a.total;});
  if(!cats.length)return;
  chartInstances['pieChart']=new Chart(document.getElementById('pieChart'),{type:'doughnut',data:{labels:cats.map(function(c){return c.label;}),datasets:[{data:cats.map(function(c){return c.total;}),backgroundColor:cats.map(function(c){return c.color+'cc';}),borderColor:cats.map(function(c){return c.color;}),borderWidth:1.5,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:true,cutout:'62%',plugins:{legend:{display:true,position:'bottom',labels:{color:'#6b6f80',font:{family:'DM Mono',size:10},boxWidth:10,padding:12,usePointStyle:true}},tooltip:{backgroundColor:'#1e2029',borderColor:'#2a2d38',borderWidth:1,titleColor:'#f0f0f5',bodyColor:'#6b6f80',titleFont:{family:'Syne',weight:'700'},bodyFont:{family:'DM Mono'},callbacks:{label:function(ctx){var total=ctx.dataset.data.reduce(function(a,b){return a+b;},0);var pct=total>0?((ctx.raw/total)*100).toFixed(1):'0';return' $'+ctx.raw.toLocaleString('es-MX',{minimumFractionDigits:2})+' ('+pct+'%)';}}}}}});
}
"""
html = html.replace('</script>\n</body>\n</html>', PIE + '\n</script>\n</body>\n</html>', 1)

checks = ['Inicio', 'pieChart', 'renderPieChart', 'doughnut']
ok = all(c in html for c in checks)

if not ok:
    print('ERROR: Some patches failed:')
    for c in checks:
        print(f"  {'OK' if c in html else 'MISSING'}: {c}")
    sys.exit(1)

if html == original:
    print('WARNING: No changes made - file may already be patched or patterns not found')
    sys.exit(1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print('Patched successfully!')
print('You can now delete this file (_patch.py) and commit index.html')
