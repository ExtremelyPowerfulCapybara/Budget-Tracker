(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};
  const esc=window.BudgetLogCore.utils.esc;

  const FREQUENCY_LABELS={monthly:'Mensual',biweekly:'Quincenal',weekly:'Semanal'};

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

  function buildPendingRecurring(items){
    return items.flatMap(rule=>rule.pendingDates.map(date=>({ruleId:rule.id,date})));
  }

  root.recurringFeature={
    renderRecurringListMarkup,
    buildPendingRecurring,
    FREQUENCY_LABELS
  };
})();
