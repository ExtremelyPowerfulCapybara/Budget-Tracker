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
    return {
      entries:Array.isArray(source.entries)?source.entries:[],
      goals:source.goals&&typeof source.goals==='object'?{...defaultGoals,...source.goals}:{...fallback.goals},
      recurring:Array.isArray(source.recurring)?source.recurring.map(sanitizeRecurringRule):[],
      savingsGoals:Array.isArray(source.savingsGoals)?source.savingsGoals:[],
      customCategories:source.customCategories&&typeof source.customCategories==='object'?source.customCategories:{}
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
