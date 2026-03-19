(function(){
  const root=window.BudgetLogCore=window.BudgetLogCore||{};
  const ui=root.ui=root.ui||{};
  const esc=root.utils.esc;

  function createCtaRowMarkup(options){
    const {
      text='',
      buttonLabel='',
      variant='default'
    }=options||{};

    return '<div class="ui-cta-row '+esc(variant)+'">'+
      '<div class="ui-cta-row-text">'+esc(text)+'</div>'+
      (buttonLabel?'<button type="button" class="ui-cta-row-btn">'+esc(buttonLabel)+'</button>':'')+
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
