(function(){
  const root=window.BudgetLogFeatures=window.BudgetLogFeatures||{};
  const esc=window.BudgetLogCore.utils.esc;

  function showAuthScreen(){
    document.getElementById('loadingScreen').style.display='none';
    document.getElementById('authScreen').style.display='flex';
    document.getElementById('appShell').style.display='none';
  }

  function showAppShell(){
    document.getElementById('loadingScreen').style.display='none';
    document.getElementById('authScreen').style.display='none';
    document.getElementById('appShell').style.display='block';
  }

  function renderHeaderAvatar(user){
    const wrap=document.getElementById('avatarWrap');
    if(user.photoURL){
      wrap.innerHTML=`<img class="header-avatar" src="${user.photoURL}" referrerpolicy="no-referrer" alt="">`;
      return;
    }
    const initials=(user.displayName||'U').split(' ').map(word=>word[0]).join('').slice(0,2).toUpperCase();
    wrap.innerHTML=`<div class="header-avatar-placeholder">${esc(initials)}</div>`;
  }

  function populateUserModal(user){
    const avatar=document.getElementById('modalAvatar');
    avatar.src=user.photoURL||'';
    avatar.style.display=user.photoURL?'block':'none';
    document.getElementById('modalName').textContent=user.displayName||'';
    document.getElementById('modalEmail').textContent=user.email||'';
  }

  function openModal(id){
    document.getElementById(id).classList.add('open');
  }

  function closeModal(id){
    document.getElementById(id).classList.remove('open');
  }

  function renderOnboardDots(totalSteps,activeStep){
    return Array.from({length:totalSteps},(_,index)=>`<div class="onboard-dot${index===activeStep?' active':''}"></div>`).join('');
  }

  function showOnboardingStep(step,totalSteps){
    document.querySelectorAll('.onboard-step').forEach((node,index)=>node.classList.toggle('active',index===step));
    document.querySelectorAll('.onboard-dot').forEach((node,index)=>node.classList.toggle('active',index===step));
    document.getElementById('onboardNextBtn').textContent=step===totalSteps-1?'Empezar \uD83D\uDE80':'Siguiente \u2192';
  }

  function applyTheme(theme){
    const isLight=theme==='light';
    document.body.classList.toggle('light',isLight);
    document.getElementById('themeToggle').textContent=isLight?'\u263d':'\u2600';
  }

  function renderNotificationButton(hasToken){
    const button=document.getElementById('notifBtn');
    if(!button)return;
    button.textContent=hasToken?'\u2714 Notificaciones activas':'Activar notificaciones';
    button.className=hasToken?'notif-btn on':'notif-btn';
  }

  root.appShell={
    showAuthScreen,
    showAppShell,
    renderHeaderAvatar,
    populateUserModal,
    openModal,
    closeModal,
    renderOnboardDots,
    showOnboardingStep,
    applyTheme,
    renderNotificationButton
  };
})();
