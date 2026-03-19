(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};
  const esc=window.BudgetLogCore.utils.esc;

  function cloneCategoryDraft(categories){
    const draft={};
    categories.forEach(category=>{
      draft[category.id]={label:category.label,color:category.color,isCustom:!!category.isCustom};
    });
    return draft;
  }

  function renderCategoryCustomListMarkup(categoryIds,draft){
    return categoryIds.map(categoryId=>{
      const category=draft[categoryId];
      if(!category)return '';
      return `<div class="cat-custom-row"><div class="cat-custom-dot" data-cat-color-target="${esc(categoryId)}" style="background:${esc(category.color)}"></div><input class="cat-custom-input" data-cat-label-input="${esc(categoryId)}" value="${esc(category.label)}" placeholder="Nombre de categor\u00eda"><div class="cat-custom-badge">${category.isCustom?'Nueva':'Base'}</div>${category.isCustom?'<button class="cat-custom-delete" data-cat-delete="'+esc(categoryId)+'" aria-label="Eliminar categor\u00eda">&#10005;</button>':''}</div>`;
    }).join('');
  }

  function renderColorPickerMarkup(palette,selectedColor){
    return palette.map(color=>{
      return `<div class="cp-swatch${selectedColor===color?' active':''}" data-palette-color="${esc(color)}" style="background:${esc(color)}"></div>`;
    }).join('');
  }

  root.categoryCustomization={
    cloneCategoryDraft,
    renderCategoryCustomListMarkup,
    renderColorPickerMarkup
  };
})();
