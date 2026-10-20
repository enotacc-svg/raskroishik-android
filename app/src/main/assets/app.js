(() => {
 'use strict';
 const CORE=window.CutCore;
 const STORE='raskroishik-mobile-v1';
 const $=id=>document.getElementById(id);
 const palette=['#2d72d2','#129c98','#e48b25','#8a63d2','#d35483','#527e4e','#a56442','#328caf','#b674a8'];
 const uid=()=>`id${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
 const fresh=()=>({rollWidth:'152',rollLength:'',gap:'0',rotate:true,email:'',blocks:[{id:uid(),name:'Оконный блок 1',rows:[{id:uid(),w:'',h:'',qty:'1'}]}]});
 function load(){try{const v=JSON.parse(localStorage.getItem(STORE));if(v&&Array.isArray(v.blocks)&&v.blocks.length)return v;}catch(e){}return fresh();}
 let state=load(),result=null,installPrompt=null,toastTimer;
 function save(){try{localStorage.setItem(STORE,JSON.stringify(state));}catch(e){}}
 function safe(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
 function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4100);}
 function fields(){state.rollWidth=$('rollWidth').value.trim();state.rollLength=$('rollLength').value.trim();state.gap=$('gap').value.trim();state.rotate=$('rotate').checked;state.email=$('email').value.trim();save();}
 function hideResult(){result=null;$('resultPanel').classList.remove('visible');}
 function renderBlocks(){
   $('blocks').innerHTML=state.blocks.map((b,i)=>`<article class="block" data-block="${safe(b.id)}">
    <div class="block-head"><span class="block-dot" style="background:${palette[i%palette.length]}"></span><input class="block-name" data-field="block-name" aria-label="Название оконного блока" value="${safe(b.name)}"/><button class="remove" data-action="remove-block" title="Удалить оконный блок" aria-label="Удалить оконный блок">×</button></div>
    <div class="colheads"><span>Ширина, см</span><span>Высота, см</span><span>Шт.</span><span></span></div>
    <div class="rows">${b.rows.map(r=>`<div class="piece-row" data-row="${safe(r.id)}"><input data-field="w" inputmode="decimal" aria-label="Ширина детали" placeholder="Напр. 123" value="${safe(r.w)}"/><input data-field="h" inputmode="decimal" aria-label="Высота детали" placeholder="Напр. 40" value="${safe(r.h)}"/><input data-field="qty" inputmode="numeric" aria-label="Количество деталей" value="${safe(r.qty)}"/><button class="remove" data-action="remove-row" title="Удалить деталь" aria-label="Удалить деталь">×</button></div>`).join('')}</div>
    <div class="block-foot"><button class="linkbtn" data-action="add-row" type="button">+ Добавить деталь</button><span class="mini">${b.rows.length} ${b.rows.length===1?'тип':'тип(ов)'}</span></div></article>`).join('');
 }
 function init(){
   if(window.AndroidApp){$('installBtn').style.display='none';$('installNote').style.display='none';}
   $('rollWidth').value=state.rollWidth;
   $('rollLength').value=state.rollLength;
   $('gap').value=state.gap;
   $('rotate').checked=state.rotate;
   $('email').value=state.email||'';
   renderBlocks();
   ['rollWidth','rollLength','gap','email'].forEach(id=>$(id).addEventListener('input',()=>{fields();hideResult();}));
   $('rotate').addEventListener('change',()=>{fields();hideResult();});
   $('blocks').addEventListener('input',e=>{
     const blockEl=e.target.closest('[data-block]');if(!blockEl)return;
     const block=state.blocks.find(b=>b.id===blockEl.dataset.block);if(!block)return;
     if(e.target.dataset.field==='block-name') block.name=e.target.value;
     else {const rowEl=e.target.closest('[data-row]');const row=block.rows.find(r=>r.id===rowEl?.dataset.row);if(row&&['w','h','qty'].includes(e.target.dataset.field))row[e.target.dataset.field]=e.target.value;}
     save();hideResult();
   });
   $('blocks').addEventListener('click',e=>{
     const btn=e.target.closest('[data-action]');if(!btn)return;
     const blockEl=btn.closest('[data-block]');const bi=state.blocks.findIndex(b=>b.id===blockEl?.dataset.block);if(bi<0)return;
     const action=btn.dataset.action;
     if(action==='add-row')state.blocks[bi].rows.push({id:uid(),w:'',h:'',qty:'1'});
     if(action==='remove-row'){
       const id=btn.closest('[data-row]')?.dataset.row;
       state.blocks[bi].rows=state.blocks[bi].rows.filter(r=>r.id!==id);
       if(!state.blocks[bi].rows.length)state.blocks[bi].rows.push({id:uid(),w:'',h:'',qty:'1'});
     }
     if(action==='remove-block'){
       if(state.blocks.length===1){toast('Нужен хотя бы один оконный блок.');return;}
       state.blocks.splice(bi,1);
     }
     save();renderBlocks();hideResult();
   });
   $('addBlock').addEventListener('click',()=>{state.blocks.push({id:uid(),name:`Оконный блок ${state.blocks.length+1}`,rows:[{id:uid(),w:'',h:'',qty:'1'}]});save();renderBlocks();hideResult();});
   $('demoBtn').addEventListener('click',()=>{
     state.blocks=[{id:uid(),name:'Оконный блок 1',rows:[{id:uid(),w:'123',h:'40',qty:'4'},{id:uid(),w:'123',h:'70',qty:'4'}]},{id:uid(),name:'Оконный блок 2',rows:[{id:uid(),w:'82',h:'39',qty:'1'},{id:uid(),w:'92',h:'49',qty:'1'}]}];
     state.rollWidth='152';state.rollLength='';state.gap='0';state.rotate=true;
     $('rollWidth').value='152';$('rollLength').value='';$('gap').value='0';$('rotate').checked=true;
     save();renderBlocks();hideResult();toast('Пример загружен. Нажми «Рассчитать раскрой».');
   });
   $('clearBtn').addEventListener('click',()=>{if(!window.confirm('Удалить все оконные блоки и размеры?'))return;const email=state.email;state=fresh();state.email=email;save();$('rollWidth').value=state.rollWidth;$('rollLength').value='';$('gap').value='0';$('rotate').checked=true;renderBlocks();hideResult();});
   $('calculateBtn').addEventListener('click',calculate);
   $('downloadBtn').addEventListener('click',downloadImage);
   $('shareBtn').addEventListener('click',shareImage);
   $('copyEmailBtn').addEventListener('click',copyEmail);
   $('installBtn').addEventListener('click',async()=>{
     if(installPrompt){const p=installPrompt;installPrompt=null;p.prompt();try{await p.userChoice;}catch(e){} }
     else{$('installNote').classList.toggle('show');$('installNote').scrollIntoView({block:'nearest',behavior:'smooth'});}
   });
   window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
   if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
 }
 function format(n){return Number(n).toLocaleString('ru-RU',{maximumFractionDigits:1});}
 function calculate(){
   fields();
   try{
     result=CORE.solve(state);
     const r=result;
     $('stats').innerHTML=`<div class="stat"><div class="value">${r.count}</div><div class="lbl">Деталей, шт.</div></div><div class="stat"><div class="value">${r.sheets.length}</div><div class="lbl">Рулонов / отрезков</div></div><div class="stat"><div class="value">${format(r.usedLength/1000)} м</div><div class="lbl">Суммарная занятая длина</div></div><div class="stat"><div class="value">${format(r.efficiency)}%</div><div class="lbl">Полезная площадь</div></div>`;
     $('timeLabel').textContent=new Date().toLocaleDateString('ru-RU');
     drawScheme($('previewCanvas'),r);
     $('resultPanel').classList.add('visible');
     $('resultPanel').scrollIntoView({behavior:'smooth',block:'start'});
     toast('Готово! Схему можно сохранить или отправить.');
   }catch(e){hideResult();toast(e.message||'Проверь введённые размеры.');}
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
   ctx.fillText(`Расход длины: ${format(r.usedLength/1000)} м  •  полезная площадь: ${format(r.efficiency)}%  •  поворот: ${r.rotate?'да':'нет'}`,lo.left,123);
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
 function filename(){const d=new Date();return `raskroy_${d.toISOString().slice(0,10)}.png`;}
 function imageBlob(){return new Promise((resolve,reject)=>{$('previewCanvas').toBlob(b=>b?resolve(b):reject(new Error('Не получилось создать PNG.')),'image/png');});}
 async function downloadImage(){if(!result)return;if(window.AndroidApp?.savePng){try{window.AndroidApp.savePng($('previewCanvas').toDataURL('image/png'),filename());toast('Сохраняем PNG в Галерею.');}catch(e){toast('Ошибка: '+e.message);}return;}try{const blob=await imageBlob();const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);toast('PNG сохранён в загрузки.');}catch(e){toast(e.message);}}
 async function copyEmail(){const email=$('email').value.trim();if(!email){toast('Введи адрес получателя.');return;}if(window.AndroidApp?.copyText){window.AndroidApp.copyText(email);return;}try{await navigator.clipboard.writeText(email);toast('Адрес email скопирован.');}catch(e){toast('Не удалось скопировать адрес. Выдели его вручную.');}}
 async function shareImage(){
   if(!result)return;
   const email=$('email').value.trim();
   if(window.AndroidApp?.sharePng){try{window.AndroidApp.sharePng($('previewCanvas').toDataURL('image/png'),filename(),email);toast('Готовим схему для отправки.');}catch(e){toast('Ошибка: '+e.message);}return;}
   if(email&&navigator.clipboard?.writeText)navigator.clipboard.writeText(email).catch(()=>{});
   try{
     const blob=await imageBlob();
     const file=new File([blob],filename(),{type:'image/png'});
     if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
       try{
         await navigator.share({title:'Схема раскроя',text:'Схема раскроя плёнки. Выбери почтовое приложение и укажи получателя.',files:[file]});
       }catch(e){if(e.name!=='AbortError')toast('Не удалось открыть отправку. Сохрани PNG и прикрепи его к письму.');}
     }else{
       const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=filename();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);
       toast('На этом устройстве прямая отправка недоступна: PNG сохранён. Прикрепи его к письму.');
     }
   }catch(e){toast('Не удалось подготовить изображение: '+e.message);}
 }
 init();
})();
