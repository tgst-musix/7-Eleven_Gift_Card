const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let now=0,reduce=false,animations=0;
class Target{
 constructor(){this.listeners={};this.style={transform:'',removeProperty:k=>{this.style[k]=''}};this.dataset={};this.clientWidth=400;this.clientHeight=600;this.scrollTop=0;this.open=true}
 addEventListener(k,f){(this.listeners[k]??=new Set()).add(f)}removeEventListener(k,f){this.listeners[k]?.delete(f)}
 emit(k,props={}){const e={target:{closest:()=>false},pointerId:1,isPrimary:true,clientX:300,clientY:100,pointerType:'mouse',button:0,preventDefault(){this.prevented=true},...props};for(const f of this.listeners[k]||[])f(e);return e}
 close(){this.open=false}
 setPointerCapture(){}hasPointerCapture(){return false}releasePointerCapture(){}
 animate(){animations++;return {finished:Promise.resolve(),cancel(){}}}
}
const ctx={matchMedia:()=>({matches:reduce}),performance:{now:()=>now},innerWidth:500,innerHeight:800};ctx.globalThis=ctx;vm.runInNewContext(fs.readFileSync('motion.js','utf8'),ctx);const M=ctx.WalletMotion;
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(index=0,count=3,options={}){const content=new Target(),sheet=new Target(),calls=[];sheet.querySelector=()=>content;const ctl=M.mount(sheet,{index,count,onSwitch:(...args)=>calls.push(args),...options});return {content,sheet,calls,ctl}}
(async()=>{
 let f=fixture();f.content.emit('pointerdown');now=300;f.content.emit('pointermove',{clientX:160});f.content.emit('pointerup',{clientX:160});await tick();assert.deepEqual(f.calls,[[1,1]]);f.ctl.destroy();
 f=fixture(1);now=400;f.content.emit('pointerdown');now=800;f.content.emit('pointermove',{clientX:325});f.content.emit('pointerup',{clientX:325});await tick();assert.equal(f.calls.length,0);assert.equal(f.content.style.transform,'');f.ctl.destroy();
 f=fixture();f.sheet.scrollTop=100;f.content.emit('pointerdown');f.content.emit('pointermove',{clientX:310,clientY:160});f.content.emit('pointermove',{clientX:150,clientY:160});f.content.emit('pointerup');await tick();assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();f.content.emit('pointerdown');f.content.emit('pointermove',{clientX:160});f.content.emit('pointercancel');await tick();assert.equal(f.calls.length,0);assert.equal(f.content.style.transform,'');f.ctl.destroy();
 f=fixture();f.content.emit('pointerdown',{isPrimary:false});f.content.emit('pointermove',{clientX:160});f.content.emit('pointerup');await tick();assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();await f.ctl.navigate(-1);assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture(2);await f.ctl.navigate(1);assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();f.ctl.navigate(1);f.ctl.navigate(1);await tick();assert.equal(f.calls.length,1);f.ctl.destroy();
 f=fixture();f.ctl.navigate(1);f.ctl.destroy();await tick();assert.equal(f.calls.length,0);assert.equal(f.sheet.listeners.keydown.size,0);
 f=fixture();f.sheet.open=false;await f.ctl.navigate(1);assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();reduce=true;const before=animations;await f.ctl.enter(1);await f.ctl.navigate(1);assert.equal(animations,before);assert.equal(f.calls.length,1);f.ctl.destroy();
 // Native iOS touch stream, not desktop mouse/pointer emulation.
 const point=(x,y=100)=>({identifier:7,clientX:x,clientY:y});
 const touch=(f,type,x,y=100,extra={})=>f.content.emit(type,{touches:type==='touchend'?[]:[point(x,y)],changedTouches:[point(x,y)],...extra});
 reduce=false;now=1000;f=fixture();touch(f,'touchstart',300);now=1300;touch(f,'touchmove',180);touch(f,'touchend',160);await tick();assert.deepEqual(f.calls,[[1,1]]);f.ctl.destroy();
 f=fixture(1);now=1400;touch(f,'touchstart',180);now=1700;touch(f,'touchmove',290);touch(f,'touchend',310);await tick();assert.deepEqual(f.calls,[[0,-1]]);f.ctl.destroy();
 // Sparse move events: touchend still contains the final position.
 f=fixture();touch(f,'touchstart',300);now+=300;touch(f,'touchend',170);await tick();assert.equal(f.calls.length,1);f.ctl.destroy();
 f=fixture();f.sheet.scrollTop=100;touch(f,'touchstart',300);const vertical=touch(f,'touchmove',306,180);touch(f,'touchend',180,190);await tick();assert.equal(f.calls.length,0);assert(!vertical.prevented);f.ctl.destroy();
 f=fixture();touch(f,'touchstart',300);touch(f,'touchmove',180);touch(f,'touchcancel',180);await tick();assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();touch(f,'touchstart',300);touch(f,'touchmove',180,100,{touches:[point(180),{identifier:8,clientX:280,clientY:100}]});touch(f,'touchend',160);await tick();assert.equal(f.calls.length,0);f.ctl.destroy();
 // Small initial diagonal drift must not permanently cancel a horizontal swipe.
 f=fixture();touch(f,'touchstart',300);touch(f,'touchmove',294,109);touch(f,'touchmove',200,112);touch(f,'touchend',170,112);await tick();assert.equal(f.calls.length,1);f.ctl.destroy();
 f=fixture();f.content.emit('pointerdown',{pointerType:'touch'});f.content.emit('pointermove',{pointerType:'touch',clientX:160});f.content.emit('pointerup',{pointerType:'touch',clientX:160});await tick();assert.equal(f.calls.length,0);f.ctl.destroy();
 // Downward dismiss at top, rebound when insufficient, and native scroll elsewhere.
 f=fixture();now=3000;touch(f,'touchstart',250);now=3400;touch(f,'touchmove',253,250);touch(f,'touchend',253,260);await tick();assert.equal(f.sheet.open,false);assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();now=4000;touch(f,'touchstart',250);now=4500;touch(f,'touchmove',252,130);touch(f,'touchend',252,130);await tick();assert(f.sheet.open);assert.equal(f.sheet.style.transform,'');f.ctl.destroy();
 f=fixture();now=5000;touch(f,'touchstart',250);now=5050;touch(f,'touchend',250,155);await tick();assert(!f.sheet.open);f.ctl.destroy();
 f=fixture();touch(f,'touchstart',250);const upward=touch(f,'touchmove',250,30);touch(f,'touchend',250,20);await tick();assert(f.sheet.open);assert(!upward.prevented);f.ctl.destroy();
 f=fixture();f.sheet.scrollTop=80;touch(f,'touchstart',250);const scrolling=touch(f,'touchmove',250,280);touch(f,'touchend',250,290);await tick();assert(f.sheet.open);assert(!scrolling.prevented);f.ctl.destroy();
 f=fixture();touch(f,'touchstart',250);touch(f,'touchmove',250,260);touch(f,'touchcancel',250,260);await tick();assert(f.sheet.open);assert.equal(f.sheet.style.transform,'');f.ctl.destroy();
 f=fixture();reduce=true;touch(f,'touchstart',250);touch(f,'touchend',250,280);await tick();assert(!f.sheet.open);f.ctl.destroy();
 // Home tab gestures reuse horizontal handling without dismissing the page.
 reduce=false;const home={dismissible:false,allowCardSwipe:true,isOpen:()=>true,contentSelector:'#homePanel'};
 f=fixture(0,3,home);touch(f,'touchstart',300);touch(f,'touchend',160);await tick();assert.deepEqual(f.calls,[[1,1]]);f.ctl.destroy();
 f=fixture(1,3,home);touch(f,'touchstart',300);touch(f,'touchend',160);await tick();assert.deepEqual(f.calls,[[2,1]]);f.ctl.destroy();
 f=fixture(2,3,home);touch(f,'touchstart',180);touch(f,'touchend',310);await tick();assert.deepEqual(f.calls,[[1,-1]]);f.ctl.destroy();
 f=fixture(0,3,home);touch(f,'touchstart',180);touch(f,'touchend',310);await tick();assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture(2,3,home);touch(f,'touchstart',300);touch(f,'touchend',160);await tick();assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture(0,3,home);touch(f,'touchstart',250);const homeScroll=touch(f,'touchmove',250,280);touch(f,'touchend',250,290);await tick();assert(f.sheet.open);assert.equal(f.calls.length,0);assert(!homeScroll.prevented);f.ctl.destroy();
 f=fixture(0,3,home);await f.ctl.select(2);assert.deepEqual(f.calls,[[2,1]]);f.ctl.destroy();
 f=fixture(0,3,{...home,isOpen:()=>false});await f.ctl.navigate(1);assert.equal(f.calls.length,0);f.ctl.destroy();
 console.log('PASS: pull-down close/rebound/scroll rules; all three home tabs, swipe directions, first/last edges, direct tab jumps and modal isolation; native touch and pointer regressions.');
})().catch(e=>{console.error(e);process.exitCode=1});
