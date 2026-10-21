const $ = (id) => document.getElementById(id);
const home = $('home'), practice = $('practice'), primeLearning = $('prime-learning'), reverseLearning = $('reverse-learning'), overview = $('overview');
const apiBase = location.pathname.toLowerCase().startsWith('/calculus') ? '/Calculus' : '';
let player = localStorage.getItem('calculus-player') || '';
let duration = 120, remaining = 120, limit = 10, correct = 0, incorrect = 0, a = 1, b = 1, timerId = null, active = false, savedResult = null;
$('player-name').value = player;

function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
function formatPerMinute(record) {
  if (!record.seconds) return '–';
  const minutes = record.seconds / 60;
  const correctRate = (record.correct / minutes).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const incorrectRate = (record.incorrect / minutes).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return `${correctRate} richtig / ${incorrectRate} falsch pro Minute`;
}
function activityTone(name) { const normalized=(name||'').trim().toLocaleLowerCase('de-DE');return normalized==='lena'?'activity-lena':normalized==='lukas'?'activity-lukas':''; }
function activityDayKey(value) { const date=new Date(value);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function formatActivityDay(value) { const date=new Date(value),weekday=date.toLocaleDateString('de-DE',{weekday:'long'}),day=String(date.getDate()).padStart(2,'0'),month=String(date.getMonth()+1).padStart(2,'0'),year=String(date.getFullYear()).slice(-2);return `${weekday} ${day}.${month}.${year}`; }
function formatActivityAction(action) { if(action.startsWith('Einmaleins'))return '1 x 1';if(action==='Primfaktorzerlegung')return 'PFZ';return action; }
function groupActivitiesByDay(records) {
  const groups=new Map();
  for(const record of records){const key=activityDayKey(record.at);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record);}
  return [...groups.entries()].sort(([a],[b])=>b.localeCompare(a)).map(([,items])=>items.sort((a,b)=>new Date(a.at)-new Date(b.at)));
}
function showPractice() { home.classList.add('hidden'); primeLearning.classList.add('hidden'); reverseLearning.classList.add('hidden'); practice.classList.remove('hidden'); $('leaderboard-panel').classList.add('hidden'); $('hello-name').textContent = player || 'Profi'; loadHistory(); window.scrollTo({top:0,behavior:'smooth'}); }
function showPrimeLearning() { home.classList.add('hidden'); practice.classList.add('hidden'); reverseLearning.classList.add('hidden'); primeLearning.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }
function showReverseLearning() { home.classList.add('hidden'); practice.classList.add('hidden'); primeLearning.classList.add('hidden'); overview.classList.add('hidden'); reverseLearning.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }
function showOverview() { stopClock(); home.classList.add('hidden'); practice.classList.add('hidden'); primeLearning.classList.add('hidden'); reverseLearning.classList.add('hidden'); overview.classList.remove('hidden'); loadOverview(); window.scrollTo({top:0,behavior:'smooth'}); }
function showHome() { stopClock(); cancelReverseSession(); practice.classList.add('hidden'); primeLearning.classList.add('hidden'); reverseLearning.classList.add('hidden'); overview.classList.add('hidden'); home.classList.remove('hidden'); $('settings').classList.remove('hidden'); $('game').classList.add('hidden'); $('results').classList.add('hidden'); $('leaderboard-panel').classList.add('hidden'); window.scrollTo({top:0,behavior:'smooth'}); }
async function api(url, options={}) { const response = await fetch(`${apiBase}${url}`,{headers:{'Content-Type':'application/json'},...options}); if(!response.ok) throw new Error('Speichern gerade nicht möglich.'); return response.json(); }
async function loadHistory() { try { const data = await api(`/api/history/${encodeURIComponent(player)}`); renderHistory((data.history || []).slice(0,20)); showBest(data.best); } catch { renderHistory([]); } }
function showBest(best) { if(!best) { $('best-score').textContent='–'; $('best-date').textContent='Noch kein Rekord'; return; } $('best-score').textContent=`${best.correct} ✓`; $('best-date').textContent=new Date(best.at).toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'}); }
function renderHistory(records) {
  const list=$('history-list');
  list.replaceChildren();
  if(!records.length){const empty=document.createElement('p');empty.className='empty-history';empty.textContent='Deine Runden erscheinen hier. Leg gleich los! 🌟';list.append(empty);return;}
  for(const day of groupActivitiesByDay(records)){
    const group=document.createElement('section');group.className='activity-day';
    const heading=document.createElement('h3');heading.className='activity-day-heading';heading.textContent=formatActivityDay(day[0].at);group.append(heading);
    day.forEach((record,index)=>{
      const row=document.createElement('div');row.className=`history-row activity-entry ${activityTone(record.name||player)}`.trim();
      const number=document.createElement('span');number.className='activity-entry-number';number.textContent=`${index+1}.`;
      const time=document.createElement('time');time.textContent=new Date(record.at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
      const score=document.createElement('span');score.className='history-score';score.textContent=`✓ ${record.correct} richtig`;
      const wrong=document.createElement('span');wrong.className='history-wrong';wrong.textContent=`✕ ${record.incorrect}`;
      const rates=document.createElement('small');rates.className='history-rates';rates.textContent=formatPerMinute(record);
      row.append(number,time,score,wrong,rates);group.append(row);
    });
    list.append(group);
  }
}
$('name-form').addEventListener('submit', async (event)=>{ event.preventDefault(); const entered=$('player-name').value.trim(); if(!entered)return; try { const data=await api('/api/user',{method:'POST',body:JSON.stringify({name:entered})}); player=data.name; } catch { player=entered.slice(0,32); } localStorage.setItem('calculus-player',player); $('task-pick').scrollIntoView({behavior:'smooth',block:'center'}); });
$('multiplication-card').addEventListener('click',()=>{ if(!player){$('player-name').focus();$('player-name').scrollIntoView({behavior:'smooth',block:'center'});return;} showPractice(); });
$('reverse-card').addEventListener('click',()=>{ if(!player){$('player-name').focus();$('player-name').scrollIntoView({behavior:'smooth',block:'center'});return;} showReverseLearning(); });
$('reverse-back-home').addEventListener('click',showHome);
$('prime-card').addEventListener('click',()=>{ if(!player){$('player-name').focus();$('player-name').scrollIntoView({behavior:'smooth',block:'center'});return;} showPrimeLearning(); });
$('prime-back-home').addEventListener('click',showHome);
$('overview-link').addEventListener('click',(event)=>{event.preventDefault();showOverview();});
$('overview-back-home').addEventListener('click',showHome);
$('back-home').addEventListener('click',showHome); $('result-home').addEventListener('click',showHome); $('again-button').addEventListener('click',startGame);
function nextQuestion(){const allowedFactors=limit===10?[2,3,4,5,6,7,8,9]:[2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19,20];a=allowedFactors[Math.floor(Math.random()*allowedFactors.length)];b=allowedFactors[Math.floor(Math.random()*allowedFactors.length)];$('factor-a').textContent=a;$('factor-b').textContent=b;$('answer').value='';$('question-number').textContent=correct+incorrect+1;$('answer').focus();}
function stopClock(){ if(timerId){clearInterval(timerId);timerId=null;} active=false; }
function updateClock(){ $('timer').textContent=formatTime(remaining); $('timer').classList.toggle('urgent',remaining<=15); $('progress-fill').style.width=`${Math.max(0,remaining/duration*100)}%`; }
function startGame(){ if(!player){showHome();return;} stopClock(); const minutes=Number($('duration').value);if(!Number.isInteger(minutes)||minutes<1||minutes>30){$('duration').focus();return;}duration=minutes*60;remaining=duration;limit=Number(document.querySelector('input[name="limit"]:checked').value);correct=0;incorrect=0;active=true;savedResult=null;$('correct-count').textContent=0;$('incorrect-count').textContent=0;$('timer').classList.remove('urgent');$('settings').classList.add('hidden');$('results').classList.add('hidden');$('leaderboard-panel').classList.add('hidden');$('game').classList.remove('hidden');updateClock();nextQuestion();timerId=setInterval(()=>{remaining--;updateClock();if(remaining<=0)finishGame();},1000); }
$('start-button').addEventListener('click',startGame);
$('answer-form').addEventListener('submit',(event)=>{event.preventDefault();if(!active)return;const value=$('answer').value.trim();if(value==='')return;if(Number(value)===a*b){correct++;$('game-hint').textContent=['Yes! Genau richtig! ✨','Stark gerechnet! 🌟','Weiter so, du bist schnell! ⚡'][Math.floor(Math.random()*3)];$('game-hint').style.color='#49a27c';}else{incorrect++;$('game-hint').textContent=`Knapp daneben – ${a} × ${b} = ${a*b}. Gleich die nächste!`; $('game-hint').style.color='#ce8677';} $('correct-count').textContent=correct;$('incorrect-count').textContent=incorrect;nextQuestion();});
async function finishGame(){if(!active)return;stopClock();$('game').classList.add('hidden');$('results').classList.remove('hidden');$('result-correct').textContent=correct;$('result-incorrect').textContent=incorrect;$('result-title').textContent=correct>=20?'Du bist ein Mathe-Superstar!':correct>=10?'Richtig stark gemacht!':'Gut trainiert!';$('best-score').textContent='…';$('best-date').textContent='';try{savedResult=await api('/api/result',{method:'POST',body:JSON.stringify({name:player,limit,seconds:duration,correct,incorrect})});showBest(savedResult.best);renderHistory(savedResult.history||[]);}catch{$('best-score').textContent='–';$('best-date').textContent='Ergebnis konnte nicht gespeichert werden';} await loadLeaderboard(); }
$('leaderboard-panel').classList.add('hidden');
async function loadLeaderboard(){const panel=$('leaderboard-panel'),list=$('leaderboard-list');panel.classList.remove('hidden');list.innerHTML='<p class="empty-history">Lade Spielergebnisse …</p>';try{const users=await api('/api/leaderboard');list.replaceChildren();if(!users.length){list.innerHTML='<p class="empty-history">Noch keine gespeicherten Runden.</p>';return;}for(const user of users){const row=document.createElement('div');row.className=`leaderboard-row ${activityTone(user.name)}`.trim();const playerCell=document.createElement('div');playerCell.className='leaderboard-player';const nameButton=document.createElement('button');nameButton.className='leaderboard-name';nameButton.textContent=user.name;nameButton.title=`Gesamte Historie von ${user.name} ansehen`;nameButton.addEventListener('click',()=>openPlayerHistory(user.name));const attempts=document.createElement('span');attempts.className='attempt-count';attempts.textContent=`${user.attempts} ${user.attempts===1?'Versuch':'Versuche'}`;playerCell.append(nameButton,attempts);const bestCell=document.createElement('div');bestCell.className='leaderboard-best';const score=document.createElement('b');score.textContent=`✅ ${user.best.correct} richtig　❌ ${user.best.incorrect} falsch`;const detail=document.createElement('small');detail.textContent=`${user.best.limit===10?'Kleines':'Großes'} Einmaleins · ${formatTime(user.best.seconds)} · ${new Date(user.best.at).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'})}`;const rates=document.createElement('small');rates.className='leaderboard-rates';rates.textContent=formatPerMinute(user.best);bestCell.append(score,detail,rates);row.append(playerCell,bestCell);list.append(row);}}catch{list.innerHTML='<p class="empty-history">Der Spielervergleich konnte gerade nicht geladen werden.</p>';}}
async function loadOverview(){
  const list=$('activity-list');list.replaceChildren();
  const loading=document.createElement('tr'),loadingCell=document.createElement('td');loadingCell.colSpan=5;loadingCell.className='activity-message';loadingCell.textContent='Lade Aktivitäten …';loading.append(loadingCell);list.append(loading);
  try{
    const activities=await api('/api/overview');list.replaceChildren();
    if(!activities.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.className='activity-message';cell.textContent='Noch keine Aktivitäten gespeichert.';row.append(cell);list.append(row);return;}
    for(const day of groupActivitiesByDay(activities)){
      const heading=document.createElement('tr');heading.className='activity-day-row';
      const headingCell=document.createElement('th');headingCell.colSpan=5;headingCell.scope='rowgroup';headingCell.textContent=formatActivityDay(day[0].at);heading.append(headingCell);list.append(heading);
      const sortedDay=[...day].sort((a,b)=>a.name.localeCompare(b.name,'de',{sensitivity:'base'})||new Date(a.at)-new Date(b.at));
      sortedDay.forEach((activity,index)=>{
        const row=document.createElement('tr');row.className=activityTone(activity.name);
        const date=document.createElement('td');date.textContent=`${index+1}. ${new Date(activity.at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`;
        const name=document.createElement('td');name.textContent=activity.name;
        const action=document.createElement('td');action.textContent=formatActivityAction(activity.action);
        const details=document.createElement('td');details.textContent=activity.details;
        const rate=document.createElement('td');rate.textContent=activity.correctPerMinute===null||activity.correctPerMinute===undefined?'–':`${activity.correctPerMinute.toLocaleString('de-DE',{maximumFractionDigits:1})} richtig / ${activity.incorrectPerMinute.toLocaleString('de-DE',{maximumFractionDigits:1})} falsch`;
        row.append(date,name,action,details,rate);list.append(row);
      });
    }
  }catch{list.replaceChildren();const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.className='activity-message';cell.textContent='Die Gesamtübersicht konnte gerade nicht geladen werden.';row.append(cell);list.append(row);}
}
async function openPlayerHistory(name){
  const dialog=$('user-history-dialog'),list=$('dialog-history-list');$('dialog-player-name').textContent=name;list.innerHTML='<p class="empty-history">Lade Historie …</p>';dialog.showModal();
  try{
    const data=await api(`/api/history/${encodeURIComponent(name)}`);list.replaceChildren();
    if(!data.history.length){list.innerHTML='<p class="empty-history">Für diesen Spieler gibt es noch keine Runden.</p>';return;}
    for(const day of groupActivitiesByDay(data.history)){
      const group=document.createElement('section');group.className='activity-day';
      const heading=document.createElement('h3');heading.className='activity-day-heading';heading.textContent=formatActivityDay(day[0].at);group.append(heading);
      day.forEach((run,index)=>{
        const row=document.createElement('div');row.className=`dialog-history-row activity-entry ${activityTone(name)}`.trim();
        const number=document.createElement('span');number.className='activity-entry-number';number.textContent=`${index+1}.`;
        const date=document.createElement('time');date.textContent=new Date(run.at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
        const mode=document.createElement('span');mode.textContent=`${run.limit===10?'Kleines':'Großes'} Einmaleins · ${formatTime(run.seconds)}`;
        const result=document.createElement('b');result.textContent=`✅ ${run.correct}　❌ ${run.incorrect}`;
        row.append(number,date,mode,result);group.append(row);
      });
      list.append(group);
    }
  }catch{list.innerHTML='<p class="empty-history">Die Historie konnte gerade nicht geladen werden.</p>';}
}
$('close-history-dialog').addEventListener('click',()=>$('user-history-dialog').close());
$('clear-history').addEventListener('click',async()=>{if(!player)return;try{await api(`/api/history/${encodeURIComponent(player)}`,{method:'DELETE'});renderHistory([]);showBest(null);if(!$('leaderboard-panel').classList.contains('hidden'))await loadLeaderboard();}catch{alert('Die History konnte gerade nicht gelöscht werden.');}});
let installPrompt=null;const installButton=$('install-app');window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installButton.classList.remove('hidden');});installButton.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;installButton.classList.add('hidden');});window.addEventListener('appinstalled',()=>installButton.classList.add('hidden'));
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js?v=__APP_VERSION__').catch(()=>{}));

