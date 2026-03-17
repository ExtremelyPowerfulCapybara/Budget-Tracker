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

  function toMarkup(content){
    return typeof content==='string'?content:(content?.outerHTML||'');
  }

  function createSectionCardMarkup(options){
    const {
      title='',
      subtitle='',
      content='',
      actions='',
      bodyClass='',
      cardClass=''
    }=options||{};
    const hasHead=title||subtitle||actions;
    return '<div class="ui-section-card '+escapeHtml(cardClass)+'">'+
      (hasHead?'<div class="ui-section-card-head">'+
        '<div class="ui-section-card-copy">'+
          (title?'<div class="ui-section-card-title">'+escapeHtml(title)+'</div>':'')+
          (subtitle?'<div class="ui-section-card-subtitle">'+escapeHtml(subtitle)+'</div>':'')+
        '</div>'+
        (actions?'<div class="ui-section-card-actions">'+toMarkup(actions)+'</div>':'')+
      '</div>':'')+
      '<div class="ui-section-card-body '+escapeHtml(bodyClass)+'">'+toMarkup(content)+'</div>'+
    '</div>';
  }

  function createSectionCard(options){
    const wrapper=document.createElement('div');
    wrapper.innerHTML=createSectionCardMarkup(options);
    return wrapper.firstElementChild;
  }

  function createStatCardMarkup(options){
    const {
      label='',
      value='',
      subtext='',
      tone='default',
      accent=''
    }=options||{};
    const toneClass='ui-stat-card '+escapeHtml(tone||'default');
    const valueClass='ui-stat-card-value'+(tone==='positive'?' positive':tone==='warning'?' negative':'');
    const accentStyle=accent?' style="color:'+escapeHtml(accent)+'"':'';
    return '<div class="'+toneClass+'">'+
      (label?'<div class="ui-stat-card-label">'+escapeHtml(label)+'</div>':'')+
      '<div class="'+valueClass+'"'+accentStyle+'>'+escapeHtml(value)+'</div>'+
      (subtext?'<div class="ui-stat-card-subtext">'+escapeHtml(subtext)+'</div>':'')+
    '</div>';
  }

  function createStatCard(options){
    const wrapper=document.createElement('div');
    wrapper.innerHTML=createStatCardMarkup(options);
    return wrapper.firstElementChild;
  }

  const api={
    createSectionCardMarkup,
    createSectionCard,
    createStatCardMarkup,
    createStatCard
  };

  ui.cards=api;
})();
