(() => {
'use strict';
const CORE=window.CutCore;
const OLD_STORE='raskroishik-mobile-v1', STORE='raskroishik-mobile-v2';
const $=id=>document.getElementById(id);
const palette=['#2d72d2','#129c98','#e48b25','#8a63d2','#d35483','#527e4e','#a56442','#328caf','#b674a8'];
const uid=()=>`id${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
const fresh=()=>({rollWidth:'152',rollLength:'',gap:'0',rotate:true,email:'',mode:'manual',selectedRollId:'',blocks:[{id:uid(),name:'Оконный блок 1',rows:[{id:uid(),w:'',h:'',qty:'1'}]}]});
function load(){
 function parseData(raw){
  try {
   const d=JSON.parse(raw);
   if(d&&d.draft&&Array.isArray(d.draft.blocks)&&Array.isArray(d.rolls)&&Array.isArray(d.history))return d;
  }catch(e){}
  return null;
 }
 let browser=null,native=null;
 try{browser=parseData(localStorage.getItem(STORE));}catch(e){}
 try{if(window.AndroidApp?.getAppState)native=parseData(window.AndroidApp.getAppState());}catch(e){}
 const chosen=(!browser?native:!native?browser:(Number(native.savedAt)||0)>(Number(browser.savedAt)||0)?native:browser);
 if(chosen)return {draft:{...fresh(),...chosen.draft},rolls:chosen.rolls,history:chosen.history,log:Array.isArray(chosen.log)?chosen.log:[],savedAt:chosen.savedAt||0};
 try{
  const old=JSON.parse(localStorage.getItem(OLD_STORE));
  if(old&&Array.isArray(old.blocks)&&old.blocks.length)return {draft:{...fresh(),...old,mode:'manual',selectedRollId:''},rolls:[],history:[],log:[]};
 }catch(e){}
 return {draft:fresh(),rolls:[],history:[],log:[]};
}
const data=load();let state=data.draft, result=null,currentEntryId=null,toastTimer=null,installPrompt=null,view='cut',lastSavedRollId='';
// Custom confirmations are used instead of window.confirm(): they work in a browser and in an Android WebView.
let pendingConfirmation=null,confirmReturnFocus=null;
function confirmAction({title,message,acceptText='Подтвердить',onAccept}){
 if(pendingConfirmation)return;
 pendingConfirmation=onAccept;
 confirmReturnFocus=document.activeElement;
 $('confirmTitle').textContent=title;
 $('confirmMessage').textContent=message;
 $('confirmAccept').textContent=acceptText;
 $('confirmOverlay').hidden=false;
 $('confirmAccept').focus();
}
function closeConfirmation(){
 $('confirmOverlay').hidden=true;
 pendingConfirmation=null;
 if(confirmReturnFocus && document.contains(confirmReturnFocus))confirmReturnFocus.focus();
 confirmReturnFocus=null;
}
function acceptConfirmation(){
 const action=pendingConfirmation;
 if(!action)return;
 closeConfirmation();
 try{action();}catch(err){toast('Ошибка операции: '+(err.message||'неизвестная ошибка'));}
}

function safe(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function save(){
 data.draft=state;data.savedAt=Date.now();
 const raw=JSON.stringify(data);
 let browserSaved=false,nativeSaved=false;
 try{localStorage.setItem(STORE,raw);browserSaved=true;}catch(e){}
 try{if(window.AndroidApp?.setAppState){window.AndroidApp.setAppState(raw);nativeSaved=true;}}catch(e){}
 if(!browserSaved&&!nativeSaved){toast('Не удалось сохранить данные: хранилище недоступно.');return false;}
 return true;
}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4300);}
function format(n){return Number(n).toLocaleString('ru-RU',{maximumFractionDigits:1});}
function cm(mm){return format(mm/10);}
function editableCM(mm){return String(mm/10).replace('.',',');}
function meters(mm){return format(mm/1000);}
function entry(){return data.history.find(e=>e.id===currentEntryId);}
function rollById(id){return data.rolls.find(r=>r.id===id);}
function parseMM(v,label){const clean=String(v).trim().replace(/[\s\u00a0\u202f]/g,'');const n=CORE.toMM(clean);if(!clean||!Number.isFinite(n)||n<0)throw Error(`Проверь поле «${label}».`);return n;}
function dateLabel(d){return new Date(d).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function setView(next){
 view=next;
 document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 document.querySelectorAll('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.go===view));
 $('subtitle').textContent=({cut:'Раскрой · ручная резка · учёт рулонов',history:'Сохранённые схемы раскроя',stock:'Учёт рулонных материалов'})[view];
 if(view==='history')renderHistory();
 if(view==='stock')renderStock();
 window.scrollTo({top:0,behavior:'instant'});
}
function openMenu(){const sb=$('sidebar'); if(!sb) return; sb.classList.add('open'); sb.setAttribute('aria-hidden','false'); const scr=$('scrim'); if(scr) scr.hidden=false; const btn=$('menuBtn'); if(btn) btn.setAttribute('aria-expanded','true');}
function closeMenu(){const sb=$('sidebar'); if(!sb) return; sb.classList.remove('open'); sb.setAttribute('aria-hidden','true'); const scr=$('scrim'); if(scr) scr.hidden=true; const btn=$('menuBtn'); if(btn) btn.setAttribute('aria-expanded','false');}
function fields(){
 if(!state.selectedRollId){state.rollWidth=$('rollWidth').value.trim();state.rollLength=$('rollLength').value.trim();}
 state.gap=$('gap').value.trim();state.rotate=$('rotate').checked;state.email=$('email').value.trim();
 state.mode=document.querySelector('input[name="cutMode"]:checked')?.value||'manual';
 save();
}
function hideResult(){result=null;currentEntryId=null;$('resultPanel').classList.remove('visible');}
function applyDraft(){
 $('rollWidth').value=state.rollWidth;$('rollLength').value=state.rollLength;$('gap').value=state.gap;
 $('rotate').checked=state.rotate;$('email').value=state.email||'';
 const mode=document.querySelector(`input[name="cutMode"][value="${state.mode||'manual'}"]`);if(mode)mode.checked=true;
 renderStockSelect();renderBlocks();
}
function renderStockSelect(){
 const sel=$('stockSelect');
 const chosen=state.selectedRollId||'';
 sel.innerHTML='<option value="">Без привязки к складу — свои размеры</option>'+data.rolls.map(r=>`<option value="${safe(r.id)}">${safe(r.name)} — ${cm(r.widthMM)} см × ${cm(r.remainingMM)} см остаток</option>`).join('');
 if(chosen && !rollById(chosen)){state.selectedRollId='';save();}
 sel.value=state.selectedRollId||'';
 const r=rollById(state.selectedRollId);
 $('rollWidth').disabled=!!r;$('rollLength').disabled=!!r;
 if(r){
  $('rollWidth').value=editableCM(r.widthMM);$('rollLength').value=editableCM(r.remainingMM);
  $('selectedRollInfo').textContent=`${r.name}: доступно ${meters(r.remainingMM)} м при ширине ${cm(r.widthMM)} см. Списание — только после подтверждения.`;
 }else{
  $('rollWidth').value=state.rollWidth;$('rollLength').value=state.rollLength;
  $('selectedRollInfo').textContent='Можно выбрать рулон из остатков или указать размеры вручную.';
 }
}
function renderBlocks(){
 $('blocks').innerHTML=state.blocks.map((b,i)=>`<article class="block" data-block="${safe(b.id)}">
 <div class="block-head"><span class="block-dot" style="background:${palette[i%palette.length]}"></span><input class="block-name" data-field="block-name" aria-label="Название оконного блока" value="${safe(b.name)}"/><button class="remove" type="button" data-action="remove-block" aria-label="Удалить оконный блок">×</button></div>
 <div class="colheads"><span>Ширина, см</span><span>Высота, см</span><span>Шт.</span><span></span></div>
 <div class="rows">${b.rows.map(r=>`<div class="piece-row" data-row="${safe(r.id)}"><input data-field="w" inputmode="decimal" aria-label="Ширина детали" placeholder="123" value="${safe(r.w)}"/><input data-field="h" inputmode="decimal" aria-label="Высота детали" placeholder="40" value="${safe(r.h)}"/><input data-field="qty" inputmode="numeric" aria-label="Количество деталей" value="${safe(r.qty)}"/><button class="remove" data-action="remove-row" type="button" aria-label="Удалить деталь">×</button></div>`).join('')}</div>
 <div class="block-foot"><button class="linkbtn" data-action="add-row" type="button">+ Добавить деталь</button><span class="mini">${b.rows.length} типов</span></div></article>`).join('');
}
function calculate(){
 fields();
 const selected=rollById(state.selectedRollId);
 if(state.selectedRollId&&!selected){toast('Выбранный рулон отсутствует. Выбери другой.');return;}
 try {
  if(selected&&selected.remainingMM<10)throw Error('Этот рулон закончился. Выбери другой.');
  const args={...state,rollWidth:selected?String(selected.widthMM/10):state.rollWidth,rollLength:selected?String(selected.remainingMM/10):state.rollLength};
  result=CORE.solve(args);
  if(selected&&result.sheets.length!==1)throw Error('Для этого раскроя одного выбранного рулона недостаточно. Выбери другой рулон или раздели детали на отдельные раскрои.');
  let comparison=null;
  if(state.mode==='manual'){
   const economical=CORE.solve({...args,mode:'economy'});
   comparison=Math.max(0,result.usedLength-economical.usedLength);
  }
  const rec={id:uid(),created:new Date().toISOString(),title:state.blocks.map(b=>b.name).filter(Boolean).slice(0,2).join(' + ')||'Раскрой',
   input:JSON.parse(JSON.stringify(args)),snapshot:result,rollId:selected?selected.id:null,rollName:selected?selected.name:null,spentMM:0,posted:false,comparison};
  data.history.unshift(rec);
  if(data.history.length>120)for(let i=data.history.length-1;i>=0&&data.history.length>120;i--)if(!data.history[i].posted)data.history.splice(i,1);
  currentEntryId=rec.id;save();showResult(rec);
  $('resultPanel').scrollIntoView({behavior:'smooth',block:'start'});
  toast('Схема рассчитана и сохранена в историю.');
 }catch(e){hideResult();toast(e.message||'Проверь введённые размеры.');}
}
function showResult(rec){
 result=rec.snapshot;currentEntryId=rec.id;
 const r=result;
 const badge=r.mode==='manual'?'Удобство ручной резки':'Экономия материала';
 $('stats').innerHTML=`<div class="stat"><div class="value">${r.count}</div><div class="lbl">Деталей, шт.</div></div><div class="stat"><div class="value">${r.sheets.length}</div><div class="lbl">Отрезков / рулонов</div></div><div class="stat"><div class="value">${meters(r.usedLength)} м</div><div class="lbl">Занятая длина</div></div><div class="stat"><div class="value">${format(r.efficiency)}%</div><div class="lbl">Полезная площадь</div></div>`;
 $('timeLabel').textContent=dateLabel(rec.created);
 $('resultSubheading').textContent=`${badge} · ${rec.rollName ? 'Материал: '+rec.rollName : 'Без складского рулона'}`;
 const explain=$('cutInstructions');
 if(r.mode==='manual'){
  const bandCount=r.sheets.reduce((s,sh)=>s+(sh.bands||[]).length,0);
  explain.hidden=false;
  explain.innerHTML=`<b>Как резать вручную</b>1. Разметь поперечные полосы по горизонтальным линиям схемы (${bandCount} шт.).<br>2. Каждую полосу раздели продольными прямыми резами на детали.<br>3. Если детали в полосе разной высоты — подрежь их отдельно по размеру.${rec.comparison>0?`<br><strong>Дополнительная длина относительно экономного режима: ${cm(rec.comparison)} см.</strong>`:''}`;
 }else explain.hidden=true;
 renderDeduction(rec);drawScheme($('previewCanvas'),r);
 $('resultPanel').classList.add('visible');
}
function renderDeduction(rec){
 const box=$('deductionArea');
 if(!rec.rollId){box.innerHTML='Схема сохранена в истории. Для учёта расхода выбирай рулон из раздела «Рулоны и остатки» до расчёта.';return;}
 const r=rollById(rec.rollId);
 if(rec.posted){
  box.innerHTML=`<b>✓ Материал списан</b><div>С рулона «${safe(rec.rollName)}» списано ${meters(rec.spentMM)} м. Остаток на складе: ${r?meters(r.remainingMM)+' м':'рулон удалён'}.</div><button class="btn outline" id="undoDeduction" type="button">Отменить списание</button>`;
  $('undoDeduction').addEventListener('click',()=>undoDeduction(rec.id));return;
 }
 const spent=Number(rec.snapshot.usedLength);
 const canPost=!!r && rec.snapshot.sheets.length===1 && Number.isFinite(spent) && spent>0 && r.remainingMM>=spent;
 box.innerHTML=`<b>Учёт материала</b><div>Планируется списать ${meters(spent)} м с «${safe(rec.rollName)}».</div>
 <div>${r?`Текущий остаток: ${meters(r.remainingMM)} м → после списания: ${meters(r.remainingMM-spent)} м`:'Рулон удалён из учёта'}</div>
 <button type="button" class="btn" id="postDeduction" ${canPost?'':'disabled'}>Подтвердить списание</button>${canPost?'':'<div class="hint">Рулон отсутствует либо остатка недостаточно. Проверь данные склада или пересчитай раскрой.</div>'}`;
 if(canPost)$('postDeduction').addEventListener('click',()=>postDeduction(rec.id));
}
function postDeduction(id){
 const rec=data.history.find(x=>x.id===id);if(!rec||rec.posted){toast('Этот раскрой уже списан или больше не существует.');return;}
 const r=rollById(rec.rollId),spent=Number(rec.snapshot.usedLength);
 if(!r || rec.snapshot.sheets.length!==1 || !Number.isFinite(spent) || spent<=0 || r.remainingMM<spent){
  toast('Списание невозможно: проверь остаток рулона.');renderDeduction(rec);return;
 }
 confirmAction({title:'Подтвердить списание?',
  message:`Рулон: ${r.name}. Списываем ${meters(spent)} м. Было ${meters(r.remainingMM)} м, станет ${meters(r.remainingMM-spent)} м. Подтверждай после фактической резки.`,
  acceptText:'Да, списать',onAccept:()=>commitDeduction(id)});
}
function commitDeduction(id){
 // Revalidate on acceptance; prevents duplicate deductions and stale balances.
 const rec=data.history.find(x=>x.id===id);
 if(!rec||rec.posted){toast('Этот раскрой уже списан.');return;}
 const r=rollById(rec.rollId),spent=Number(rec.snapshot.usedLength);
 if(!r||rec.snapshot.sheets.length!==1||!Number.isFinite(spent)||spent<=0||r.remainingMM<spent){
  toast('Списание отменено: остаток изменился или рулон не найден.');renderDeduction(rec);return;
 }
 const before=r.remainingMM,previousLog=data.log;
 r.remainingMM-=spent;rec.posted=true;rec.spentMM=spent;
 data.log=[{id:uid(),at:new Date().toISOString(),rollId:r.id,rollName:r.name,deltaMM:-spent,historyId:rec.id},...data.log].slice(0,500);
 if(!save()){
  r.remainingMM=before;rec.posted=false;rec.spentMM=0;data.log=previousLog;
  toast('Списание НЕ сохранено: память устройства недоступна.');renderDeduction(rec);return;
 }
 renderStockSelect();renderDeduction(rec);renderHistory();renderStock();
 toast(`✓ Списано ${meters(spent)} м. Остаток: ${meters(r.remainingMM)} м.`);
}
function undoDeduction(id){
 const rec=data.history.find(x=>x.id===id);if(!rec||!rec.posted)return;
 const r=rollById(rec.rollId);
 if(!r){toast('Рулон больше не найден.');return;}
 if(r.remainingMM+rec.spentMM>r.totalMM){toast('Невозможно отменить: в карточке рулона изменён остаток. Исправь его вручную.');return;}
 confirmAction({title:'Отменить списание?',
  message:`Вернуть ${meters(rec.spentMM)} м в остаток «${r.name}»?`,
  acceptText:'Да, вернуть',onAccept:()=>commitUndoDeduction(id)});
}
function commitUndoDeduction(id){
 const rec=data.history.find(x=>x.id===id);if(!rec||!rec.posted)return;
 const r=rollById(rec.rollId);
 if(!r||r.remainingMM+rec.spentMM>r.totalMM){toast('Операция отменена: остаток изменился.');return;}
 const before=r.remainingMM,previousSpent=rec.spentMM,previousLog=data.log;
 r.remainingMM+=previousSpent;rec.posted=false;rec.spentMM=0;
 data.log=[{id:uid(),at:new Date().toISOString(),rollId:r.id,rollName:r.name,deltaMM:previousSpent,historyId:rec.id},...data.log].slice(0,500);
 if(!save()){
  r.remainingMM=before;rec.posted=true;rec.spentMM=previousSpent;data.log=previousLog;
  toast('Отмена списания НЕ сохранена: память устройства недоступна.');renderDeduction(rec);return;
 }
 renderStockSelect();renderDeduction(rec);renderHistory();renderStock();toast('✓ Списание отменено. Остаток восстановлен.');
}
function renderHistory(){
 $('historyList').innerHTML=data.history.length?data.history.map(rec=>`<article class="record" data-history="${safe(rec.id)}">
 <div class="record-top"><div><div class="record-title">${safe(rec.title)}</div><div class="record-info">${dateLabel(rec.created)} · ${rec.snapshot.count} деталей · ${meters(rec.snapshot.usedLength)} м<br>${rec.snapshot.mode==='manual'?'Удобство резки':'Экономия'} · ${safe(rec.rollName||'Без складского рулона')}</div></div>
 <span class="chip ${rec.posted?'green':'orange'}">${rec.posted?'Списано':'Расчёт'}</span></div>
 <div class="record-actions"><button class="btn" data-history-action="open" type="button">Открыть схему</button><button class="btn outline" data-history-action="reuse" type="button">Повторить</button><button class="btn outline" data-history-action="delete" type="button">Удалить</button></div></article>`).join(''):'<div class="empty"><strong>История пока пуста</strong>Первый рассчитанный раскрой появится здесь автоматически.</div>';
}
function openHistory(id){const rec=data.history.find(x=>x.id===id);if(!rec)return;setView('cut');showResult(rec);$('resultPanel').scrollIntoView({behavior:'smooth'});}
function reuseHistory(id){const rec=data.history.find(x=>x.id===id);if(!rec)return;
 state={...fresh(),...rec.input,selectedRollId:rec.rollId&&rollById(rec.rollId)?rec.rollId:''};
 if(!state.selectedRollId){state.rollWidth=String(rec.snapshot.rollWidth/10);state.rollLength=rec.snapshot.rollLength?String(rec.snapshot.rollLength/10):'';}
 data.draft=state;save();applyDraft();hideResult();setView('cut');toast('Размеры восстановлены. Проверь параметры и запусти новый расчёт.');
}
function renderStock(){
 const total=data.rolls.reduce((s,r)=>s+r.remainingMM*r.widthMM,0);
 $('stockCount').textContent=`${data.rolls.length} шт.`;
 $('stockTotals').textContent=`На складе ${data.rolls.length} рулонов / обрезков · общая оставшаяся площадь: ${format(total/1e6)} м². Суммировать метры разной ширины некорректно.`;
 $('stockList').innerHTML=data.rolls.length?data.rolls.map(r=>`<article class="record ${lastSavedRollId===r.id?'stock-new':''}" data-roll="${safe(r.id)}">
 <div class="record-top"><div><div class="record-title">${safe(r.name)}</div><div class="record-info">Ширина ${cm(r.widthMM)} см · исходная длина ${meters(r.totalMM)} м<br>Доступно ${meters(r.remainingMM)} м (${format(100*r.remainingMM/r.totalMM)}%)</div></div><span class="chip ${r.remainingMM?'green':'orange'}">${r.remainingMM?'В наличии':'Закончился'}</span></div>
 <div class="progress"><div style="width:${Math.min(100,100*r.remainingMM/r.totalMM)}%"></div></div>
 <div class="record-actions"><button class="btn" data-stock-action="choose" type="button" ${r.remainingMM?'':'disabled'}>В раскрой</button><button class="btn outline" data-stock-action="edit" type="button">Изменить</button><button class="btn outline" data-stock-action="delete" type="button">Удалить</button></div></article>`).join(''):'<div class="empty"><strong>Рулонов пока нет</strong>Добавь первый рулон в форме выше — он появится в калькуляторе.</div>';
 $('stockLog').innerHTML=data.log.length?data.log.slice(0,40).map(l=>`<div class="record" style="padding:10px 13px"><div class="record-top"><div><strong>${safe(l.rollName)}</strong><div class="record-info">${dateLabel(l.at)}</div></div><span class="chip ${l.deltaMM>=0?'green':'orange'}">${l.deltaMM>0?'+':''}${meters(l.deltaMM)} м</span></div></div>`).join(''):'<div class="empty">Списаний ещё не было.</div>';
}
function clearStockForm(){
 $('stockForm').reset();$('editRollId').value='';$('stockRemaining').dataset.auto='yes';
 $('stockFormTitle').textContent='Добавить рулон';$('saveRollBtn').textContent='+ Сохранить рулон';
}
function stockMessage(msg,error=false){
 const el=$('stockStatus');el.textContent=msg;el.hidden=false;
 el.classList.toggle('is-error',error);
}
function editRoll(id){const r=rollById(id);if(!r)return;
 $('editRollId').value=id;$('stockName').value=r.name;$('stockWidth').value=editableCM(r.widthMM);$('stockTotal').value=editableCM(r.totalMM);$('stockRemaining').value=editableCM(r.remainingMM);$('stockRemaining').dataset.auto='no';
 $('stockFormTitle').textContent='Редактирование рулона';$('saveRollBtn').textContent='Сохранить изменения';$('stockFormPanel').scrollIntoView({behavior:'smooth'});
}
function submitRoll(e){
 if(e && typeof e.preventDefault==='function')e.preventDefault();
 const diag=$('saveDiagnostics');
 if(diag)diag.textContent='Версия 2.3 · кнопка нажата · проверяю данные…';
 stockMessage('Проверяю данные рулона…');
 try{
 const name=$('stockName').value.trim();if(!name)throw Error('Укажи название или маркировку рулона.');
 const widthMM=parseMM($('stockWidth').value,'Ширина');
 const totalMM=parseMM($('stockTotal').value,'Общая длина');
 // For a new roll, the remaining length equals the total by default.
 const remainder=$('stockRemaining').value.trim();
 const remainingMM=remainder?parseMM(remainder,'Осталось'):totalMM;
 if(widthMM<10||widthMM>30000)throw Error('Ширина должна быть от 1 до 3000 см.');
 if(totalMM<10||totalMM>100000)throw Error('Длина должна быть от 1 до 10 000 см.');
 if(remainingMM>totalMM)throw Error('Остаток не может превышать общую длину.');
 const existing=rollById($('editRollId').value);
 const backup=data.rolls.map(r=>({...r}));
 let id;
 if(existing){id=existing.id;Object.assign(existing,{name,widthMM,totalMM,remainingMM});}
 else{id=uid();data.rolls.unshift({id,name,widthMM,totalMM,remainingMM});}
 if(!save()){
  data.rolls=backup;
  throw Error('Данные не удалось сохранить в память. Проверь настройки устройства и свободное место.');
 }
 lastSavedRollId=id;
 clearStockForm();renderStock();renderStockSelect();
 stockMessage(`✓ Рулон «${name}» ${existing?'обновлён':'сохранён'}! Он уже в списке «Склад рулонов» ниже и доступен в калькуляторе. Осталось ${meters(remainingMM)} м.`);
 if(diag)diag.textContent='Версия 2.3 · успешно сохранено '+new Date().toLocaleTimeString('ru-RU');
 toast('✓ Рулон сохранён.');
 requestAnimationFrame(()=>document.querySelector(`[data-roll="${id}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}));
 }catch(err){if(diag)diag.textContent='Версия 2.3 · ошибка сохранения';stockMessage(err.message||'Проверь данные рулона.',true);toast(err.message||'Проверь данные рулона.');}
}
function stockAction(action,id){const r=rollById(id);if(!r)return;
 if(action==='choose'){state.selectedRollId=r.id;save();renderStockSelect();hideResult();setView('cut');toast('Рулон выбран. Добавляй детали.');return;}
 if(action==='edit'){editRoll(id);return;}
 if(action==='delete'){
  if(data.history.some(h=>h.rollId===id&&h.posted)){toast('Сначала отмени все списания с этого рулона в истории.');return;}
  confirmAction({title:'Удалить рулон?',message:`Удалить «${r.name}» из учёта?`,acceptText:'Да, удалить',onAccept:()=>{
   if(data.history.some(h=>h.rollId===id&&h.posted)){toast('Сначала отмени списания по этому рулону.');return;}
   const oldRolls=data.rolls,oldSelected=state.selectedRollId;
   data.rolls=data.rolls.filter(x=>x.id!==id);
   if(state.selectedRollId===id)state.selectedRollId='';
   if(!save()){data.rolls=oldRolls;state.selectedRollId=oldSelected;toast('Удаление не удалось сохранить.');return;}
   renderStock();renderStockSelect();toast('Рулон удалён.');
  }});
 }
}
function init(){
 $('stockRemaining').dataset.auto='yes';
 $('confirmCancel').addEventListener('click',closeConfirmation);
 $('confirmAccept').addEventListener('click',acceptConfirmation);
 $('confirmOverlay').addEventListener('click',e=>{if(e.target===$('confirmOverlay'))closeConfirmation();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('confirmOverlay').hidden)closeConfirmation();});
 window.addEventListener('error',e=>{
   const diag=$('saveDiagnostics');
   if(diag)diag.textContent='Ошибка приложения: '+(e.message||'проверь сборку');
 });
 window.addEventListener('unhandledrejection',e=>{
   const diag=$('saveDiagnostics');
   if(diag)diag.textContent='Ошибка приложения: '+(e.reason?.message||'ошибка операции');
 });
 if(window.AndroidApp){$('installBtn').style.display='none';$('installNote').style.display='none';}
 applyDraft();
 document.querySelectorAll('.nav-link[data-go]').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.go)));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
 $('stockSelect').addEventListener('change',e=>{
  if(!state.selectedRollId){state.rollWidth=$('rollWidth').value.trim();state.rollLength=$('rollLength').value.trim();}
  state.selectedRollId=e.target.value;save();renderStockSelect();hideResult();
 });
 ['rollWidth','rollLength','gap'].forEach(id=>$(id).addEventListener('input',()=>{fields();hideResult();}));
 $('email').addEventListener('input',fields);
 $('rotate').addEventListener('change',()=>{fields();hideResult();});
 document.querySelectorAll('input[name="cutMode"]').forEach(el=>el.addEventListener('change',()=>{fields();hideResult();}));
 $('blocks').addEventListener('input',e=>{
  const b=state.blocks.find(x=>x.id===e.target.closest('[data-block]')?.dataset.block);if(!b)return;
  if(e.target.dataset.field==='block-name')b.name=e.target.value;
  else{const r=b.rows.find(x=>x.id===e.target.closest('[data-row]')?.dataset.row);if(r&&['w','h','qty'].includes(e.target.dataset.field))r[e.target.dataset.field]=e.target.value;}
  save();hideResult();
 });
 $('blocks').addEventListener('click',e=>{
  const btn=e.target.closest('[data-action]');if(!btn)return;
  const index=state.blocks.findIndex(b=>b.id===btn.closest('[data-block]')?.dataset.block);if(index<0)return;
  const action=btn.dataset.action;
  if(action==='add-row')state.blocks[index].rows.push({id:uid(),w:'',h:'',qty:'1'});
  if(action==='remove-row'){
   const id=btn.closest('[data-row]')?.dataset.row;
   state.blocks[index].rows=state.blocks[index].rows.filter(r=>r.id!==id);
   if(!state.blocks[index].rows.length)state.blocks[index].rows.push({id:uid(),w:'',h:'',qty:'1'});
  }
  if(action==='remove-block'){
   if(state.blocks.length===1){toast('Нужен хотя бы один оконный блок.');return;}
   state.blocks.splice(index,1);
  }
  save();renderBlocks();hideResult();
 });
 $('addBlock').addEventListener('click',()=>{state.blocks.push({id:uid(),name:`Оконный блок ${state.blocks.length+1}`,rows:[{id:uid(),w:'',h:'',qty:'1'}]});save();renderBlocks();hideResult();});
 $('demoBtn').addEventListener('click',()=>{
  state.blocks=[{id:uid(),name:'Оконный блок 1',rows:[{id:uid(),w:'123',h:'40',qty:'4'},{id:uid(),w:'123',h:'70',qty:'4'}]},{id:uid(),name:'Оконный блок 2',rows:[{id:uid(),w:'82',h:'39',qty:'1'},{id:uid(),w:'92',h:'49',qty:'1'}]}];
  save();renderBlocks();hideResult();toast('Пример загружен. Теперь нажми «Рассчитать раскрой».');
 });
 $('clearBtn').addEventListener('click',()=>confirmAction({title:'Очистить детали?',message:'Удалить размеры деталей? Рулоны и историю это не затронет.',acceptText:'Очистить',onAccept:()=>{state.blocks=fresh().blocks;save();renderBlocks();hideResult();}}));
 $('calculateBtn').addEventListener('click',calculate);
 $('downloadBtn').addEventListener('click',downloadImage);$('shareBtn').addEventListener('click',shareImage);$('copyEmailBtn').addEventListener('click',copyEmail);
 $('historyList').addEventListener('click',e=>{
  const btn=e.target.closest('[data-history-action]');if(!btn)return;
  const id=btn.closest('[data-history]')?.dataset.history;
  if(btn.dataset.historyAction==='open')openHistory(id);
  if(btn.dataset.historyAction==='reuse')reuseHistory(id);
  if(btn.dataset.historyAction==='delete'){
   const rec=data.history.find(x=>x.id===id);if(!rec)return;
   if(rec.posted){toast('Сначала открой схему и отмени списание.');return;}
   confirmAction({title:'Удалить схему?',message:'Удалить эту схему из истории? Списание не производится.',acceptText:'Удалить',onAccept:()=>{
    const oldHistory=data.history;
    data.history=data.history.filter(x=>x.id!==id);
    if(!save()){data.history=oldHistory;toast('Удаление не удалось сохранить.');return;}
    if(currentEntryId===id)hideResult();renderHistory();
   }});
  }
 });
 $('stockList').addEventListener('click',e=>{const btn=e.target.closest('[data-stock-action]');if(btn)stockAction(btn.dataset.stockAction,btn.closest('[data-roll]')?.dataset.roll);});
 $('stockForm').addEventListener('submit',submitRoll);
 $('saveRollBtn').addEventListener('click',submitRoll);
 $('resetStockForm').addEventListener('click',()=>{clearStockForm();$('stockStatus').hidden=true;});
 $('stockTotal').addEventListener('input',()=>{if(!$('editRollId').value && (!$('stockRemaining').value || $('stockRemaining').dataset.auto==='yes')){$('stockRemaining').value=$('stockTotal').value;$('stockRemaining').dataset.auto='yes';}});
 $('stockRemaining').addEventListener('input',()=>{$('stockRemaining').dataset.auto='no';});
 $('installBtn').addEventListener('click',async()=>{if(installPrompt){const p=installPrompt;installPrompt=null;p.prompt();try{await p.userChoice;}catch(e){}}else{$('installNote').classList.toggle('show');$('installNote').scrollIntoView({block:'nearest',behavior:'smooth'});}});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
 if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
 function makeLayout(r){
   const W=1000, left=85, chartWidth=830, scale=chartWidth/r.rollWidth, top=160;
   let y=top;
   const all=[];
   for(const sheet of r.sheets){
     const graphTop=y+41;
     const graphHeight=Math.max(2,sheet.usedLength*scale);
     all.push({sheet,graphTop,graphHeight,labelY:y});
     y=graphTop+graphHeight+67;
   }
   return {W,left,chartWidth,scale,all,height:y+70};
 }
 function roundRect(ctx,x,y,w,h,r){const R=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+R,y);ctx.arcTo(x+w,y,x+w,y+h,R);ctx.arcTo(x+w,y+h,x,y+h,R);ctx.arcTo(x,y+h,x,y,R);ctx.arcTo(x,y,x+w,y,R);ctx.closePath();}
 function drawScheme(canvas,r){
   const lo=makeLayout(r), shrink=Math.min(1,Math.sqrt(24000000/(lo.W*lo.height)),16000/lo.height);
   canvas.width=Math.max(1,Math.floor(lo.W*shrink));canvas.height=Math.max(1,Math.floor(lo.height*shrink));
   const ctx=canvas.getContext('2d');ctx.scale(shrink,shrink);
   ctx.fillStyle='#fff';ctx.fillRect(0,0,lo.W,lo.height);
   ctx.fillStyle='#102d4d';ctx.font='bold 32px system-ui, sans-serif';ctx.fillText('СХЕМА РАСКРОЯ',lo.left,65);
   ctx.font='16px system-ui, sans-serif';ctx.fillStyle='#5d718a';ctx.fillText(`Ширина рулона: ${CORE.fromMM(r.rollWidth)} см  •  ${r.count} деталей  •  ${r.sheets.length} рулон(ов)`,lo.left,97);
   ctx.fillText(`Расход: ${format(r.usedLength/1000)} м  •  полезная площадь: ${format(r.efficiency)}%  •  режим: ${r.mode==='manual'?'ручная резка':'экономия'}`,lo.left,123);
   const colors=new Map(r.blocks.map((b,i)=>[b.id,palette[i%palette.length]]));
   for(const lay of lo.all){
     const {sheet,graphTop,graphHeight,labelY}=lay;
     ctx.font='bold 18px system-ui, sans-serif';ctx.fillStyle='#163454';ctx.fillText(`Рулон № ${sheet.index}`,lo.left,labelY+20);
     ctx.font='14px system-ui, sans-serif';ctx.fillStyle='#596e84';
     let sub=`Размещено ${sheet.pieces.length} шт.  •  длина раскладки: ${CORE.fromMM(sheet.usedLength)} см`;
     if(r.rollLength)sub+=`  •  остаток по длине: ${CORE.fromMM(r.rollLength-sheet.usedLength)} см`;
     ctx.fillText(sub,lo.left+145,labelY+20);
     ctx.fillStyle='#f9fbff';ctx.fillRect(lo.left,graphTop,lo.chartWidth,graphHeight);
     ctx.lineWidth=1;ctx.strokeStyle='#45617b';ctx.strokeRect(lo.left,graphTop,lo.chartWidth,graphHeight);
     ctx.save();ctx.beginPath();ctx.rect(lo.left,graphTop,lo.chartWidth,graphHeight);ctx.clip();
     for (const piece of sheet.pieces){
       const x=lo.left+piece.x*lo.scale+0.5, y=graphTop+piece.y*lo.scale+0.5;
       const w=piece.w*lo.scale-1,h=piece.h*lo.scale-1;
       const color=colors.get(piece.blockId)||palette[0];
       ctx.fillStyle=color;ctx.fillRect(x,y,w,h);
       ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
       ctx.save();ctx.beginPath();ctx.rect(x+3,y+2,Math.max(0,w-6),Math.max(0,h-4));ctx.clip();
       if(w>62 && h>24){
         const fs=Math.max(10,Math.min(17,w/11,h/3.5));
         ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle='#fff';
         ctx.font=`bold ${fs}px system-ui, sans-serif`;
         ctx.fillText(`${CORE.fromMM(piece.w)} × ${CORE.fromMM(piece.h)}`,x+w/2,y+h/2-(h>48?8:0));
         if(h>48&&w>94){ctx.font=`${Math.max(10,fs-3)}px system-ui, sans-serif`;ctx.fillText(piece.blockName,x+w/2,y+h/2+12,w-10);}
       }
       ctx.restore();
     }
     ctx.restore();
     if(r.mode==='manual' && sheet.bands && sheet.bands.length>1){
       ctx.save();ctx.strokeStyle='#0c365f';ctx.lineWidth=3;ctx.setLineDash([11,8]);
       for(let i=0;i<sheet.bands.length-1;i++){
         const band=sheet.bands[i],lineY=graphTop+(band.y+band.height)*lo.scale;
         ctx.beginPath();ctx.moveTo(lo.left,lineY);ctx.lineTo(lo.left+lo.chartWidth,lineY);ctx.stroke();
       }
       ctx.restore();
     }
     ctx.font='13px system-ui, sans-serif';ctx.fillStyle='#64748b';
     ctx.fillText(`${CORE.fromMM(r.rollWidth)} см`,lo.left+lo.chartWidth/2-32,graphTop-6);
     ctx.fillText(`${CORE.fromMM(sheet.usedLength)} см`,lo.left+lo.chartWidth+8,graphTop+Math.min(21,graphHeight));
   }
   let lx=lo.left,ly=lo.height-50;
   ctx.font='13px system-ui, sans-serif';
   for(let i=0;i<r.blocks.length;i++){
     const name=r.blocks[i].name||`Блок ${i+1}`;
     const cell=Math.min(230,Math.max(115,name.length*7+27));
     if(lx+cell>lo.W-30){ly+=20;lx=lo.left;}
     ctx.fillStyle=palette[i%palette.length];ctx.fillRect(lx,ly-10,12,12);
     ctx.fillStyle='#455b75';ctx.fillText(name.slice(0,28),lx+17,ly);
     lx+=cell;
   }
   ctx.fillStyle='#8a9bad';ctx.font='12px system-ui, sans-serif';ctx.fillText(`Дата: ${new Date().toLocaleDateString('ru-RU')}  •  Площадь деталей: ${format(r.totalArea/1e6)} м²  •  отходы: ${format(r.wasteArea/1e6)} м²`,lo.left,lo.height-13);
 }
