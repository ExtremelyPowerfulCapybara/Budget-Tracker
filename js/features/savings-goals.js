(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};
  const esc=window.BudgetLogCore.utils.esc;

  function renderSavingsGoalsMarkup(options){
    const {
      savingsGoals,
      getGoalSavedAmount,
      getUnassignedSavingsAmount,
      formatMoney
    }=options;

    const unassignedAmount=getUnassignedSavingsAmount();
    if(!savingsGoals.length)return '';

    const cards=savingsGoals.map(goal=>{
      const saved=getGoalSavedAmount(goal.id);
      const pct=goal.target>0?Math.min((saved/goal.target)*100,100):0;
      const done=pct>=100;
      return `<div class="savings-card"><div class="savings-card-header"><div class="savings-card-name" style="color:${esc(goal.color)}">${esc(goal.name)}</div><div><div class="savings-card-amounts"><span>${formatMoney(saved)}</span> / ${formatMoney(goal.target)}</div><div class="savings-card-pct${done?' done':''}">${pct.toFixed(0)}%${done?' \u00b7 Completada':''}</div></div></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${esc(goal.color)}"></div></div><div class="savings-card-meta">Ahorro asignado a esta meta: ${formatMoney(saved)}</div><div style="display:flex;gap:8px;margin-top:10px;"><button class="sg-contribute-btn" data-sg-action="contribute" data-sg-id="${esc(goal.id)}" aria-label="Aportar a meta">+ Aportar</button><button class="entry-btn" style="flex:1;width:auto;border-radius:8px;" data-sg-action="edit" data-sg-id="${goal.id}">&#9998; Editar</button><button class="entry-btn delete" style="width:auto;padding:0 12px;border-radius:8px;" data-sg-action="delete" data-sg-id="${goal.id}">&#10005;</button></div></div>`;
    }).join('');

    const unassignedNotice=unassignedAmount?'<div class="savings-empty">Hay '+formatMoney(unassignedAmount)+' en ahorro sin meta asignada. Puedes editar esos movimientos para vincularlos.</div>':'';
    return cards+unassignedNotice+'<button class="savings-add-btn" data-sg-action="create">+ Nueva meta de ahorro</button>';
  }

  function renderSavingsColorGridMarkup(colors,selectedColor){
    return colors.map(color=>`<div class="color-swatch${selectedColor===color?' active':''}" data-sg-color="${esc(color)}" style="background:${esc(color)}"></div>`).join('');
  }

  function prepareSavingsModalState(savingsGoals,id,fallbackColor){
    const existing=id?savingsGoals.find(goal=>goal.id===id):null;
    return {
      title:id?'Editar meta':'Nueva meta de ahorro',
      name:existing?existing.name:'',
      target:existing?existing.target:'',
      color:existing?existing.color:fallbackColor
    };
  }

  root.savingsGoalsFeature={
    renderSavingsGoalsMarkup,
    renderSavingsColorGridMarkup,
    prepareSavingsModalState
  };
})();
