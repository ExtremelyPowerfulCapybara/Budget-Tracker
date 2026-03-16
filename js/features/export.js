(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};

  function sumAmounts(list){
    return list.reduce((sum,item)=>sum+item.amount,0);
  }

  function exportBudgetData(options){
    const {
      XLSX,
      entries,
      monthEntries,
      categories,
      savingsGoals,
      goals,
      entryMonth,
      exportScope,
      monthKey,
      fallbackMonthKey,
      filenamePrefix='BudgetLog'
    }=options;

    const wb=XLSX.utils.book_new();
    const catMap=Object.fromEntries(categories.map(category=>[category.id,category.label]));
    const goalMap=Object.fromEntries(savingsGoals.map(goal=>[goal.id,goal.name]));

    const entriesData=[
      ['Fecha','Tipo','Descripción','Categoría','Meta de ahorro','Monto (MXN)'],
      ...[...entries].sort((a,b)=>a.date.localeCompare(b.date)).map(entry=>[
        entry.date,
        entry.type==='income'?'Ingreso':'Gasto',
        entry.description,
        entry.type==='income'?'Ingreso':(catMap[entry.category]||entry.category),
        goalMap[entry.goalId]||'',
        entry.type==='income'?entry.amount:-entry.amount
      ])
    ];
    const ws1=XLSX.utils.aoa_to_sheet(entriesData);
    ws1['!cols']=[{wch:12},{wch:10},{wch:32},{wch:18},{wch:22},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws1,'Movimientos');

    const months=[...new Set(entries.map(entry=>entryMonth(entry)))].sort();
    const summaryData=[
      ['Mes','Ingresos','Gastos','Saldo neto','Tasa de ahorro %'],
      ...months.map(currentMonthKey=>{
        const monthSet=entries.filter(entry=>entryMonth(entry)===currentMonthKey);
        const income=sumAmounts(monthSet.filter(entry=>entry.type==='income'));
        const expense=sumAmounts(monthSet.filter(entry=>entry.type==='expense'));
        const net=income-expense;
        return [currentMonthKey,income,expense,net,income>0?parseFloat(((net/income)*100).toFixed(2)):0];
      })
    ];
    const ws2=XLSX.utils.aoa_to_sheet(summaryData);
    ws2['!cols']=[{wch:10},{wch:14},{wch:14},{wch:14},{wch:18}];
    XLSX.utils.book_append_sheet(wb,ws2,'Resumen');

    const categoryMonths=[...new Set(entries.filter(entry=>entry.type==='expense').map(entry=>entryMonth(entry)))].sort();
    const catHeader=['Categoría',...categoryMonths,'TOTAL'];
    const catRows=categories.map(category=>{
      const values=categoryMonths.map(currentMonthKey=>{
        return sumAmounts(entries.filter(entry=>entry.type==='expense'&&entry.category===category.id&&entryMonth(entry)===currentMonthKey));
      });
      return [category.label,...values,values.reduce((acc,value)=>acc+value,0)];
    });
    const totalsRow=['TOTAL',...categoryMonths.map(currentMonthKey=>{
      return sumAmounts(entries.filter(entry=>entry.type==='expense'&&entryMonth(entry)===currentMonthKey));
    })];
    totalsRow.push(totalsRow.slice(1).reduce((acc,value)=>acc+value,0));
    const ws3=XLSX.utils.aoa_to_sheet([catHeader,...catRows,totalsRow]);
    ws3['!cols']=[{wch:18},...categoryMonths.map(()=>({wch:12})),{wch:12}];
    XLSX.utils.book_append_sheet(wb,ws3,'Por categoría');

    const goalMonthKey=exportScope==='month'?monthKey:(months[months.length-1]||fallbackMonthKey);
    const monthForGoals=monthEntries.filter(entry=>entryMonth(entry)===goalMonthKey);
    const incomeActual=sumAmounts(monthForGoals.filter(entry=>entry.type==='income'));
    const goalsData=[
      ['Categoría','Meta MXN','Real MXN','Diferencia','% Cumplimiento'],
      ['Ingresos',goals.income||0,incomeActual,incomeActual-(goals.income||0),goals.income>0?parseFloat(((incomeActual/goals.income)*100).toFixed(1)):'-'],
      ...categories.map(category=>{
        const actual=sumAmounts(monthForGoals.filter(entry=>entry.type==='expense'&&entry.category===category.id));
        const goalValue=goals[category.id]||0;
        return [category.label,goalValue,actual,goalValue-actual,goalValue>0?parseFloat(((actual/goalValue)*100).toFixed(1)):'-'];
      })
    ];
    const ws4=XLSX.utils.aoa_to_sheet(goalsData);
    ws4['!cols']=[{wch:18},{wch:12},{wch:12},{wch:14},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws4,'Metas');

    const fileName=filenamePrefix+'_'+(exportScope==='month'?monthKey:'Historial')+'_'+new Date().toISOString().slice(0,10)+'.xlsx';
    XLSX.writeFile(wb,fileName);
    return fileName;
  }

  root.exporting={
    exportBudgetData
  };
})();
