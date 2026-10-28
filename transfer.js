/* Local-only JSON transfer. No network access. */
(function(root){
'use strict';
const DAY=86400000, clone=x=>JSON.parse(JSON.stringify(x));
const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n&&!/[\x00-\x1f\x7f]/.test(s);
const amount=x=>x===null||Number.isSafeInteger(x)&&x>=0&&x<=1000000;
const timestamp=x=>Number.isSafeInteger(x)&&x>=0&&x<=8640000000000000;
const key=c=>c.barcode1&&c.barcode2?JSON.stringify([c.barcode1,c.barcode2]):'legacy:'+c.id;
const historyKey=h=>JSON.stringify([h.id||null,h.at,h.actor,h.from,h.to,h.note||null]);
function history(raw){
 if(!Array.isArray(raw)||raw.length>10000)throw Error('卡片歷史格式不正確或筆數過多。');
 return raw.map(h=>{if(!h||!timestamp(h.at)||!text(h.actor,24)||!amount(h.from)||!amount(h.to)||(h.note!==undefined&&!text(h.note,500))||(h.id!==undefined&&!text(h.id,1000)))throw Error('卡片歷史格式不正確。');return {at:h.at,actor:h.actor,from:h.from,to:h.to,...(h.note?{note:h.note}:{}),...(h.id?{id:h.id}:{})}});
}
function card(c){
 const barcode=s=>typeof s==='string'&&/^[\x20-\x7e]{1,80}$/.test(s);
 if(!c||!text(c.id,99)||!text(c.name,40)||!/^\d{4}$/.test(c.tail)||!amount(c.balance)||!timestamp(c.updated)||!text(c.actor,24)||typeof c.demo!=='boolean'||(c.deletedAt!==undefined&&(!timestamp(c.deletedAt)||c.deletedAt===0)))throw Error('卡片資料格式不正確。');
 const clean={id:c.id,name:c.name,tail:c.tail,balance:c.balance,updated:c.updated,actor:c.actor,demo:c.demo,history:history(c.history)};
 if(c.deletedAt!==undefined)clean.deletedAt=c.deletedAt;
 if(!c.demo){if(barcode(c.barcode1)&&barcode(c.barcode2)&&c.format==='CODE128'&&!c.photo)Object.assign(clean,{barcode1:c.barcode1,barcode2:c.barcode2,format:'CODE128'});else if(typeof c.photo==='string'&&c.photo.length<=14000000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.photo)&&!c.barcode1&&!c.barcode2)clean.photo=c.photo;else throw Error('條碼格式不正確。');}
 return clean;
}
function read(data){
 if(!data||!(data.kind==='forest-wallet-transfer'&&data.version===1||[1,2,3].includes(data.version)&&data.kind===undefined)||!Array.isArray(data.cards)||data.cards.length>1000)throw Error('請使用一起卡夾匯出的 JSON 檔。');
 return data.cards.map(card);
}
function combineHistory(a,b){const m=new Map();for(const h of [...a,...b])m.set(historyKey(h),h);return [...m.values()].sort((a,b)=>b.at-a.at||historyKey(a).localeCompare(historyKey(b)))}
function exportData(state){return {kind:'forest-wallet-transfer',version:1,exportedAt:Date.now(),cards:state.cards.filter(c=>!c.demo).map(card)}}
function merge(local,data,{now=Date.now(),actor='森林旅人'}={}){
 if(!timestamp(now)||!text(actor,24))throw Error('本機時間或暱稱不正確。');
 const incoming=read(data),state=clone(local),counts={added:0,updated:0,kept:0,conflicts:0,skipped:0};
 // Keep personal settings, existing IDs and trash status on this device.
 const index=new Map();for(const c of state.cards){const k=key(c);if(index.has(k))throw Error('本機有重複條碼，請先整理後再匯入。');index.set(k,c)}
 const used=new Set(state.cards.map(c=>c.id));
 for(const c of incoming){
  if(c.demo||c.deletedAt&&now-c.deletedAt>=30*DAY){counts.skipped++;continue}
  const k=key(c),existing=index.get(k);
  if(!existing){let id=c.id;while(used.has(id))id='import-'+crypto.randomUUID();c.id=id;used.add(id);state.cards.push(c);index.set(k,c);counts.added++;continue}
  const previous=clone(existing),newer=c.updated>existing.updated,equal=c.updated===existing.updated;
  existing.history=combineHistory(existing.history,c.history);
  if(newer){for(const f of ['name','tail','balance','updated','actor'])existing[f]=c[f];counts.updated++}
  else if(equal&&c.balance!==existing.balance)counts.conflicts++;
  else counts.kept++;
  // Equal data requires no extra audit event; imported history is still merged.
  if(c.balance!==previous.balance||newer){
   const decision=newer?'採用匯入的較新資料':equal?'時間相同但餘額不同，保留本機，請核對收據':'匯入資料較舊，保留本機';
   const id='merge:'+JSON.stringify([k,c.updated,c.balance,previous.updated,previous.balance]);
   const note=`JSON 合併：${decision}。匯入餘額 ${c.balance===null?'待確認':c.balance+' 元'}，原更新 ${new Date(c.updated).toISOString()}（${c.actor}）。`;
   if(!existing.history.some(h=>h.id===id))existing.history.unshift({id,at:now,actor,from:previous.balance,to:existing.balance,note});
  }
 }
 if(state.cards.length>1000)throw Error('合併後超過 1,000 張卡片，請先整理卡夾。');
 // Remove samples once real cards are accepted. Never copy sender profile/actor.
 if(counts.added||counts.updated)state.cards=state.cards.filter(c=>!c.demo);
 for(const c of state.cards)if(c.history.length>10000)throw Error('合併後歷史超過 10,000 筆，尚未儲存。');
 return {state,counts};
}
const api={merge,exportData,read};if(typeof module==='object'&&module.exports)module.exports=api;else root.WalletTransfer=api;
})(globalThis);
