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
    return '<div class="entry-item" data-id="'+esc(entry.id)+'" ontouchstart="swipeStart(event,this)" ontouchmove="swipeMove(event,this)" ontouchend="swipeEnd(event,this)"><div class="entry-delete-bg">\uD83D\uDDD1</div><div class="entry-swipe-inner"><div class="entry-dot" style="background:'+esc(color)+'"></div><div class="entry-info"><div class="entry-desc">'+esc(entry.description)+'</div><div class="entry-meta">'+entry.date+' \u00b7 '+esc(categoryLabel)+esc(goalLabel)+'</div></div><div class="entry-amount '+entry.type+'">'+(entry.type==='income'?'+':'-')+formatMoney(entry.amount)+'</div><div class="entry-actions"><button class="entry-btn" data-entry-action="edit" data-entry-id="'+esc(entry.id)+'">&#9998;</button><button class="entry-btn delete" data-entry-action="delete" data-entry-id="'+esc(entry.id)+'">&#10005;</button></div></div></div>';
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
