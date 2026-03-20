(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};
  const esc=window.BudgetLogCore.utils.esc;

  function buildEntryFilters(categories,activeFilter){
    const filters=[
      {id:'all',label:'Todos'},
      {id:'income',label:'Ingresos'},
      {id:'expense',label:'Gastos'},
      ...categories.map(category=>({id:category.id,label:category.label}))
    ];
    return filters.map(filter=>{
      return '<button class="filter-chip'+(activeFilter===filter.id?' active':'')+'" data-filter-id="'+filter.id+'">'+esc(filter.label)+'</button>';
    }).join('');
  }

  function renderEntryMarkup(entry,options){
    const {categories,savingsGoals,formatMoney}=options;
    const category=categories.find(item=>item.id===entry.category);
    const goal=savingsGoals.find(item=>item.id===entry.goalId);
    const color=entry.type==='income'?'var(--income)':(category?category.color:'var(--muted)');
    const categoryLabel=entry.type==='income'?'Ingreso':(category?category.label:'');
    const goalLabel=goal?' \u00b7 '+goal.name:'';
    const typeBadgeClass=entry.type==='income'?'entry-detail-badge income':'entry-detail-badge expense';
    const typeBadgeText=entry.type==='income'?'Ingreso':'Gasto';
    const detailRows=
      '<div class="entry-detail-row"><span class="entry-detail-label">Descripci\u00f3n</span><span class="entry-detail-value">'+esc(entry.description)+'</span></div>'+
      (entry.notes?'<div class="entry-detail-row"><span class="entry-detail-label">Notas</span><span class="entry-detail-value entry-detail-notes">'+esc(entry.notes)+'</span></div>':'')+
      '<div class="entry-detail-row"><span class="entry-detail-label">Categor\u00eda</span><span class="entry-detail-value"><span class="entry-detail-dot" style="background:'+esc(color)+'"></span>'+esc(categoryLabel)+'</span></div>'+
      '<div class="entry-detail-row"><span class="entry-detail-label">Fecha</span><span class="entry-detail-value entry-detail-mono">'+esc(entry.date)+'</span></div>'+
      '<div class="entry-detail-row"><span class="entry-detail-label">Tipo</span><span class="'+typeBadgeClass+'">'+typeBadgeText+'</span></div>'+
      (entry.recurringId?'<div class="entry-detail-row"><span class="entry-detail-label">Recurrencia</span><span class="entry-detail-badge recurrent">Recurrente</span></div>':'')+
      (goal?'<div class="entry-detail-row"><span class="entry-detail-label">Meta</span><span class="entry-detail-value">'+esc(goal.name)+'</span></div>':'')+
      '<div class="entry-detail-actions"><button class="entry-detail-action-btn edit" data-entry-action="edit" data-entry-id="'+esc(entry.id)+'" aria-label="Editar movimiento">&#9998; Editar</button><button class="entry-detail-action-btn delete" data-entry-action="delete" data-entry-id="'+esc(entry.id)+'" aria-label="Eliminar movimiento">&#10005; Eliminar</button></div>';
    const safeType=(entry.type==='income'||entry.type==='expense')?entry.type:'expense';
    return '<div class="entry-item" data-id="'+esc(entry.id)+'" ontouchstart="swipeStart(event,this)" ontouchmove="swipeMove(event,this)" ontouchend="swipeEnd(event,this)"><div class="entry-edit-bg">&#9998;</div><div class="entry-delete-bg">\uD83D\uDDD1</div><div class="entry-swipe-inner"><div class="entry-compact"><div class="entry-dot" style="background:'+esc(color)+'"></div><div class="entry-info"><div class="entry-desc">'+esc(entry.description)+'</div><div class="entry-meta">'+esc(entry.date)+' \u00b7 '+esc(categoryLabel)+esc(goalLabel)+'</div>'+(entry.notes?'<div class="entry-notes">'+esc(entry.notes)+'</div>':'')+'</div><div class="entry-amount '+safeType+'">'+(safeType==='income'?'+':'-')+formatMoney(entry.amount)+'</div><div class="entry-actions"><button class="entry-btn" data-entry-action="edit" data-entry-id="'+esc(entry.id)+'" aria-label="Editar movimiento">&#9998;</button><button class="entry-btn delete" data-entry-action="delete" data-entry-id="'+esc(entry.id)+'" aria-label="Eliminar movimiento">&#10005;</button></div></div><div class="entry-detail">'+detailRows+'</div></div></div>';
  }

  function filterEntries(entries,options){
    const {activeFilter,searchQuery,categories,formatMoney}=options;
    let filtered=entries;
    if(activeFilter==='income')filtered=entries.filter(entry=>entry.type==='income');
    else if(activeFilter==='expense')filtered=entries.filter(entry=>entry.type==='expense');
    else if(activeFilter!=='all')filtered=entries.filter(entry=>entry.category===activeFilter);

    if(!searchQuery)return filtered;
    return filtered.filter(entry=>{
      const categoryLabel=(categories.find(category=>category.id===entry.category)?.label||'').toLowerCase();
      return entry.description.toLowerCase().includes(searchQuery)||formatMoney(entry.amount).includes(searchQuery)||categoryLabel.includes(searchQuery);
    });
  }

  function renderEntriesListMarkup(entries,renderEntry){
    if(!entries.length){
      return '';
    }
    return [...entries].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(renderEntry).join('');
  }

  root.entriesFeature={
    buildEntryFilters,
    renderEntryMarkup,
    filterEntries,
    renderEntriesListMarkup
  };
})();
