(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};

  function cloneCategoryDraft(categories){
    const draft={};
    categories.forEach(category=>{
      draft[category.id]={label:category.label,color:category.color};
    });
    return draft;
  }

  function renderCategoryCustomListMarkup(categories,draft){
    return categories.map(category=>{
      return `<div class="cat-custom-row"><div class="cat-custom-dot" data-cat-color-target="${category.id}" style="background:${draft[category.id].color}"></div><input class="cat-custom-input" data-cat-label-input="${category.id}" value="${draft[category.id].label}" placeholder="${category.label}"></div>`;
    }).join('');
  }

  function renderColorPickerMarkup(palette,selectedColor){
    return palette.map(color=>{
      return `<div class="cp-swatch${selectedColor===color?' active':''}" data-palette-color="${color}" style="background:${color}"></div>`;
    }).join('');
  }

  root.categoryCustomization={
    cloneCategoryDraft,
    renderCategoryCustomListMarkup,
    renderColorPickerMarkup
  };
})();