function filename(){const e=entry(),d=e?new Date(e.created):new Date();return `raskroy_${d.toISOString().slice(0,10)}_${e?e.id.slice(-5):'new'}.png`;}
function imageBlob(){return new Promise((resolve,reject)=>{$('previewCanvas').toBlob(b=>b?resolve(b):reject(new Error('Не получилось создать PNG.')),'image/png');});}
async function downloadImage(){if(!result)return;
 if(window.AndroidApp?.savePng){try{window.AndroidApp.savePng($('previewCanvas').toDataURL('image/png'),filename());toast('Сохраняем PNG в Галерею.');}catch(e){toast('Ошибка: '+e.message);}return;}
 try{const blob=await imageBlob();const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=filename();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);toast('PNG сохранён.');}catch(e){toast(e.message);}
}
async function copyEmail(){const email=$('email').value.trim();if(!email){toast('Введи адрес получателя.');return;}if(window.AndroidApp?.copyText){window.AndroidApp.copyText(email);return;}try{await navigator.clipboard.writeText(email);toast('Адрес скопирован.');}catch(e){toast('Выдели адрес вручную.');}}
async function shareImage(){if(!result)return;
 const email=$('email').value.trim();
 if(window.AndroidApp?.sharePng){try{window.AndroidApp.sharePng($('previewCanvas').toDataURL('image/png'),filename(),email);toast('Готовим схему для отправки.');}catch(e){toast('Ошибка: '+e.message);}return;}
 if(email&&navigator.clipboard?.writeText)navigator.clipboard.writeText(email).catch(()=>{});
 try{
  const blob=await imageBlob(),file=new File([blob],filename(),{type:'image/png'});
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   try{await navigator.share({title:'Схема раскроя',text:'Схема раскроя плёнки.',files:[file]});}
   catch(e){if(e.name!=='AbortError')toast('Не удалось отправить. Сохрани PNG и прикрепи к письму.');}
  }else{await downloadImage();toast('PNG сохранён. Прикрепи его к письму.');}
 }catch(e){toast('Ошибка подготовки PNG: '+e.message);}
}
init();
})();
