(function(){
  const root=window.BudgetLogCore=window.BudgetLogCore||{};
  const ui=root.ui=root.ui||{};

  function escapeHtml(value){
    return String(value||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function buildEmptyStateMarkup(options){
    const {
      icon='📄',
      title='Sin datos disponibles',
      message='Todavia no hay informacion para mostrar aqui.',
      ctaLabel='',
      hint='',
      variant='default'
    }=options||{};

    return '<div class="empty-state '+escapeHtml(variant)+'">'+
      '<div class="empty-state-icon">'+escapeHtml(icon)+'</div>'+
      '<div class="empty-state-title">'+escapeHtml(title)+'</div>'+
      '<div class="empty-state-message">'+escapeHtml(message)+'</div>'+
      (ctaLabel?'<div class="empty-state-actions"><button type="button" class="empty-state-cta">'+escapeHtml(ctaLabel)+'</button></div>':'')+
      (hint?'<div class="empty-state-hint">'+escapeHtml(hint)+'</div>':'')+
    '</div>';
  }

  function renderEmptyState(container,options){
    if(!container)return null;
    container.innerHTML=buildEmptyStateMarkup(options);
    const button=container.querySelector('.empty-state-cta');
    if(button&&typeof options?.ctaAction==='function'){
      button.addEventListener('click',options.ctaAction);
    }
    return container;
  }

  const api={
    buildEmptyStateMarkup,
    renderEmptyState
  };

  ui.emptyState=api;
  root.uiEmptyState=api;
})();
