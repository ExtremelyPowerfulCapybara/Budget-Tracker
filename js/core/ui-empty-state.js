(function(){
  const root=window.BudgetLogCore=window.BudgetLogCore||{};
  const esc=root.utils.esc;

  function buildEmptyStateMarkup(options){
    const {
      icon='📄',
      title='Sin datos disponibles',
      message='Todavía no hay información para mostrar aquí.',
      ctaLabel='',
      hint='',
      variant='default'
    }=options||{};

    return '<div class="empty-state '+esc(variant)+'">'+
      '<div class="empty-state-icon">'+esc(icon)+'</div>'+
      '<div class="empty-state-title">'+esc(title)+'</div>'+
      '<div class="empty-state-message">'+esc(message)+'</div>'+
      (ctaLabel?'<div class="empty-state-actions"><button type="button" class="empty-state-cta">'+esc(ctaLabel)+'</button></div>':'')+
      (hint?'<div class="empty-state-hint">'+esc(hint)+'</div>':'')+
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

  root.uiEmptyState={
    buildEmptyStateMarkup,
    renderEmptyState
  };
})();
