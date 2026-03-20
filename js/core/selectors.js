(function(){
  const root=window.BudgetLogCore=window.BudgetLogCore||{};
  const utils=root.utils;

  function getMonthEntriesByKey(entries,mk){
    return entries.filter(entry=>utils.entryMonth(entry)===mk);
  }

  function getMonthTotals(entries,mk){
    const monthEntries=getMonthEntriesByKey(entries,mk);
    const income=utils.sumAmounts(monthEntries.filter(entry=>entry.type==='income'));
    const expense=utils.sumAmounts(monthEntries.filter(entry=>entry.type==='expense'));
    return {monthEntries,income,expense,net:income-expense};
  }

  function sanitizeRecurringRule(rule){
    const sanitized={...rule};
    const amt=parseFloat(sanitized.amount);
    sanitized.amount=isFinite(amt)&&amt>0?amt:0;
    if(sanitized.type!=='income'&&sanitized.type!=='expense')sanitized.type='expense';
    if(!['monthly','biweekly','weekly'].includes(sanitized.frequency))sanitized.frequency='monthly';
    const day=parseInt(sanitized.day,10);
    sanitized.day=Number.isInteger(day)&&day>=1&&day<=31?day:1;
    const today=utils.toISODate(new Date());
    if(!sanitized.anchorDate){
      if(sanitized.frequency==='monthly'&&sanitized.day){
        const date=new Date();
        sanitized.anchorDate=date.getFullYear()+'-'+utils.pad2(date.getMonth()+1)+'-'+utils.pad2(Math.min(sanitized.day,utils.daysInMonth(date.getFullYear(),date.getMonth())));
      }else{
        sanitized.anchorDate=sanitized.createdAt||today;
      }
    }
    if(!sanitized.day){
      const anchor=utils.parseISODate(sanitized.anchorDate);
      sanitized.day=anchor?anchor.getDate():1;
    }
    if(!sanitized.createdAt)sanitized.createdAt=sanitized.anchorDate||today;
    return sanitized;
  }

  function getRecurringIntervalDays(rule){
    if(rule.frequency==='weekly')return 7;
    if(rule.frequency==='biweekly')return 14;
    return null;
  }

  function getRecurringOccurrenceDates(rule,year,monthIndex){
    const normalized=sanitizeRecurringRule(rule);
    const monthPrefix=utils.monthKey(year,monthIndex);
    if(normalized.frequency==='monthly'){
      const day=Math.min(normalized.day||1,utils.daysInMonth(year,monthIndex));
      return [year+'-'+utils.pad2(monthIndex+1)+'-'+utils.pad2(day)];
    }
    const interval=getRecurringIntervalDays(normalized);
    const anchorDate=normalized.anchorDate;
    if(!interval||!anchorDate)return [];
    let cursor=anchorDate;
    while(cursor.slice(0,7)<monthPrefix){
      const nextCursor=utils.addDays(cursor,interval);
      if(!nextCursor)break;
      cursor=nextCursor;
    }
    const dates=[];
    while(cursor&&cursor.slice(0,7)===monthPrefix){
      dates.push(cursor);
      cursor=utils.addDays(cursor,interval);
    }
    return dates;
  }

  function hasGeneratedRecurringEntry(entries,ruleId,date){
    return entries.some(entry=>entry.recurringId===ruleId&&entry.recurringDate===date);
  }

  function createRecurringEntry(rule,date){
    return {
      id:'recur_'+rule.id+'_'+date,
      type:rule.type,
      amount:rule.amount,
      description:rule.description,
      category:rule.category,
      date,
      recurringId:rule.id,
      recurringDate:date,
      goalId:rule.goalId||null
    };
  }

  function getPendingRecurringDates(entries,rule,year,monthIndex,cutoffDate){
    return getRecurringOccurrenceDates(rule,year,monthIndex).filter(date=>{
      return !hasGeneratedRecurringEntry(entries,rule.id,date)&&(!cutoffDate||utils.datesEqualOrBefore(date,cutoffDate));
    });
  }

  function getApplyCutoffForMonth(year,monthIndex){
    const today=new Date();
    const relation=utils.compareMonthRefs(year,monthIndex,today.getFullYear(),today.getMonth());
    if(relation>0)return '';
    if(relation===0)return utils.toISODate(today);
    return null;
  }

  function applyRecurringForMonth(entries,recurring,year,monthIndex,cutoffDate){
    const nextEntries=[...entries];
    let count=0;
    const nextRecurring=recurring.map(rule=>{
      const normalized=sanitizeRecurringRule(rule);
      const pendingDates=getPendingRecurringDates(nextEntries,normalized,year,monthIndex,cutoffDate);
      pendingDates.forEach(date=>{
        nextEntries.unshift(createRecurringEntry(normalized,date));
        count++;
      });
      if(pendingDates.length){
        normalized.lastApplied=utils.monthKey(year,monthIndex);
      }
      return normalized;
    });
    return {entries:nextEntries,recurring:nextRecurring,count};
  }

  function getForecastTotals(recurring,year,monthIndex){
    return recurring.reduce((totals,rule)=>{
      const normalized=sanitizeRecurringRule(rule);
      const amount=normalized.amount*getRecurringOccurrenceDates(normalized,year,monthIndex).length;
      if(normalized.type==='income')totals.income+=amount;
      else totals.expense+=amount;
      return totals;
    },{income:0,expense:0});
  }

  function getGoalSavedAmount(entries,savingsGoals,goalId){
    const savingsEntries=entries.filter(entry=>entry.type==='expense'&&entry.category==='savings');
    if(goalId){
      return utils.sumAmounts(savingsEntries.filter(entry=>entry.goalId===goalId));
    }
    if(savingsGoals.length===1){
      return utils.sumAmounts(savingsEntries.filter(entry=>!entry.goalId||entry.goalId===savingsGoals[0].id));
    }
    return 0;
  }

  function getUnassignedSavingsAmount(entries,savingsGoals){
    if(savingsGoals.length<=1)return 0;
    return utils.sumAmounts(entries.filter(entry=>entry.type==='expense'&&entry.category==='savings'&&!entry.goalId));
  }

  function getRolloverGoal(entries,goals,categoryId,year,monthIndex){
    const currentGoal=goals[categoryId]||0;
    if(!currentGoal)return currentGoal;
    const prevMonth=monthIndex===0?11:monthIndex-1;
    const prevYear=monthIndex===0?year-1:year;
    const prevMk=utils.monthKey(prevYear,prevMonth);
    const prevSpent=getMonthEntriesByKey(entries,prevMk)
      .filter(e=>e.type==='expense'&&e.category===categoryId)
      .reduce((sum,e)=>sum+e.amount,0);
    const surplus=Math.max(0,currentGoal-prevSpent);
    return currentGoal+surplus;
  }

  root.selectors={
    getMonthEntriesByKey,
    getMonthTotals,
    sanitizeRecurringRule,
    getRecurringOccurrenceDates,
    getPendingRecurringDates,
    getApplyCutoffForMonth,
    applyRecurringForMonth,
    getForecastTotals,
    getGoalSavedAmount,
    getUnassignedSavingsAmount,
    getRolloverGoal
  };
})();
