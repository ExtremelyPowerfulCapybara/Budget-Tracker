(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};

  const FREQUENCY_LABELS={monthly:'Mensual',biweekly:'Quincenal',weekly:'Semanal'};

  function renderRecurringListMarkup(options){
    const {
      recurring,
      sanitizeRecurringRule,
      categories,
      savingsGoals,
      formatMoney
    }=options;

    if(!recurring.length)return '';

    return recurring.map(rule=>{
      const normalized=sanitizeRecurringRule(rule);
      const category=categories.find(item=>item.id===normalized.category);
      const goal=savingsGoals.find(item=>item.id===normalized.goalId);
      const color=normalized.type==='income'?'var(--income)':(category?category.color:'var(--muted)');
      const startText='Inicia: '+normalized.anchorDate;
      const goalText=goal?' \u00b7 Meta: '+goal.name:'';
      return '<div class="recur-card"><div class="entry-dot" style="background:'+color+'"></div><div class="recur-info"><div class="recur-name">'+normalized.description+'</div><div class="recur-meta">'+FREQUENCY_LABELS[normalized.frequency]+' \u00b7 '+startText+goalText+'</div></div><div class="recur-amount '+normalized.type+'">'+(normalized.type==='income'?'+':'-')+formatMoney(normalized.amount)+'</div><button class="entry-btn delete" data-recurring-delete="'+normalized.id+'">&#10005;</button></div>';
    }).join('');
  }

  function buildPendingRecurring(items){
    return items.flatMap(rule=>rule.pendingDates.map(date=>({ruleId:rule.id,date})));
  }

  root.recurringFeature={
    renderRecurringListMarkup,
    buildPendingRecurring,
    FREQUENCY_LABELS
  };
})();
