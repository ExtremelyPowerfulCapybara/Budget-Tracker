(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};

  function sumAmounts(list){
    return list.reduce((sum,item)=>sum+item.amount,0);
  }

  function renderInsightMarkup(options){
    const {monthEntries,previousMonthEntries,categories,formatMoney}=options;
    const expense=sumAmounts(monthEntries.filter(entry=>entry.type==='expense'));
    const income=sumAmounts(monthEntries.filter(entry=>entry.type==='income'));
    const prevExpense=sumAmounts(previousMonthEntries.filter(entry=>entry.type==='expense'));
    const prevIncome=sumAmounts(previousMonthEntries.filter(entry=>entry.type==='income'));
    const savingsRate=income>0?((income-expense)/income*100):0;
    const biggestCategory=categories.map(category=>({
      label:category.label,
      color:category.color,
      total:sumAmounts(monthEntries.filter(entry=>entry.type==='expense'&&entry.category===category.id))
    })).sort((a,b)=>b.total-a.total)[0]||{label:'Sin gastos',color:'var(--muted)',total:0};
    const expenseDelta=prevExpense>0?((expense-prevExpense)/prevExpense*100):null;
    const incomeDelta=prevIncome>0?((income-prevIncome)/prevIncome*100):null;

    function deltaPill(pct,inverted){
      if(pct===null)return '';
      const cls=Math.abs(pct)<1?'flat':((inverted?pct<0:pct>0)?'down':'up');
      return '<span class="delta-pill '+cls+'">'+(pct>0?'+':'')+pct.toFixed(1)+'%</span>';
    }

    if(!expense&&!income)return '';

    return '<div class="insight-title">Resumen del mes</div><div class="insight-grid"><div class="insight-item"><div class="insight-item-label">Tasa de ahorro</div><div class="insight-item-value '+(savingsRate>=20?'positive':savingsRate<0?'negative':'neutral')+'">'+savingsRate.toFixed(1)+'%</div><div class="insight-item-sub">'+(savingsRate>=20?'Meta alcanzada':'Meta: 20%')+'</div></div><div class="insight-item"><div class="insight-item-label">Mayor gasto</div><div class="insight-item-value neutral" style="color:'+biggestCategory.color+'">'+biggestCategory.label+'</div><div class="insight-item-sub">'+formatMoney(biggestCategory.total)+'</div></div><div class="insight-divider"></div><div class="insight-item"><div class="insight-item-label">Gastos vs. mes anterior</div><div class="insight-item-value neutral">'+formatMoney(expense)+deltaPill(expenseDelta,true)+'</div><div class="insight-item-sub">'+(prevExpense?'Ant: '+formatMoney(prevExpense):'Sin datos previos')+'</div></div><div class="insight-item"><div class="insight-item-label">Ingresos vs. mes anterior</div><div class="insight-item-value neutral">'+formatMoney(income)+deltaPill(incomeDelta,false)+'</div><div class="insight-item-sub">'+(prevIncome?'Ant: '+formatMoney(prevIncome):'Sin datos previos')+'</div></div></div>';
  }

  function renderCategoryBarsMarkup(options){
    const {monthEntries,categories,goals,formatMoney,getGoalValue}=options;
    return categories.map(category=>{
      const actual=sumAmounts(monthEntries.filter(entry=>entry.type==='expense'&&entry.category===category.id));
      const goal=typeof getGoalValue==='function'?getGoalValue(category.id):(goals[category.id]||0);
      if(!actual&&!goal)return '';
      const pct=goal>0?Math.min((actual/goal)*100,100):0;
      const over=goal>0&&actual>goal;
      return '<div class="category-bar"><div class="category-bar-header"><div class="category-bar-name" style="color:'+category.color+'">'+category.label+'</div><div class="category-bar-nums"><span>'+formatMoney(actual)+'</span>'+(goal?' / '+formatMoney(goal):' <span class="bar-no-goal">Sin meta</span>')+'</div></div>'+(goal?'<div class="bar-track'+(over?' over':'')+'"><div class="bar-fill" style="width:'+pct+'%;background:'+category.color+'"></div></div><div class="bar-pct'+(over?' over':'')+'">'+pct.toFixed(0)+'%'+(over?' \u00b7 excedido':'')+'</div>':'<div class="bar-pct bar-pct-empty">Configura una meta para ver el avance</div>')+'</div>';
    }).join('');
  }

  function renderRecentEntriesMarkup(options){
    const {monthEntries,renderEntry}=options;
    const recent=[...monthEntries].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
    if(!recent.length)return '';
    return recent.map(renderEntry).join('');
  }

  function getNextMonthRef(viewYear,viewMonth){
    let nextYear=viewYear;
    let nextMonth=viewMonth+1;
    if(nextMonth>11){
      nextMonth=0;
      nextYear++;
    }
    return {nextYear,nextMonth};
  }

  function renderForecastMarkup(options){
    const {viewYear,viewMonth,monthNames,getForecastTotals,formatMoney}=options;
    const {nextYear,nextMonth}=getNextMonthRef(viewYear,viewMonth);
    const {income,expense}=getForecastTotals(nextYear,nextMonth);
    const net=income-expense;
    if(!income&&!expense)return '';
    return '<div class="forecast-card"><div class="forecast-grid"><div class="forecast-item"><div class="forecast-label">Ingresos</div><div class="forecast-val" style="color:var(--income)">'+formatMoney(income)+'</div></div><div class="forecast-item"><div class="forecast-label">Gastos</div><div class="forecast-val" style="color:var(--expense)">'+formatMoney(expense)+'</div></div><div class="forecast-item"><div class="forecast-label">Neto</div><div class="forecast-val" style="color:'+(net>=0?'var(--income)':'var(--expense)')+'">'+(net<0?'-':'')+formatMoney(net)+'</div></div></div><div class="forecast-note">Calculado con la misma programación de tus recurrentes para '+monthNames[nextMonth]+' '+nextYear+'</div></div>';
  }

  root.dashboardFeature={
    renderInsightMarkup,
    renderCategoryBarsMarkup,
    renderRecentEntriesMarkup,
    renderForecastMarkup
  };
})();
