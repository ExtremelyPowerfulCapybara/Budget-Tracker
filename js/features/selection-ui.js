(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};

  function renderCategoryGridMarkup(options){
    const {categories,selectedId,action}=options;
    return categories.map(category=>{
      const active=selectedId===category.id;
      const style=active?'border-color:'+category.color+';background:'+category.color+'22':'';
      return '<button class="cat-btn'+(active?' active':'')+'" style="'+style+'" data-selection-action="'+action+'" data-selection-id="'+category.id+'">'+category.label+'</button>';
    }).join('');
  }

  function renderFrequencyGridMarkup(frequencies,selectedId){
    return frequencies.map(frequency=>{
      return '<button class="freq-btn'+(selectedId===frequency.id?' active':'')+'" data-selection-action="freq" data-selection-id="'+frequency.id+'">'+frequency.label+'</button>';
    }).join('');
  }

  root.selectionUi={
    renderCategoryGridMarkup,
    renderFrequencyGridMarkup
  };
})();
