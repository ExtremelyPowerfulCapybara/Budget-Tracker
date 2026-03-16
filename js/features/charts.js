(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};

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
      const activeStyle=active?'border-color:'+catColors[category.id]+';color:'+catColors[category.id]:'';
      return `<button class="cat-sel-btn${active?' active':''}" data-cat-id="${category.id}" style="${activeStyle}">${category.label}</button>`;
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
    if(!cats.length)return;
    canvas.height=Math.max(180,cats.length*44);
    instances.catChart=new Chart(canvas,{
      type:'bar',
      data:{
        labels:cats.map(category=>category.label),
        datasets:[
          {label:'Real',data:cats.map(category=>category.actual),backgroundColor:cats.map(category=>category.color+'cc'),borderColor:cats.map(category=>category.color),borderWidth:1,borderRadius:6},
          {label:'Meta',data:cats.map(category=>category.goal),backgroundColor:'#2a2d3888',borderColor:'#2a2d38',borderWidth:1,borderRadius:6}
        ]
      },
      options:{
        ...CHART_DEFAULTS,
        indexAxis:'y',
        plugins:{...CHART_DEFAULTS.plugins,legend:{display:true,position:'top',labels:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},boxWidth:12}}},
        scales:{x:CHART_DEFAULTS.scales.x,y:{grid:{display:false},ticks:{color:'#f0f0f5',font:{family:'Lexend',size:11,weight:'600'}}}}
      }
    });
  }

  function renderTrendChart(options){
    const {Chart,instances,canvas,entries,entryMonth,viewYear,viewMonth,monthKey,monthNames}=options;
    destroyChart(instances,'trendChart');
    const months=getLastMonths(viewYear,viewMonth,monthKey,6);
    const incomeData=months.map(currentMonthKey=>sumAmounts(entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='income')));
    const expenseData=months.map(currentMonthKey=>sumAmounts(entries.filter(entry=>entryMonth(entry)===currentMonthKey&&entry.type==='expense')));
    const labels=months.map(currentMonthKey=>{
      const [year,month]=currentMonthKey.split('-');
      return monthNames[parseInt(month,10)-1].slice(0,3)+' '+year.slice(2);
    });
    instances.trendChart=new Chart(canvas,{
      type:'bar',
      data:{labels,datasets:[
        {label:'Ingresos',data:incomeData,backgroundColor:'#3dd68c55',borderColor:'#3dd68c',borderWidth:1.5,borderRadius:6},
        {label:'Gastos',data:expenseData,backgroundColor:'#f05b5b55',borderColor:'#f05b5b',borderWidth:1.5,borderRadius:6}
      ]},
      options:{...CHART_DEFAULTS,plugins:{...CHART_DEFAULTS.plugins,legend:{display:true,position:'top',labels:{color:'#6b6f80',font:{family:'Lexend Mono',size:10},boxWidth:12}}}}
    });
  }

  function renderNetChart(options){
    const {Chart,instances,canvas,entries,entryMonth,viewYear,viewMonth,monthKey,monthNames}=options;
    destroyChart(instances,'netChart');
    const months=getLastMonths(viewYear,viewMonth,monthKey,6);
    const netData=months.map(currentMonthKey=>{
      const monthEntries=entries.filter(entry=>entryMonth(entry)===currentMonthKey);
      return sumAmounts(monthEntries.filter(entry=>entry.type==='income'))-sumAmounts(monthEntries.filter(entry=>entry.type==='expense'));
    });
    const labels=months.map(currentMonthKey=>{
      const [year,month]=currentMonthKey.split('-');
      return monthNames[parseInt(month,10)-1].slice(0,3)+' '+year.slice(2);
    });
    const colors=netData.map(value=>value>=0?'#3dd68c':'#f05b5b');
    instances.netChart=new Chart(canvas,{
      type:'bar',
      data:{labels,datasets:[{label:'Saldo neto',data:netData,backgroundColor:colors.map(color=>color+'88'),borderColor:colors,borderWidth:1.5,borderRadius:6}]},
      options:{...CHART_DEFAULTS}
    });
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
    if(!cats.length)return;
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
  }

  root.charting={
    destroyChart,
    getLastMonths,
    buildCategorySelectorMarkup,
    renderCategoryBarChart,
    renderTrendChart,
    renderNetChart,
    renderCategoryLineChart,
    renderPieChart
  };
})();
