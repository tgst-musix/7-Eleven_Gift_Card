/* Local UI motion only. No card data leaves the browser. */
(function(root){
'use strict';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease='cubic-bezier(.22,1,.36,1)';
function animate(el,frames,options){
 if(reduced()||!el.animate)return {finished:Promise.resolve(),cancel(){}};
 const a=el.animate(frames,{easing:ease,...options});
 return {finished:a.finished.catch(()=>{}),cancel:()=>a.cancel()};
}
function open(sheet){
 const a=animate(sheet,[{transform:'translateY(100%) scale(.98)',opacity:.6},{transform:'translateY(0) scale(1)',opacity:1}],{duration:480});
 return ()=>a.cancel();
}
function mount(sheet,{index,count,onSwitch}){
 const content=sheet.querySelector('.payment-content');
 let stopped=false,busy=false,drag=null,animation=null,suppressClickUntil=0;
 const move=x=>{if(!reduced())content.style.transform=`translate3d(${x}px,0,0)`};
 const reset=()=>{content.style.removeProperty('transform');delete sheet.dataset.turning};
 async function settle(){
  if(stopped)return;busy=true;sheet.dataset.turning='true';
  animation=animate(content,[{transform:content.style.transform||'none'},{transform:'translate3d(0,0,0)'}],{duration:300});
  await animation.finished;if(stopped)return;reset();busy=false;
 }
 async function enter(direction){
  if(stopped)return;busy=true;sheet.dataset.turning='true';
  animation=animate(content,[{transform:`translate3d(${direction*38}%,0,0)`,opacity:.35},{transform:'translate3d(0,0,0)',opacity:1}],{duration:340});
  await animation.finished;if(stopped)return;reset();busy=false;
 }
 async function navigate(direction){
  if(stopped||busy||drag)return;
  const target=index+direction;if(target<0||target>=count){await settle();return}
  busy=true;sheet.dataset.turning='true';
  animation=animate(content,[{transform:content.style.transform||'none',opacity:1},{transform:`translate3d(${-direction*105}%,0,0)`,opacity:.25}],{duration:190});
  await animation.finished;if(stopped||!sheet.open)return;
  onSwitch(target,direction);
 }
 // Touch Events are handled separately: Safari can cancel the Pointer Events
 // stream when its scroll recognizer takes over. Never handle one finger twice.
 const blocked=target=>target?.closest?.('button,input,select,textarea,a,.sheet-head');
 function start(id,x,y,target,kind){
  if(stopped||busy||drag||blocked(target)||x<18||x>innerWidth-18)return;
  drag={id,x,y,kind,at:performance.now(),dx:0,locked:false};
 }
 function track(id,x,y,event){
  if(!drag||drag.id!==id||busy)return;
  const dx=x-drag.x,dy=y-drag.y;
  if(!drag.locked){
   if(Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)*1.3){drag=null;return}
   if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.2)return;
   drag.locked=true;
   if(drag.kind==='pointer')try{content.setPointerCapture(id)}catch{}
  }
  if(event.cancelable!==false)event.preventDefault();
  drag.dx=dx;
  const edge=dx>0?index===0:index===count-1;
  move(edge?dx*.18:dx*.92);
 }
 function finish(id,x,y,event){
  if(!drag||drag.id!==id)return;
  // The final finger position may only arrive in changedTouches on touchend.
  // Read it before deciding, rather than relying on the last move event.
  track(id,x,y,event);
  if(!drag)return;
  const d=drag;drag=null;
  if(d.kind==='pointer')try{if(content.hasPointerCapture(id))content.releasePointerCapture(id)}catch{}
  if(!d.locked)return;
  if(event.cancelable!==false)event.preventDefault();
  suppressClickUntil=performance.now()+450;
  const distance=Math.abs(d.dx),velocity=distance/Math.max(1,performance.now()-d.at),direction=d.dx<0?1:-1;
  if(distance>Math.min(80,content.clientWidth*.18)||(distance>30&&velocity>.45))navigate(direction);else settle();
 }
 function cancelDrag(){const d=drag;drag=null;if(d?.locked)settle()}
 function down(e){if(e.pointerType==='touch'||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;start(e.pointerId,e.clientX,e.clientY,e.target,'pointer')}
 function movePointer(e){if(e.pointerType!=='touch'&&drag?.kind==='pointer')track(e.pointerId,e.clientX,e.clientY,e)}
 function up(e){if(e.pointerType!=='touch'&&drag?.kind==='pointer')finish(e.pointerId,e.clientX,e.clientY,e)}
 function cancel(e){if(drag?.kind==='pointer'&&drag.id===e.pointerId)cancelDrag()}
 const findTouch=(list,id)=>Array.from(list||[]).find(t=>t.identifier===id);
 function touchStart(e){if(e.touches.length!==1){cancelDrag();return}const t=e.touches[0];start(t.identifier,t.clientX,t.clientY,e.target,'touch')}
 function touchMove(e){if(drag?.kind!=='touch')return;if(e.touches.length!==1){cancelDrag();return}const t=findTouch(e.touches,drag.id);if(t)track(t.identifier,t.clientX,t.clientY,e)}
 function touchEnd(e){if(drag?.kind!=='touch')return;const t=findTouch(e.changedTouches,drag.id);if(t)finish(t.identifier,t.clientX,t.clientY,e)}
 function touchCancel(){if(drag?.kind==='touch')cancelDrag()}
 function suppressClick(e){if(performance.now()<suppressClickUntil){e.preventDefault();e.stopPropagation()}}
 function key(e){if(!sheet.open||e.target.closest('input,textarea,select')||busy||drag)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();navigate(e.key==='ArrowLeft'?-1:1)}}
 function preventDrag(e){e.preventDefault()}
 content.addEventListener('touchstart',touchStart,{passive:true});content.addEventListener('touchmove',touchMove,{passive:false});content.addEventListener('touchend',touchEnd,{passive:false});content.addEventListener('touchcancel',touchCancel);sheet.addEventListener('click',suppressClick,true);content.addEventListener('pointerdown',down);content.addEventListener('pointermove',movePointer,{passive:false});content.addEventListener('pointerup',up);content.addEventListener('pointercancel',cancel);content.addEventListener('lostpointercapture',cancel);content.addEventListener('dragstart',preventDrag);sheet.addEventListener('keydown',key);
 function destroy(){stopped=true;drag=null;animation?.cancel();reset();content.removeEventListener('touchstart',touchStart);content.removeEventListener('touchmove',touchMove);content.removeEventListener('touchend',touchEnd);content.removeEventListener('touchcancel',touchCancel);sheet.removeEventListener('click',suppressClick,true);content.removeEventListener('pointerdown',down);content.removeEventListener('pointermove',movePointer);content.removeEventListener('pointerup',up);content.removeEventListener('pointercancel',cancel);content.removeEventListener('lostpointercapture',cancel);content.removeEventListener('dragstart',preventDrag);sheet.removeEventListener('keydown',key)}
 return {navigate,enter,destroy};
}
async function discard(sheet){
 const paper=sheet.querySelector('.discard-paper'),bin=sheet.querySelector('.discard-bin');
 if(!paper||!bin||reduced())return;
 sheet.dataset.discarding='true';
 const folds=paper.querySelector('.paper-folds');
 const crease=animate(folds,[{opacity:0},{opacity:.9}],{duration:200,fill:'forwards'});
 const r=paper.getBoundingClientRect(),b=bin.getBoundingClientRect(),dx=b.left+b.width/2-r.left-r.width/2,dy=b.top+b.height*.25-r.top-r.height/2;
 const toss=animate(paper,[
  {transform:'perspective(650px) rotateZ(0deg) scale(1)',borderRadius:'16px',offset:0},
  {transform:'perspective(650px) rotateY(24deg) rotateX(18deg) rotateZ(-9deg) scale(.68,.78)',borderRadius:'30px',offset:.27},
  {transform:'perspective(650px) rotateY(-28deg) rotateZ(15deg) scale(.3,.42)',borderRadius:'45px',offset:.48},
  {transform:`translate3d(${dx*.55}px,${Math.min(dy-70,-80)}px,0) rotateZ(135deg) scale(.19)`,opacity:1,offset:.72},
  {transform:`translate3d(${dx}px,${dy}px,0) rotateZ(235deg) scale(.06)`,opacity:0,borderRadius:'60px',offset:1}
 ],{duration:850,easing:'cubic-bezier(.42,0,.4,1)',fill:'forwards'});
 try{await toss.finished;const bounce=animate(bin,[{transform:'translateY(0) rotate(0)'},{transform:'translateY(5px) rotate(-7deg)'},{transform:'translateY(0) rotate(0)'}],{duration:220});await bounce.finished}finally{crease.cancel();toss.cancel();delete sheet.dataset.discarding}
}
root.WalletMotion={open,mount,discard};
})(globalThis);
