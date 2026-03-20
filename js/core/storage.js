(function(){
  const root=window.BudgetLogCore=window.BudgetLogCore||{};

  const STORAGE_KEYS={
    entries:'bl_entries',
    goals:'bl_goals',
    recurring:'bl_recurring',
    savingsGoals:'bl_savings',
    customCategories:'bl_catcustom'
  };

  function createEmptyState(defaultGoals){
    return {
      entries:[],
      goals:{...defaultGoals},
      recurring:[],
      savingsGoals:[],
      customCategories:{}
    };
  }

  function normalizeState(rawState,{defaultGoals,sanitizeRecurringRule}){
    const fallback=createEmptyState(defaultGoals);
    const source=rawState||{};
    const mergedGoals=source.goals&&typeof source.goals==='object'
      ?{...defaultGoals,...source.goals}
      :{...fallback.goals};
    Object.keys(mergedGoals).forEach(k=>{
      const v=parseFloat(mergedGoals[k]);
      mergedGoals[k]=isFinite(v)&&v>=0?v:0;
    });
    return {
      entries:Array.isArray(source.entries)
        ?source.entries.map(e=>{const amt=parseFloat(e.amount);return{...e,amount:isFinite(amt)&&amt>=0?amt:0};})
        :[],
      goals:mergedGoals,
      recurring:Array.isArray(source.recurring)?source.recurring.map(sanitizeRecurringRule):[],
      savingsGoals:Array.isArray(source.savingsGoals)?source.savingsGoals.map(sg=>{
        const target=parseFloat(sg.target);
        return {
          id:typeof sg.id==='string'?sg.id:String(sg.id||''),
          name:typeof sg.name==='string'?sg.name.slice(0,200):'',
          target:isFinite(target)&&target>0?target:0,
          color:typeof sg.color==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(sg.color)?sg.color:'#3dd68c'
        };
      }):[],
      customCategories:(()=>{
        const src=source.customCategories&&typeof source.customCategories==='object'?source.customCategories:{};
        const out={};
        Object.entries(src).forEach(([id,v])=>{
          if(!v||typeof v!=='object')return;
          out[id]={
            label:typeof v.label==='string'?v.label.slice(0,100):'',
            color:typeof v.color==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(v.color)?v.color:'#5b8af0',
            ...(v.isCustom?{isCustom:true}:{})
          };
        });
        return out;
      })()
    };
  }

  function readLocalState({storage=window.localStorage,defaultGoals,sanitizeRecurringRule}){
    return normalizeState({
      entries:JSON.parse(storage.getItem(STORAGE_KEYS.entries)||'[]'),
      goals:JSON.parse(storage.getItem(STORAGE_KEYS.goals)||'null'),
      recurring:JSON.parse(storage.getItem(STORAGE_KEYS.recurring)||'[]'),
      savingsGoals:JSON.parse(storage.getItem(STORAGE_KEYS.savingsGoals)||'[]'),
      customCategories:JSON.parse(storage.getItem(STORAGE_KEYS.customCategories)||'{}')
    },{defaultGoals,sanitizeRecurringRule});
  }

  function writeLocalState(state,{storage=window.localStorage}={}){
    storage.setItem(STORAGE_KEYS.entries,JSON.stringify(state.entries));
    storage.setItem(STORAGE_KEYS.goals,JSON.stringify(state.goals));
    storage.setItem(STORAGE_KEYS.recurring,JSON.stringify(state.recurring));
    storage.setItem(STORAGE_KEYS.savingsGoals,JSON.stringify(state.savingsGoals));
    storage.setItem(STORAGE_KEYS.customCategories,JSON.stringify(state.customCategories));
  }

  function hasAnyEntries(state){
    return Array.isArray(state.entries)&&state.entries.length>0;
  }

  function serializeCloudState(state){
    return {
      entries:state.entries,
      goals:state.goals,
      recurring:state.recurring,
      savingsGoals:state.savingsGoals,
      customCategories:state.customCategories
    };
  }

  root.storage={
    STORAGE_KEYS,
    createEmptyState,
    normalizeState,
    readLocalState,
    writeLocalState,
    hasAnyEntries,
    serializeCloudState
  };
})();
