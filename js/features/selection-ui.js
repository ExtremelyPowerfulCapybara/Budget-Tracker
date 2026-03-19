(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};
  const esc=window.BudgetLogCore.utils.esc;

  function renderCategoryGridMarkup(options){
    const {categories,selectedId,action}=options;
    return categories.map(category=>{
      const active=selectedId===category.id;
      const style=active?'border-color:'+esc(category.color)+';background:'+esc(category.color)+'22':'';
      return '<button class="cat-btn'+(active?' active':'')+'" style="'+style+'" data-selection-action="'+action+'" data-selection-id="'+esc(category.id)+'">'+esc(category.label)+'</button>';
    }).join('');
  }

  function renderFrequencyGridMarkup(frequencies,selectedId){
    return frequencies.map(frequency=>{
      return '<button class="freq-btn'+(selectedId===frequency.id?' active':'')+'" data-selection-action="freq" data-selection-id="'+frequency.id+'">'+esc(frequency.label)+'</button>';
    }).join('');
  }

  root.selectionUi={
    renderCategoryGridMarkup,
    renderFrequencyGridMarkup
  };
})();
