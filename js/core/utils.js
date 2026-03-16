(function(){
  const root=window.BudgetLogCore=window.BudgetLogCore||{};

  function sumAmounts(list){
    return list.reduce((sum,item)=>sum+item.amount,0);
  }

  function pad2(n){
    return String(n).padStart(2,'0');
  }

  function toISODate(date){
    return date.getFullYear()+'-'+pad2(date.getMonth()+1)+'-'+pad2(date.getDate());
  }

  function parseISODate(value){
    if(!value)return null;
    const parts=value.split('-').map(Number);
    if(parts.length!==3||parts.some(Number.isNaN))return null;
    return new Date(parts[0],parts[1]-1,parts[2]);
  }

  function addDays(value,days){
    const date=parseISODate(value);
    if(!date)return null;
    date.setDate(date.getDate()+days);
    return toISODate(date);
  }

  function datesEqualOrBefore(a,b){
    return a.localeCompare(b)<=0;
  }

  function daysInMonth(year,monthIndex){
    return new Date(year,monthIndex+1,0).getDate();
  }

  function monthKey(year,monthIndex){
    return year+'-'+pad2(monthIndex+1);
  }

  function entryMonth(entry){
    return entry.date.slice(0,7);
  }

  function compareMonthRefs(yearA,monthA,yearB,monthB){
    const a=yearA*12+monthA;
    const b=yearB*12+monthB;
    return a===b?0:(a<b?-1:1);
  }

  const MXN=n=>'$'+Math.abs(n).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});

  root.utils={
    MXN,
    sumAmounts,
    pad2,
    toISODate,
    parseISODate,
    addDays,
    datesEqualOrBefore,
    daysInMonth,
    monthKey,
    entryMonth,
    compareMonthRefs
  };
})();
