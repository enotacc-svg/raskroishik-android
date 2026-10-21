/* Раскройщик — прямоугольная упаковка MaxRects, размеры внутри в мм. */
(function (root) {
  'use strict';
  const toMM = value => Math.round(Number(String(value).replace(',', '.')) * 10);
  const fromMM = value => (value / 10).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const areaCM2 = n => n / 100;

  function fits(w, h, W, H, rotate) {
    return (w <= W && h <= H) || (rotate && h <= W && w <= H);
  }
  function intersect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function contained(a, b) {
    return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  }
  function splitFree(rectangles, used) {
    const next = [];
    for (const f of rectangles) {
      if (!intersect(f, used)) { next.push(f); continue; }
      if (used.x > f.x) next.push({x:f.x,y:f.y,w:used.x-f.x,h:f.h});
      if (used.x + used.w < f.x + f.w) next.push({x:used.x+used.w,y:f.y,w:f.x+f.w-used.x-used.w,h:f.h});
      if (used.y > f.y) next.push({x:f.x,y:f.y,w:f.w,h:used.y-f.y});
      if (used.y + used.h < f.y + f.h) next.push({x:f.x,y:used.y+used.h,w:f.w,h:f.y+f.h-used.y-used.h});
    }
    return next.filter((a, i) => a.w > 0 && a.h > 0 && !next.some((b, j) => i !== j && contained(a, b) && (a.w*a.h < b.w*b.h || (a.w*a.h === b.w*b.h && j < i))));
  }
  function position(sheet, p, rollWidth, rollHeight, gap, rotate, method) {
    let best = null;
    for (const f of sheet.free) {
      for (const flipped of (rotate && p.w !== p.h ? [false, true] : [false])) {
        const w = (flipped ? p.h : p.w) + gap;
        const h = (flipped ? p.w : p.h) + gap;
        if (w > f.w || h > f.h || f.x + w > rollWidth + gap || f.y + h > rollHeight + gap) continue;
        const dw = f.w - w, dh = f.h - h;
        let score;
        if (method === 'bottom') score = [f.y+h, f.x, Math.min(dw,dh), dw*dh];
        else if (method === 'area') score = [f.w*f.h - w*h, Math.min(dw,dh), f.y+h, f.x];
        else score = [Math.min(dw,dh), Math.max(dw,dh), f.y+h, f.x];
        if (!best || score.some((s,i) => s < best.score[i] && score.slice(0,i).every((v,k)=>v===best.score[k]))) {
          best = {x:f.x,y:f.y,w,h,flipped,score};
        }
      }
    }
    return best;
  }
  function newSheet(W,H,gap) {
    return { free:[{x:0,y:0,w:W+gap,h:H+gap}], pieces:[], usedLength:0 };
  }
  function place(sheet, piece, pos, gap) {
    sheet.free = splitFree(sheet.free, pos);
    const w = pos.w-gap, h = pos.h-gap;
    sheet.pieces.push({...piece,x:pos.x,y:pos.y,w,h,rotated:pos.flipped});
    sheet.usedLength = Math.max(sheet.usedLength, pos.y+h);
  }
  function arrange(parts, W, L, gap, rotate, method, order) {
    const pieces = [...parts].sort(order);
    const isFinite = L > 0;
    const possibleHeight = pieces.reduce((sum,p) => sum + Math.max(p.w,p.h) + gap,0) + gap;
    const H = isFinite ? L : Math.max(possibleHeight, W);
    const sheets = [newSheet(W,H,gap)];
    for (const p of pieces) {
      let selected = null, sheetIndex = -1;
      for (let i=0; i<sheets.length; i++) {
        const candidate = position(sheets[i], p, W, H, gap, rotate, method);
        if (candidate) { selected=candidate; sheetIndex=i; break; }
      }
      if (!selected) {
        const fresh = newSheet(W,H,gap);
        selected = position(fresh, p, W, H, gap, rotate, method);
        if (!selected) return null;
        sheets.push(fresh);
        sheetIndex=sheets.length-1;
      }
      place(sheets[sheetIndex], p, selected, gap);
    }
    return {sheets, usedLength:sheets.reduce((sum,s)=>sum+s.usedLength,0)};
  }
  // Гильотинная схема для ручной резки: сначала поперечные полосы,
  // затем продольное разделение деталей внутри каждой полосы.
  // Каждая полоса всегда режется по всей ширине рулона.
  function arrangeManual(parts, W, L, gap, rotate, variant) {
    const sorted = [...parts].sort((a,b) => {
      const ah=Math.max(a.w,a.h),bh=Math.max(b.w,b.h);
      if (variant===0) return bh-ah || b.w*b.h-a.w*a.h;
      if (variant===1) return b.w*b.h-a.w*a.h || bh-ah;
      if (variant===2) return Math.min(b.w,b.h)-Math.min(a.w,a.h) || bh-ah;
      return b.h-a.h || b.w-a.w;
    });
    const sheets=[{pieces:[],usedLength:0,bands:[]}];
    let sheet=sheets[0];
    let band=null;
    const maxL=L||Number.POSITIVE_INFINITY;
    for(const p of sorted) {
      let options=[{w:p.w,h:p.h,flipped:false}];
      if(rotate&&p.w!==p.h) options.push({w:p.h,h:p.w,flipped:true});
      options=options.filter(o=>o.w<=W && o.h<=maxL);
      if(!options.length)return null;
      const candidate=[];
      if(band) for(const o of options){
        const remaining=W-band.nextX;
        const addedHeight=Math.max(0,o.h-band.height);
        if(o.w+(band.items.length?gap:0)<=remaining && band.y+band.height+addedHeight<=maxL){
          // Tiny tolerance favors sharing a row of similarly high pieces.
          candidate.push({o,newBand:false,score:addedHeight*W*6 + (band.height-o.h > 0 ? Math.abs(band.height-o.h)*o.w*.3:0) + (remaining-o.w)*.03});
        }
      }
      for(const o of options){
        const y=band ? band.y+band.height+gap : 0;
        if(y+o.h<=maxL)candidate.push({o,newBand:true,score:o.h*W + (W-o.w)*.04 + (band?W*gap:0)});
      }
      candidate.sort((a,b)=>a.score-b.score || Number(a.newBand)-Number(b.newBand));
      let choice=candidate[0];
      if(!choice){
        sheet={pieces:[],usedLength:0,bands:[]};sheets.push(sheet);band=null;
        options.sort((a,b)=>a.h-b.h || b.w-a.w);
        choice={o:options[0],newBand:true};
      }
      if(choice.newBand){
        const y=band ? band.y+band.height+gap : 0;
        band={y,height:choice.o.h,nextX:0,items:[]};
        sheet.bands.push(band);
      }
      const x=band.items.length ? band.nextX+gap : 0;
      const o=choice.o;
      const piece={...p,x,y:band.y,w:o.w,h:o.h,rotated:o.flipped};
      band.items.push(piece.id);
      band.nextX=x+o.w;
      band.height=Math.max(band.height,o.h);
      sheet.pieces.push(piece);
      sheet.usedLength=Math.max(sheet.usedLength,band.y+band.height);
    }
    return {sheets,usedLength:sheets.reduce((s,v)=>s+v.usedLength,0)};
  }
  function solve(data) {
    const W = toMM(data.rollWidth);
    const L = data.rollLength === '' || data.rollLength === undefined || data.rollLength === null ? 0 : toMM(data.rollLength);
    const gap = toMM(data.gap || 0);
    if (!Number.isFinite(W) || W < 10 || W > 30000) throw Error('Ширина рулона должна быть от 1 до 3000 см.');
    if (!Number.isFinite(L) || L < 0 || (L > 0 && L < 10) || L > 100000) throw Error('Длина рулона должна быть от 1 до 10 000 см или не указана.');
    if (!Number.isFinite(gap) || gap < 0 || gap > 500) throw Error('Зазор должен быть от 0 до 50 см.');
    const rotate = data.rotate !== false;
    const parts = [];
    for (const block of data.blocks || []) {
      for (const row of block.rows || []) {
        if (String(row.w ?? '').trim()==='' && String(row.h ?? '').trim()==='') continue;
        const w=toMM(row.w), h=toMM(row.h), q=Number(row.qty);
        if (!Number.isFinite(w) || w<=0 || !Number.isFinite(h) || h<=0) throw Error('Проверь размеры деталей: нужны два положительных числа.');
        if (!Number.isInteger(q) || q<1 || q>150) throw Error('Количество каждой детали — от 1 до 150 шт.');
        if (w>30000 || h>100000) throw Error('Проверь размер детали: он слишком большой.');
        if (!fits(w,h,W,L || 100000000,rotate)) {
          const name = block.name || 'Блок';
          throw Error(`${name}: деталь ${fromMM(w)} × ${fromMM(h)} см не помещается в рулон${rotate ? '' : ' без поворота'}.`);
        }
        for (let k=1;k<=q;k++) parts.push({id:`${row.id}-${k}`,w,h,originalW:w,originalH:h,blockId:block.id,blockName:block.name||'Блок',num:k,rowId:row.id});
      }
    }
    if (!parts.length) throw Error('Добавь хотя бы одну деталь с шириной и высотой.');
    if (parts.length>300) throw Error('Для одного расчёта допускается не больше 300 деталей.');
    const measures = [
      (a,b) => Math.max(b.w,b.h)-Math.max(a.w,a.h) || b.w*b.h-a.w*a.h,
      (a,b) => b.w*b.h-a.w*a.h || Math.max(b.w,b.h)-Math.max(a.w,a.h),
      (a,b) => b.h-a.h || b.w-a.w,
      (a,b) => b.w-a.w || b.h-a.h,
      (a,b) => (b.w+b.h)-(a.w+a.h),
      (a,b) => Math.min(b.w,b.h)-Math.min(a.w,a.h)
    ];
    const manual=data.mode==='manual';
    let best = null;
    if (manual) {
      for(let i=0;i<4;i++){
        const r=arrangeManual(parts,W,L,gap,rotate,i);
        if(!r)continue;
        const score=L ? r.sheets.length*1e12+r.usedLength : r.usedLength;
        if(!best || score<best.score)best={...r,score};
      }
    }
    const attempts = parts.length > 170 ? 3 : measures.length;
    for (let i=0;!manual && i<attempts;i++) {
      for (const method of ['bottom','area','short']) {
        const result = arrange(parts,W,L,gap,rotate,method,measures[i]);
        if (!result) continue;
        const score = L ? result.sheets.length * 1e12 + result.usedLength : result.usedLength;
        if (!best || score<best.score) best={...result,score};
      }
    }
    if (!best) throw Error('Не удалось разместить детали. Попробуй другие размеры рулона.');
    const totalArea=parts.reduce((s,p)=>s+p.w*p.h,0);
    const materialArea=W*(L ? L*best.sheets.length : best.usedLength);
    const usedPercent=Math.min(100,100*totalArea/materialArea);
    return {
      rollWidth:W,rollLength:L,gap,rotate,mode:manual?'manual':'economy',
      sheets:best.sheets.map((sheet,i)=>({index:i+1,pieces:sheet.pieces,usedLength:sheet.usedLength,bands:(sheet.bands||[]).map(b=>({y:b.y,height:b.height,items:[...b.items]}))})),
      count:parts.length,usedLength:best.usedLength,totalArea,materialArea,wasteArea:Math.max(0,materialArea-totalArea),
      efficiency:usedPercent, estimatedMeters:best.usedLength/1000, // mm to m
      blocks:data.blocks.map(b=>({id:b.id,name:b.name})),
      generated:new Date().toISOString()
    };
  }
  root.CutCore={solve,fromMM,toMM,areaCM2};
  if (typeof module!=='undefined' && module.exports) module.exports=root.CutCore;
})(typeof window!=='undefined'?window:globalThis);
