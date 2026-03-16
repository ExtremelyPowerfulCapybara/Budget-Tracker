(function(){
  const root=window.BudgetLogCore=window.BudgetLogCore||{};

  function createUserDocRef(db,user){
    return user?db.collection('users').doc(user.uid):null;
  }

  async function signInWithGoogle(auth,firebase){
    const provider=new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider);
  }

  function setSyncIndicator(dot,state){
    if(!dot)return;
    dot.className='sync-indicator'+(state==='syncing'?' syncing':state==='error'?' error':'');
    dot.title=state==='syncing'?'Sincronizando...':state==='error'?'Error':'Sincronizado';
  }

  async function loadUserState(options){
    const {
      userDocRef,
      defaultGoals,
      sanitizeRecurringRule,
      readLocalState,
      applyState,
      applyCustomCategories,
      hasAnyEntries,
      persistUserState,
      setSyncState,
      showToast
    }=options;

    setSyncState('syncing');
    try{
      const doc=await userDocRef.get();
      if(doc.exists){
        applyState(doc.data());
        applyCustomCategories();
      }else{
        const localState=readLocalState({defaultGoals,sanitizeRecurringRule});
        applyState(localState);
        applyCustomCategories();
        if(hasAnyEntries(localState)){
          await persistUserState();
          showToast('Datos locales migrados a la nube');
        }
      }
      setSyncState('ok');
    }catch(error){
      console.error('Firestore load:',error);
      setSyncState('error');
      applyState(readLocalState({defaultGoals,sanitizeRecurringRule}));
      applyCustomCategories();
    }
  }

  async function persistUserState(options){
    const {
      userDocRef,
      firebase,
      state,
      serializeCloudState,
      setSyncState
    }=options;

    if(!userDocRef)return;
    setSyncState('syncing');
    try{
      await userDocRef.set({
        ...serializeCloudState(state),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      setSyncState('ok');
    }catch(error){
      console.error('Firestore save:',error);
      setSyncState('error');
    }
  }

  root.cloud={
    createUserDocRef,
    signInWithGoogle,
    setSyncIndicator,
    loadUserState,
    persistUserState
  };
})();
