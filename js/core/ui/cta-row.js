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

  function createCtaRowMarkup(options){
    const {
      text='',
      buttonLabel='',
      variant='default'
    }=options||{};

    return '<div class="ui-cta-row '+escapeHtml(variant)+'">'+
      '<div class="ui-cta-row-text">'+escapeHtml(text)+'</div>'+
      (buttonLabel?'<button type="button" class="ui-cta-row-btn">'+escapeHtml(buttonLabel)+'</button>':'')+
    '</div>';
  }

  function renderCtaRow(container,options){
    if(!container)return null;
    container.innerHTML=createCtaRowMarkup(options);
    const button=container.querySelector('.ui-cta-row-btn');
    if(button&&typeof options?.buttonAction==='function'){
      button.addEventListener('click',options.buttonAction);
    }
    return container;
  }

  const api={
    createCtaRowMarkup,
    renderCtaRow
  };

  ui.ctaRow=api;
})();
