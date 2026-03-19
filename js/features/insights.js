(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};
  const esc=window.BudgetLogCore.utils.esc;
  const MAX_INSIGHTS=5;

  function sumAmounts(list){
    return list.reduce((sum,item)=>sum+(item.amount||0),0);
  }

  function fallbackMoney(value){
    return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(value||0);
  }

  function previousMonthRef(year,monthIndex){
    return monthIndex===0?{year:year-1,monthIndex:11}:{year,monthIndex:monthIndex-1};
  }

  function nextMonthRef(year,monthIndex){
    return monthIndex===11?{year:year+1,monthIndex:0}:{year,monthIndex:monthIndex+1};
  }

  function categoryTotals(entries,categories){
    return categories.map(category=>({
      id:category.id,
      label:category.label,
      color:category.color,
      total:sumAmounts(entries.filter(entry=>entry.type==='expense'&&entry.category===category.id))
    }));
  }

  function generateInsights(state,helpers){
    const safeState=state||{};
    const safeHelpers=helpers||{};
    const entries=safeState.entries||[];
    const goals=safeState.goals||{};
    const recurring=safeState.recurring||[];
    const categories=safeState.categories||[];
    const viewYear=safeState.viewYear;
    const viewMonth=safeState.viewMonth;
    const monthKey=safeHelpers.monthKey;
    const entryMonth=safeHelpers.entryMonth;
    const formatMoney=safeHelpers.formatMoney||fallbackMoney;
    const getForecastTotals=safeHelpers.getForecastTotals;

    if(viewYear==null||viewMonth==null||typeof monthKey!=='function'||typeof entryMonth!=='function')return [];
    if(!entries.length&&!recurring.length)return [];

    const currentMonthKey=monthKey(viewYear,viewMonth);
    const previousRef=previousMonthRef(viewYear,viewMonth);
    const previousMonthKey=monthKey(previousRef.year,previousRef.monthIndex);
    const monthEntries=entries.filter(entry=>entryMonth(entry)===currentMonthKey);
    const previousMonthEntries=entries.filter(entry=>entryMonth(entry)===previousMonthKey);
    const monthExpenseEntries=monthEntries.filter(entry=>entry.type==='expense');
    const previousExpenseEntries=previousMonthEntries.filter(entry=>entry.type==='expense');
    const currentExpenseTotal=sumAmounts(monthExpenseEntries);
    const previousExpenseTotal=sumAmounts(previousExpenseEntries);

    const currentCategoryTotals=categoryTotals(monthEntries,categories);
    const previousCategoryTotals=categoryTotals(previousMonthEntries,categories);
    const previousTotalsById=Object.fromEntries(previousCategoryTotals.map(category=>[category.id,category.total]));
    const insights=[];

    function addInsight(insight){
      if(!insight||insights.some(item=>item.id===insight.id))return;
      insights.push(insight);
    }

    const biggestCategory=currentCategoryTotals
      .filter(category=>category.total>0)
      .sort((a,b)=>b.total-a.total)[0];

    if(biggestCategory){
      const share=currentExpenseTotal>0?(biggestCategory.total/currentExpenseTotal)*100:0;
      addInsight({
        id:'largest_category_'+biggestCategory.id,
        priority:58+Math.min(18,share/4),
        type:'neutral',
        title:'Categoría principal',
        body:'Tu categoría más alta este mes es '+esc(biggestCategory.label)+'.'
      });
    }

    const budgetWarning=currentCategoryTotals
      .map(category=>{
        const goal=goals[category.id]||0;
        const ratio=goal>0?category.total/goal:0;
        return {...category,goal,ratio};
      })
      .filter(category=>category.goal>0&&category.total>0&&category.ratio>=0.75)
      .sort((a,b)=>b.ratio-a.ratio)[0];

    if(budgetWarning){
      const pct=Math.round(budgetWarning.ratio*100);
      const overPct=Math.round((budgetWarning.ratio-1)*100);
      addInsight({
        id:'budget_warning_'+budgetWarning.id,
        priority:budgetWarning.ratio>=1?96:84+Math.min(10,pct/10),
        type:'warning',
        title:budgetWarning.ratio>=1?'Presupuesto excedido':'Presupuesto en riesgo',
        body:budgetWarning.ratio>=1
          ?'Ya rebasaste tu presupuesto de '+esc(budgetWarning.label)+' por '+overPct+'%.'
          :'Ya usaste el '+pct+'% de tu presupuesto de '+esc(budgetWarning.label)+'.'
      });
    }

    const categoryIncrease=currentCategoryTotals
      .map(category=>{
        const previousTotal=previousTotalsById[category.id]||0;
        const delta=category.total-previousTotal;
        const deltaPct=previousTotal>0?(delta/previousTotal)*100:null;
        return {...category,previousTotal,delta,deltaPct};
      })
      .filter(category=>category.previousTotal>0&&category.total>category.previousTotal&&category.delta>=50&&category.deltaPct>=15)
      .sort((a,b)=>b.deltaPct-a.deltaPct)[0];

    if(categoryIncrease){
      addInsight({
        id:'category_increase_'+categoryIncrease.id,
        priority:74+Math.min(16,categoryIncrease.deltaPct/8),
        type:'warning',
        title:'Subida mensual',
        body:'Gastaste '+Math.round(categoryIncrease.deltaPct)+'% más en '+esc(categoryIncrease.label)+' que el mes pasado.'
      });
    }

    const categoryDecrease=currentCategoryTotals
      .map(category=>{
        const previousTotal=previousTotalsById[category.id]||0;
        const delta=category.total-previousTotal;
        const deltaPct=previousTotal>0?(delta/previousTotal)*100:null;
        return {...category,previousTotal,delta,deltaPct};
      })
      .filter(category=>category.previousTotal>0&&category.total<category.previousTotal&&Math.abs(category.delta)>=50&&Math.abs(category.deltaPct)>=15)
      .sort((a,b)=>a.deltaPct-b.deltaPct)[0];

    if(categoryDecrease){
      addInsight({
        id:'category_decrease_'+categoryDecrease.id,
        priority:66+Math.min(16,Math.abs(categoryDecrease.deltaPct)/8),
        type:'positive',
        title:'Mejora mensual',
        body:'Tus gastos en '+esc(categoryDecrease.label)+' bajaron '+Math.round(Math.abs(categoryDecrease.deltaPct))+'% vs el mes pasado.'
      });
    }

    const monthlySavings=sumAmounts(monthExpenseEntries.filter(entry=>entry.category==='savings'));
    if(monthlySavings>0){
      addInsight({
        id:'monthly_savings_progress',
        priority:60+Math.min(14,monthlySavings/500),
        type:'positive',
        title:'Ahorro del mes',
        body:'Llevas '+formatMoney(monthlySavings)+' ahorrados este mes.'
      });
    }

    if(typeof getForecastTotals==='function'){
      const nextRef=nextMonthRef(viewYear,viewMonth);
      const forecast=getForecastTotals(nextRef.year,nextRef.monthIndex)||{income:0,expense:0};
      const recurringExpense=forecast.expense||0;
      if(recurringExpense>0){
        if(currentExpenseTotal>0){
          const burdenPct=Math.round((recurringExpense/currentExpenseTotal)*100);
          addInsight({
            id:'recurring_burden',
            priority:burdenPct>=40?78:54+Math.min(16,burdenPct/5),
            type:burdenPct>=40?'warning':'neutral',
            title:'Carga recurrente',
            body:'Tus gastos recurrentes programados para el próximo mes equivalen al '+burdenPct+'% de tus gastos de este mes.'
          });
        }else{
          addInsight({
            id:'recurring_burden_amount',
            priority:52,
            type:'neutral',
            title:'Carga recurrente',
            body:'Tienes '+formatMoney(recurringExpense)+' en gastos recurrentes programados para el próximo mes.'
          });
        }
      }
    }

    if(!insights.length&&monthEntries.length){
      if(currentExpenseTotal>0){
        addInsight({
          id:'baseline_spending',
          priority:20,
          type:'neutral',
          title:'Resumen rápido',
          body:'Tus gastos de este mes suman '+formatMoney(currentExpenseTotal)+'.'
        });
      }
    }

    return insights
      .sort((a,b)=>b.priority-a.priority)
      .slice(0,MAX_INSIGHTS);
  }

  function renderInsightsMarkup(options){
    const insights=(options&&options.insights)||[];
    if(!insights.length)return '';
    return '<div class="insights-list">'+insights.map(insight=>{
      return '<div class="insight-mini-card '+insight.type+'"><div class="insight-mini-head"><div class="insight-mini-title">'+insight.title+'</div><div class="insight-mini-badge '+insight.type+'">'+(insight.type==='warning'?'Atención':insight.type==='positive'?'Bien':'Dato')+'</div></div><div class="insight-mini-body">'+insight.body+'</div></div>';
    }).join('')+'</div>';
  }

  root.insightsFeature={
    generateInsights,
    renderInsightsMarkup
  };
})();