let primeTarget=0,primeCurrent=0,primeFactors=[],primeActive=false,primeSessionActive=false,primeDuration=120,primeRemaining=120,primeMaximum=5000,primeAvailableTargets=[],primeTimerId=null,primeCorrect=0,primeIncorrect=0,primeSessionSaving=false,pendingPrimeLogs=Promise.resolve();
function isPrimeNumber(value){if(value<2)return false;for(let divisor=2;divisor*divisor<=value;divisor++)if(value%divisor===0)return false;return true;}
const primeComposites=Array.from({length:14997},(_,index)=>index+4).filter(value=>!isPrimeNumber(value));
function smallestPrimeFactor(value){for(let candidate=2;candidate<=value;candidate++)if(isPrimeNumber(candidate)&&value%candidate===0)return candidate;return value;}
function formatPrimeClock(seconds){return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function updatePrimeClock(){$('prime-timer').textContent=formatPrimeClock(primeRemaining);$('prime-timer').classList.toggle('urgent',primeRemaining<=15);}
function createPrimeChoices(){const choices=$('prime-choice-list');for(let number=2;number<=127;number++)if(isPrimeNumber(number)){const button=document.createElement('button');button.type='button';button.dataset.prime=number;button.textContent=number;button.addEventListener('click',()=>choosePrimeFactor(number));choices.append(button);}}
function updatePrimeScore(){$('prime-correct-count').textContent=primeCorrect;$('prime-incorrect-count').textContent=primeIncorrect;}
let primeSessionResults=[];
function renderPrimeResults(){
  const list=$('prime-result-list');list.replaceChildren();
  if(!primeSessionResults.length){const empty=document.createElement('p');empty.className='prime-result-empty';empty.textContent='Gelöste Zahlen erscheinen hier.';list.append(empty);return;}
  for(const day of groupActivitiesByDay(primeSessionResults)){
    const group=document.createElement('section');group.className='activity-day';
    const heading=document.createElement('h3');heading.className='activity-day-heading';heading.textContent=formatActivityDay(day[0].at);group.append(heading);
    day.forEach((result,index)=>{
      const row=document.createElement('div');row.className=`prime-result-row activity-entry ${activityTone(player)}`.trim();
      const number=document.createElement('span');number.className='activity-entry-number';number.textContent=`${index+1}.`;
      const equation=document.createElement('span');equation.textContent=`${result.number} = ${result.factors.join(' × ')}`;
      const range=document.createElement('small');range.textContent=`Zahlen bis ${result.maximum.toLocaleString('de-DE')} · ${new Date(result.at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}`;
      row.append(number,equation,range);group.append(row);
    });
    list.append(group);
  }
}
function addPrimeResult(number,factors){primeSessionResults.push({number,factors,maximum:primeMaximum,at:new Date()});renderPrimeResults();}
function startPrimeQuestion(){primeTarget=primeAvailableTargets[Math.floor(Math.random()*primeAvailableTargets.length)];primeCurrent=primeTarget;primeFactors=[];primeActive=true;$('prime-number').textContent=primeCurrent;$('prime-progress').textContent='Finde den kleinsten Primfaktor';$('prime-prompt').textContent=`Welche kleinste Primzahl teilt ${primeCurrent} ohne Rest?`;$('prime-feedback').textContent=`Wähle den kleinsten Primfaktor. Zahlen gehen bis ${primeMaximum.toLocaleString('de-DE')}.`;$('prime-feedback').className='prime-feedback';$('prime-factor-line').innerHTML='<span class="factor-placeholder">Deine Primfaktoren erscheinen hier</span>';document.querySelectorAll('#prime-choice-list button').forEach(button=>button.disabled=false);}
function startPrimeSession(){if(primeSessionActive||primeSessionSaving)return;const minutes=Number($('prime-duration').value),maximum=Number($('prime-maximum').value);if(!Number.isInteger(minutes)||minutes<1||minutes>30){$('prime-duration').focus();return;}if(!Number.isInteger(maximum)||maximum<4||maximum>15000){$('prime-maximum').focus();return;}if(primeTimerId)clearInterval(primeTimerId);primeMaximum=maximum;primeAvailableTargets=primeComposites.filter(number=>number<=primeMaximum);primeDuration=minutes*60;primeRemaining=primeDuration;primeCorrect=0;primeIncorrect=0;primeSessionResults=[];primeSessionActive=true;primeSessionSaving=false;pendingPrimeLogs=Promise.resolve();updatePrimeScore();renderPrimeResults();$('prime-duration').disabled=true;$('prime-maximum').disabled=true;$('prime-new-round').classList.add('hidden');$('prime-session-settings').classList.add('running');$('prime-timer').classList.remove('urgent');updatePrimeClock();$('prime-prompt').textContent=`Starte die Runde und zerlege Zahlen bis ${primeMaximum.toLocaleString('de-DE')}.`;startPrimeQuestion();primeTimerId=setInterval(()=>{primeRemaining--;updatePrimeClock();if(primeRemaining<=0)finishPrimeSession();},1000);}
async function finishPrimeSession(){if(!primeSessionActive||primeSessionSaving)return;primeSessionActive=false;primeSessionSaving=true;primeActive=false;if(primeTimerId){clearInterval(primeTimerId);primeTimerId=null;}primeRemaining=0;updatePrimeClock();$('prime-number').textContent='✓';$('prime-progress').textContent='Trainingszeit vorbei';$('prime-prompt').textContent=`Zahlen bis ${primeMaximum.toLocaleString('de-DE')}: ${primeCorrect} Zerlegungen richtig, ${primeIncorrect} Fehlversuche.`;$('prime-feedback').textContent='Speichere deine Runde …';$('prime-feedback').className='prime-feedback';document.querySelectorAll('#prime-choice-list button').forEach(button=>button.disabled=true);$('prime-duration').disabled=false;$('prime-maximum').disabled=false;$('prime-session-settings').classList.remove('running');await pendingPrimeLogs;try{await api('/api/prime-session-result',{method:'POST',body:JSON.stringify({name:player,maximum:primeMaximum,seconds:primeDuration,correct:primeCorrect,incorrect:primeIncorrect})});$('prime-feedback').textContent='Runde gespeichert! Starte gern noch eine.';$('prime-feedback').className='prime-feedback right';}catch{$('prime-feedback').textContent='Die Runde konnte nicht protokolliert werden. Prüfe deine Internetverbindung.';$('prime-feedback').className='prime-feedback wrong';}finally{$('prime-new-round').classList.remove('hidden');$('prime-new-round').innerHTML='Nochmal spielen <span>↻</span>';primeSessionSaving=false;}}
function logPrimeExercise(number,factors){pendingPrimeLogs=pendingPrimeLogs.then(async()=>{try{await api('/api/prime-result',{method:'POST',body:JSON.stringify({name:player,number,maximum:primeMaximum,factors})});}catch{$('prime-feedback').textContent='Die Zerlegung war richtig, konnte aber nicht protokolliert werden.';$('prime-feedback').className='prime-feedback wrong';}});}
function choosePrimeFactor(chosen){if(!primeActive||!primeSessionActive)return;const correctFactor=smallestPrimeFactor(primeCurrent);if(chosen!==correctFactor){primeIncorrect++;updatePrimeScore();$('prime-feedback').textContent=`Noch nicht! Der kleinste Primfaktor von ${primeCurrent} ist ${correctFactor}. Prüfe, welche Primzahl ohne Rest teilt.`;$('prime-feedback').className='prime-feedback wrong';return;}primeFactors.push(chosen);primeCurrent/=chosen;if(primeCurrent>1&&isPrimeNumber(primeCurrent)){primeFactors.push(primeCurrent);primeCurrent=1;}if(primeCurrent===1){primeCorrect++;updatePrimeScore();const factors=[...primeFactors],number=primeTarget;addPrimeResult(number,factors);logPrimeExercise(number,factors);$('prime-number').textContent=primeTarget;$('prime-progress').textContent='Zerlegung geschafft!';$('prime-prompt').textContent='Alle Faktoren sind Primzahlen. Super zerlegt!';$('prime-feedback').textContent='Richtig kombiniert – du hast die Primfaktorzerlegung gefunden! 🎉';$('prime-feedback').className='prime-feedback right';document.querySelectorAll('#prime-choice-list button').forEach(button=>button.disabled=true);startPrimeQuestion();return;}$('prime-number').textContent=primeCurrent;$('prime-progress').textContent=`Restzahl: ${primeCurrent}`;$('prime-prompt').textContent=`Welcher kleinste Primfaktor teilt ${primeCurrent} ohne Rest?`;$('prime-factor-line').textContent=`${primeTarget} = ${primeFactors.join(' × ')}${primeCurrent>1?` × ${primeCurrent}`:''}`;$('prime-feedback').textContent=`Genau! ${chosen} ist der kleinste Primfaktor. Weiter mit ${primeCurrent}.`;$('prime-feedback').className='prime-feedback right';}
createPrimeChoices();
$('prime-new-round').addEventListener('click',startPrimeSession);

let reverseDuration=120,reverseRemaining=120,reverseTimerId=null,reverseActive=false,reverseSaving=false,reverseCorrect=0,reverseIncorrect=0,reverseTarget=0,reverseFirstFactor=null;
function updateReverseClock(){$('reverse-timer').textContent=formatPrimeClock(reverseRemaining);$('reverse-timer').classList.toggle('urgent',reverseRemaining<=15);}
function startReverseQuestion(preserveFeedback=false){
  let first,second,product;
  do{first=Math.floor(Math.random()*9)+1;second=Math.floor(Math.random()*9)+1;product=first*second;}while(product<9);
  reverseTarget=product;reverseFirstFactor=null;$('reverse-target').textContent=reverseTarget;$('reverse-prompt').textContent='Tippe nacheinander auf die zwei passenden Zahlen.';if(!preserveFeedback){$('reverse-feedback').textContent='Wähle zwei Zahlen. Die Reihenfolge ist egal.';$('reverse-feedback').className='reverse-feedback';}
  document.querySelectorAll('#reverse-factor-picks button').forEach(button=>{button.disabled=false;button.classList.remove('selected');});
}
function createReverseChoices(){
  const choices=$('reverse-factor-picks');
  for(let number=1;number<=9;number++){
    const button=document.createElement('button');button.type='button';button.textContent=number;button.setAttribute('aria-label',`Faktor ${number}`);button.addEventListener('click',()=>chooseReverseFactor(number,button));choices.append(button);
  }
}
function chooseReverseFactor(factor,button){
  if(!reverseActive||reverseSaving)return;
  if(reverseFirstFactor===null){reverseFirstFactor=factor;button.classList.add('selected');$('reverse-feedback').textContent=`${factor} ausgewählt – tippe den zweiten Faktor.`;$('reverse-feedback').className='reverse-feedback';return;}
  const first=reverseFirstFactor;
  if(first*factor===reverseTarget){reverseCorrect++;$('reverse-feedback').textContent=`Richtig: ${first} × ${factor} = ${reverseTarget}! 🎉`;$('reverse-feedback').className='reverse-feedback right';}
  else{reverseIncorrect++;$('reverse-feedback').textContent=`Das passt nicht: ${first} × ${factor} = ${first*factor}. Nächste Zahl!`;$('reverse-feedback').className='reverse-feedback wrong';}
  $('reverse-correct').textContent=reverseCorrect;$('reverse-incorrect').textContent=reverseIncorrect;startReverseQuestion(true);
}
function cancelReverseSession(){
  if(reverseTimerId){clearInterval(reverseTimerId);reverseTimerId=null;}
  if(reverseActive){reverseActive=false;reverseSaving=false;$('reverse-duration').disabled=false;$('reverse-session-settings').classList.remove('running');$('reverse-start').classList.remove('hidden');$('reverse-start').innerHTML='Runde starten <span>→</span>';}
}
async function finishReverseSession(){
  if(!reverseActive||reverseSaving)return;
  reverseActive=false;reverseSaving=true;if(reverseTimerId){clearInterval(reverseTimerId);reverseTimerId=null;}reverseRemaining=0;updateReverseClock();
  $('reverse-target').textContent='✓';$('reverse-prompt').textContent='Die Trainingszeit ist vorbei!';$('reverse-feedback').textContent='Speichere deine Runde …';$('reverse-feedback').className='reverse-feedback';document.querySelectorAll('#reverse-factor-picks button').forEach(button=>button.disabled=true);
  $('reverse-duration').disabled=false;$('reverse-session-settings').classList.remove('running');
  try{await api('/api/reverse-session-result',{method:'POST',body:JSON.stringify({name:player,seconds:reverseDuration,correct:reverseCorrect,incorrect:reverseIncorrect})});$('reverse-feedback').textContent='Runde gespeichert! Starte gern noch eine.';$('reverse-feedback').className='reverse-feedback right';}
  catch{$('reverse-feedback').textContent='Die Runde konnte nicht protokolliert werden. Prüfe deine Internetverbindung.';$('reverse-feedback').className='reverse-feedback wrong';}
  finally{$('reverse-start').classList.remove('hidden');$('reverse-start').innerHTML='Nochmal spielen <span>↻</span>';reverseSaving=false;}
}
function startReverseSession(){
  if(reverseActive||reverseSaving)return;
  const minutes=Number($('reverse-duration').value);if(!Number.isInteger(minutes)||minutes<1||minutes>30){$('reverse-duration').focus();return;}
  if(reverseTimerId)clearInterval(reverseTimerId);reverseDuration=minutes*60;reverseRemaining=reverseDuration;reverseCorrect=0;reverseIncorrect=0;reverseActive=true;reverseSaving=false;
  $('reverse-correct').textContent='0';$('reverse-incorrect').textContent='0';$('reverse-duration').disabled=true;$('reverse-session-settings').classList.add('running');$('reverse-start').classList.add('hidden');$('reverse-timer').classList.remove('urgent');updateReverseClock();startReverseQuestion();
  reverseTimerId=setInterval(()=>{reverseRemaining--;updateReverseClock();if(reverseRemaining<=0)finishReverseSession();},1000);
}
createReverseChoices();
$('reverse-start').addEventListener('click',startReverseSession);
