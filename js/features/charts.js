(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};
  const esc=window.BudgetLogCore.utils.esc;

  const CHART_DEFAULTS={
    responsive:true,
    maintainAspectRatio:true,
    plugins:{
      legend:{display:false},
      tooltip:{
        backgroundColor:'#1e2029',
        borderColor:'#2a2d38',
        borderWidth:1,
        titleColor:'#f0f0f5',
        bodyColor:'#6b6f80',
        titleFont:{family:'Lexend',weight:'700'},
        bodyFont:{family:'Lexend Mono'},
        callbacks:{
          label:ctx=>' $'+Math.abs(ctx.raw).toLocaleString('es-MX',{minimumFractionDigits:2})
        }
      }
    },
    scales:{
      x:{grid:{color:'#2a2d38'},ticks:{color:'#6b6f80',font:{family:'Lexend Mono',size:10}}},
      y:{grid:{color:'#2a2d38'},ticks:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},callback:v=>'$'+(v>=1000?(v/1000).toFixed(0)+'k':v)}}
    }
  };

  function sumAmounts(list){
    return list.reduce((sum,item)=>sum+item.amount,0);
  }

  function destroyChart(instances,id){
    if(instances[id]){
      instances[id].destroy();
      delete instances[id];
    }
  }

  function getLastMonths(viewYear,viewMonth,monthKey,count){
    const months=[];
    let year=viewYear;
    let month=viewMonth;
    for(let i=0;i<count;i++){
      months.unshift(monthKey(year,month));
      month--;
      if(month<0){
        month=11;
        year--;
      }
    }
    return months;
  }

  function buildCategorySelectorMarkup(categories,selectedCategoryId,catColors){
    return categories.map(category=>{
      const active=selectedCategoryId===category.id;
      const activeStyle=active?'border-color:'+esc(catColors[category.id])+';color:'+esc(catColors[category.id]):'';
      return `<button class="cat-sel-btn${active?' active':''}" data-cat-id="${esc(category.id)}" style="${activeStyle}">${esc(category.label)}</button>`;
    }).join('');
  }

  function renderCategoryBarChart(options){
    const {Chart,instances,canvas,titleEl,entries,viewYear,viewMonth,monthKey,entryMonth,categories,goals,monthNames,catColors}=options;
    destroyChart(instances,'catChart');
    const currentMonthKey=monthKey(viewYear,viewMonth);
    const monthEntries=entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='expense');
    titleEl.textContent='Gastos por categoría — '+monthNames[viewMonth]+' '+viewYear;
    const cats=categories.map(category=>({
      label:category.label,
      id:category.id,
      actual:sumAmounts(monthEntries.filter(entry=>entry.category===category.id)),
      goal:goals[category.id]||0,
      color:catColors[category.id]
    })).filter(category=>category.actual>0||category.goal>0);
    if(!cats.length)return false;
    canvas.height=Math.max(180,cats.length*44);
    instances.catChart=new Chart(canvas,{
      type:'bar',
      data:{
        labels:cats.map(category=>category.label),
        datasets:[
          {label:'Real',data:cats.map(category=>category.actual),backgroundColor:cats.map(category=>category.color+'cc'),borderColor:cats.map(category=>category.color),borderWidth:1,borderRadius:6},
          {label:'Meta',data:cats.map(category=>category.goal),backgroundColor:'#f0d45b33',borderColor:'#f0d45b',borderWidth:1.5,borderRadius:6}
        ]
      },
      options:{
        ...CHART_DEFAULTS,
        indexAxis:'y',
        plugins:{...CHART_DEFAULTS.plugins,legend:{display:true,position:'top',labels:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},boxWidth:12}}},
        scales:{x:CHART_DEFAULTS.scales.x,y:{grid:{display:false},ticks:{color:'#f0f0f5',font:{family:'Lexend',size:11,weight:'600'}}}}
      }
    });
    return true;
  }

  function renderTrendChart(options){
    const {Chart,instances,canvas,entries,entryMonth,viewYear,viewMonth,monthKey,monthNames,rangeMonths=6}=options;
    destroyChart(instances,'trendChart');
    const months=getLastMonths(viewYear,viewMonth,monthKey,rangeMonths);
    const incomeData=months.map(currentMonthKey=>sumAmounts(entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='income')));
    const expenseData=months.map(currentMonthKey=>sumAmounts(entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='expense')));
    const labels=months.map(currentMonthKey=>{
      const [year,month]=currentMonthKey.split('-');
      return monthNames[parseInt(month,10)-1].slice(0,3)+' '+year.slice(2);
    });
    if(incomeData.every(value=>value===0)&&expenseData.every(value=>value===0))return false;
    instances.trendChart=new Chart(canvas,{
      type:'bar',
      data:{labels,datasets:[
        {label:'Ingresos',data:incomeData,backgroundColor:'#3dd68c55',borderColor:'#3dd68c',borderWidth:1.5,borderRadius:6},
        {label:'Gastos',data:expenseData,backgroundColor:'#f05b5b55',borderColor:'#f05b5b',borderWidth:1.5,borderRadius:6}
      ]},
      options:{...CHART_DEFAULTS,plugins:{...CHART_DEFAULTS.plugins,legend:{display:true,position:'top',labels:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},boxWidth:12}}}}
    });
    return true;
  }

  function renderNetChart(options){
    const {Chart,instances,canvas,entries,entryMonth,viewYear,viewMonth,monthKey,monthNames,rangeMonths=6}=options;
    destroyChart(instances,'netChart');
    const months=getLastMonths(viewYear,viewMonth,monthKey,rangeMonths);
    const netData=months.map(currentMonthKey=>{
      const monthEntries=entries.filter(entry=>entryMonth(entry)===currentMonthKey);
      return sumAmounts(monthEntries.filter(entry=>entry.type==='income'))-sumAmounts(monthEntries.filter(entry=>entry.type==='expense'));
    });
    const labels=months.map(currentMonthKey=>{
      const [year,month]=currentMonthKey.split('-');
      return monthNames[parseInt(month,10)-1].slice(0,3)+' '+year.slice(2);
    });
    const colors=netData.map(value=>value>=0?'#3dd68c':'#f05b5b');
    if(netData.every(value=>value===0))return false;
    instances.netChart=new Chart(canvas,{
      type:'bar',
      data:{labels,datasets:[{label:'Saldo neto',data:netData,backgroundColor:colors.map(color=>color+'88'),borderColor:colors,borderWidth:1.5,borderRadius:6}]},
      options:{...CHART_DEFAULTS}
    });
    return true;
  }

  function renderCategoryLineChart(options){
    const {Chart,instances,canvas,entries,entryMonth,viewYear,viewMonth,monthKey,monthNames,selectedCategoryId,catColors,goals,categories}=options;
    destroyChart(instances,'catLineChart');
    const months=getLastMonths(viewYear,viewMonth,monthKey,6);
    const data=months.map(currentMonthKey=>sumAmounts(entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='expense'&&entry.category===selectedCategoryId)));
    const labels=months.map(currentMonthKey=>{
      const [year,month]=currentMonthKey.split('-');
      return monthNames[parseInt(month,10)-1].slice(0,3)+' '+year.slice(2);
    });
    const color=catColors[selectedCategoryId];
    const goalValue=goals[selectedCategoryId]||0;
    const categoryLabel=categories.find(category=>category.id===selectedCategoryId)?.label||selectedCategoryId;
    if(!goalValue&&data.every(value=>value===0))return false;
    instances.catLineChart=new Chart(canvas,{
      type:'line',
      data:{
        labels,
        datasets:[
          {label:categoryLabel,data,borderColor:color,backgroundColor:color+'22',borderWidth:2.5,pointRadius:5,pointBackgroundColor:color,tension:0.35,fill:true},
          ...(goalValue?[{label:'Meta',data:months.map(()=>goalValue),borderColor:'#f0d45b',borderDash:[5,4],borderWidth:2,pointRadius:0,tension:0}]:[])
        ]
      },
      options:{...CHART_DEFAULTS,plugins:{...CHART_DEFAULTS.plugins,legend:{display:true,position:'top',labels:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},boxWidth:12}}}}
    });
    return true;
  }

  function renderPieChart(options){
    const {Chart,instances,canvas,entries,entryMonth,viewYear,viewMonth,monthKey,categories,catColors}=options;
    destroyChart(instances,'pieChart');
    const currentMonthKey=monthKey(viewYear,viewMonth);
    const monthEntries=entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='expense');
    const cats=categories.map(category=>({
      label:category.label,
      color:catColors[category.id],
      total:sumAmounts(monthEntries.filter(entry=>entry.category===category.id))
    })).filter(category=>category.total>0).sort((a,b)=>b.total-a.total);
    if(!cats.length)return false;
    instances.pieChart=new Chart(canvas,{
      type:'doughnut',
      data:{labels:cats.map(category=>category.label),datasets:[{data:cats.map(category=>category.total),backgroundColor:cats.map(category=>category.color+'cc'),borderColor:cats.map(category=>category.color),borderWidth:1.5,hoverOffset:6}]},
      options:{
        responsive:true,
        maintainAspectRatio:true,
        cutout:'62%',
        plugins:{
          legend:{display:true,position:'bottom',labels:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},boxWidth:10,padding:12,usePointStyle:true}},
          tooltip:{
            backgroundColor:'#1e2029',
            borderColor:'#2a2d38',
            borderWidth:1,
            titleColor:'#f0f0f5',
            bodyColor:'#6b6f80',
            titleFont:{family:'Lexend',weight:'700'},
            bodyFont:{family:'Lexend Mono'},
            callbacks:{
              label:function(ctx){
                const total=ctx.dataset.data.reduce((acc,value)=>acc+value,0);
                const pct=total>0?((ctx.raw/total)*100).toFixed(1):'0';
                return ' $'+ctx.raw.toLocaleString('es-MX',{minimumFractionDigits:2})+' ('+pct+'%)';
              }
            }
          }
        }
      }
    });
    return true;
  }

  function renderSpendingDonut(options){
    const {Chart,instances,canvas,entries,entryMonth,viewYear,viewMonth,monthKey,categories,catColors,formatMoney}=options;
    destroyChart(instances,'spendingDonut');
    const currentMonthKey=monthKey(viewYear,viewMonth);
    const monthEntries=entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='expense');
    const cats=categories.map(category=>({
      label:category.label,
      color:catColors[category.id],
      total:sumAmounts(monthEntries.filter(entry=>entry.category===category.id))
    })).filter(category=>category.total>0).sort((a,b)=>b.total-a.total);
    if(!cats.length)return false;
    const grandTotal=cats.reduce((acc,category)=>acc+category.total,0);
    const centerTextPlugin={
      id:'spendingDonutCenter',
      afterDraw:function(chart){
        const {ctx,chartArea:{top,bottom,left,right}}=chart;
        const cx=(left+right)/2;
        const cy=(top+bottom)/2;
        ctx.save();
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillStyle='#6b6f80';
        ctx.font='600 10px Lexend';
        ctx.fillText('TOTAL',cx,cy-13);
        ctx.fillStyle='#f0f0f5';
        ctx.font='700 15px Lexend Mono';
        const formatted=formatMoney?formatMoney(grandTotal):('$'+grandTotal.toLocaleString('es-MX',{minimumFractionDigits:2}));
        ctx.fillText(formatted,cx,cy+6);
        ctx.restore();
      }
    };
    instances.spendingDonut=new Chart(canvas,{
      type:'doughnut',
      data:{
        labels:cats.map(category=>category.label),
        datasets:[{
          data:cats.map(category=>category.total),
          backgroundColor:cats.map(category=>category.color+'cc'),
          borderColor:cats.map(category=>category.color),
          borderWidth:1.5,
          hoverOffset:6
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:true,
        cutout:'68%',
        plugins:{
          legend:{
            display:true,
            position:'bottom',
            labels:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},boxWidth:10,padding:10,usePointStyle:true}
          },
          tooltip:{
            backgroundColor:'#1e2029',
            borderColor:'#2a2d38',
            borderWidth:1,
            titleColor:'#f0f0f5',
            bodyColor:'#6b6f80',
            titleFont:{family:'Lexend',weight:'700'},
            bodyFont:{family:'Lexend Mono'},
            callbacks:{
              label:function(ctx){
                const total=ctx.dataset.data.reduce((acc,value)=>acc+value,0);
                const pct=total>0?((ctx.raw/total)*100).toFixed(1):'0';
                const amount=formatMoney?formatMoney(ctx.raw):('$'+ctx.raw.toLocaleString('es-MX',{minimumFractionDigits:2}));
                return ' '+amount+' ('+pct+'%)';
              }
            }
          }
        }
      },
      plugins:[centerTextPlugin]
    });
    return true;
  }

  function renderSavingsProgress(options){
    const {Chart,instances,canvas,savingsGoals,entries,formatMoney}=options;
    destroyChart(instances,'savingsProgress');
    if(!savingsGoals||!savingsGoals.length)return false;
    const savingsEntries=entries.filter(entry=>entry.type==='expense'&&entry.category==='savings');
    function getGoalSaved(goalId){
      if(savingsGoals.length===1){
        return sumAmounts(savingsEntries.filter(entry=>!entry.goalId||entry.goalId===goalId));
      }
      return sumAmounts(savingsEntries.filter(entry=>entry.goalId===goalId));
    }
    const data=savingsGoals.map(goal=>{
      const saved=getGoalSaved(goal.id);
      const target=goal.target||0;
      const reached=saved>=target&&target>0;
      return {label:goal.name,saved,target,reached,color:goal.color||'#5b8af0'};
    });
    canvas.height=Math.max(120,data.length*52);
    instances.savingsProgress=new Chart(canvas,{
      type:'bar',
      data:{
        labels:data.map(goal=>goal.label),
        datasets:[
          {
            label:'Ahorrado',
            data:data.map(goal=>goal.saved),
            backgroundColor:data.map(goal=>goal.reached?'#3dd68c88':'#5b8af088'),
            borderColor:data.map(goal=>goal.reached?'#3dd68c':'#5b8af0'),
            borderWidth:1.5,
            borderRadius:6
          },
          {
            label:'Meta',
            data:data.map(goal=>goal.target),
            backgroundColor:'#f0d45b22',
            borderColor:'#f0d45b',
            borderWidth:1.5,
            borderRadius:6
          }
        ]
      },
      options:{
        ...CHART_DEFAULTS,
        indexAxis:'y',
        plugins:{
          ...CHART_DEFAULTS.plugins,
          legend:{display:true,position:'top',labels:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},boxWidth:12}},
          tooltip:{
            backgroundColor:'#1e2029',
            borderColor:'#2a2d38',
            borderWidth:1,
            titleColor:'#f0f0f5',
            bodyColor:'#6b6f80',
            titleFont:{family:'Lexend',weight:'700'},
            bodyFont:{family:'Lexend Mono'},
            callbacks:{
              label:function(ctx){
                const goal=data[ctx.dataIndex];
                if(ctx.datasetIndex===0){
                  const pct=goal.target>0?((goal.saved/goal.target)*100).toFixed(0):'—';
                  const amount=formatMoney?formatMoney(goal.saved):('$'+goal.saved.toLocaleString('es-MX',{minimumFractionDigits:2}));
                  return ' '+amount+' ('+pct+'% de la meta)';
                }
                const amount=formatMoney?formatMoney(goal.target):('$'+goal.target.toLocaleString('es-MX',{minimumFractionDigits:2}));
                return ' '+amount;
              }
            }
          }
        },
        scales:{
          x:{
            grid:{color:'#2a2d38'},
            ticks:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},callback:function(v){return '$'+(v>=1000?(v/1000).toFixed(0)+'k':v);}}
          },
          y:{
            grid:{display:false},
            ticks:{color:'#f0f0f5',font:{family:'Lexend',size:11,weight:'600'}}
          }
        }
      }
    });
    return true;
  }

  function renderAccountBarChart(options){
    const {Chart,instances,canvas,titleEl,entries,viewYear,viewMonth,monthKey,entryMonth,accounts,monthNames}=options;
    destroyChart(instances,'accountChart');
    const currentMonthKey=monthKey(viewYear,viewMonth);
    const monthEntries=entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='expense'&&entry.accountId);
    titleEl.textContent='Gastos por cuenta \u2014 '+monthNames[viewMonth]+' '+viewYear;
    const accs=accounts.map(acc=>({
      label:acc.label,
      id:acc.id,
      color:acc.color,
      total:sumAmounts(monthEntries.filter(entry=>entry.accountId===acc.id))
    })).filter(acc=>acc.total>0);
    if(!accs.length)return false;
    canvas.height=Math.max(120,accs.length*52);
    instances.accountChart=new Chart(canvas,{
      type:'bar',
      data:{
        labels:accs.map(acc=>acc.label),
        datasets:[{
          label:'Gasto',
          data:accs.map(acc=>acc.total),
          backgroundColor:accs.map(acc=>acc.color+'cc'),
          borderColor:accs.map(acc=>acc.color),
          borderWidth:1,
          borderRadius:6
        }]
      },
      options:{
        ...CHART_DEFAULTS,
        indexAxis:'y',
        scales:{
          x:CHART_DEFAULTS.scales.x,
          y:{grid:{display:false},ticks:{color:'#f0f0f5',font:{family:'Lexend',size:11,weight:'600'}}}
        }
      }
    });
    return true;
  }

  root.charting={
    destroyChart,
    getLastMonths,
    buildCategorySelectorMarkup,
    renderCategoryBarChart,
    renderTrendChart,
    renderNetChart,
    renderCategoryLineChart,
    renderPieChart,
    renderSpendingDonut,
    renderSavingsProgress,
    renderAccountBarChart
  };
})();
