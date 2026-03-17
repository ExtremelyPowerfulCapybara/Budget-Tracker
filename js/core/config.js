(function(){
  const root=window.BudgetLogCore=window.BudgetLogCore||{};

  root.config={
    firebaseConfig:{
      apiKey:"AIzaSyBL5BbVbQLkDe8Gr74yz1Rq6J9cxF-t3pY",
      authDomain:"budgetlog-b318d.firebaseapp.com",
      projectId:"budgetlog-b318d",
      storageBucket:"budgetlog-b318d.firebasestorage.app",
      messagingSenderId:"646922985575",
      appId:"1:646922985575:web:0a3808229d0e1bb1a3b4c2"
    },
    CATEGORIES:[
      {id:'food',label:'Alimentos',color:'#5bcff0'},
      {id:'restaurant',label:'Restaurantes',color:'#f0a25b'},
      {id:'transport',label:'Transporte',color:'#7dd67a'},
      {id:'uber',label:'Uber/Rappi',color:'#a0e86e'},
      {id:'utilities',label:'Servicios',color:'#a78bfa'},
      {id:'shopping',label:'Compras',color:'#f097c4'},
      {id:'health',label:'Salud',color:'#f05b7a'},
      {id:'entertainment',label:'Entretenimiento',color:'#f0d45b'},
      {id:'clothing',label:'Ropa',color:'#c49bfa'},
      {id:'savings',label:'Ahorro',color:'#f0c45b'}
    ],
    FREQUENCIES:[
      {id:'monthly',label:'Mensual'},
      {id:'biweekly',label:'Quincenal'},
      {id:'weekly',label:'Semanal'}
    ],
    DEFAULT_GOALS:{
      food:4000,
      restaurant:2000,
      transport:1500,
      uber:800,
      utilities:2500,
      shopping:1500,
      health:500,
      entertainment:800,
      clothing:600,
      savings:2000,
      income:20000
    },
    MONTH_NAMES:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    CAT_COLORS:{
      food:'#5bcff0',
      restaurant:'#f0a25b',
      transport:'#7dd67a',
      uber:'#a0e86e',
      utilities:'#a78bfa',
      shopping:'#f097c4',
      health:'#f05b7a',
      entertainment:'#f0d45b',
      clothing:'#c49bfa',
      savings:'#f0c45b'
    },
    PALETTE:[
      '#5b8af0', // azul
      '#00b8d9', // cyan
      '#2ec4b6', // teal
      '#3dd68c', // verde
      '#94d82d', // lima
      '#f0d45b', // amarillo
      '#ff9f1c', // naranja
      '#f05b5b', // rojo
      '#ff5d8f', // rosa
      '#d65db1', // magenta
      '#9b5de5', // morado
      '#845ec2', // violeta
      '#8d6e63', // café
      '#577590'  // azul grisáceo
    ],
    SG_COLORS:['#3dd68c','#5b8af0','#f0d45b','#ff9f1c','#f05b5b','#ff5d8f','#9b5de5','#2ec4b6']
  };
})();
