const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let now=0,reduce=false,animations=0;
class Target{
 constructor(){this.listeners={};this.style={transform:'',removeProperty:k=>{this.style[k]=''}};this.dataset={};this.clientWidth=400;this.open=true}
 addEventListener(k,f){(this.listeners[k]??=new Set()).add(f)}removeEventListener(k,f){this.listeners[k]?.delete(f)}
 emit(k,props={}){const e={target:{closest:()=>false},pointerId:1,isPrimary:true,clientX:300,clientY:100,pointerType:'touch',button:0,preventDefault(){this.prevented=true},...props};for(const f of this.listeners[k]||[])f(e);return e}
 setPointerCapture(){}hasPointerCapture(){return false}releasePointerCapture(){}
 animate(){animations++;return {finished:Promise.resolve(),cancel(){}}}
}
const ctx={matchMedia:()=>({matches:reduce}),performance:{now:()=>now},innerWidth:500};ctx.globalThis=ctx;vm.runInNewContext(fs.readFileSync('motion.js','utf8'),ctx);const M=ctx.WalletMotion;
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(index=0,count=3){const content=new Target(),sheet=new Target(),calls=[];sheet.querySelector=()=>content;const ctl=M.mount(sheet,{index,count,onSwitch:(...args)=>calls.push(args)});return {content,sheet,calls,ctl}}
(async()=>{
 let f=fixture();f.content.emit('pointerdown');now=300;f.content.emit('pointermove',{clientX:160});f.content.emit('pointerup',{clientX:160});await tick();assert.deepEqual(f.calls,[[1,1]]);f.ctl.destroy();
 f=fixture(1);now=400;f.content.emit('pointerdown');now=800;f.content.emit('pointermove',{clientX:325});f.content.emit('pointerup',{clientX:325});await tick();assert.equal(f.calls.length,0);assert.equal(f.content.style.transform,'');f.ctl.destroy();
 f=fixture();f.content.emit('pointerdown');f.content.emit('pointermove',{clientX:310,clientY:160});f.content.emit('pointermove',{clientX:150,clientY:160});f.content.emit('pointerup');await tick();assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();f.content.emit('pointerdown');f.content.emit('pointermove',{clientX:160});f.content.emit('pointercancel');await tick();assert.equal(f.calls.length,0);assert.equal(f.content.style.transform,'');f.ctl.destroy();
 f=fixture();f.content.emit('pointerdown',{isPrimary:false});f.content.emit('pointermove',{clientX:160});f.content.emit('pointerup');await tick();assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();await f.ctl.navigate(-1);assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture(2);await f.ctl.navigate(1);assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();f.ctl.navigate(1);f.ctl.navigate(1);await tick();assert.equal(f.calls.length,1);f.ctl.destroy();
 f=fixture();f.ctl.navigate(1);f.ctl.destroy();await tick();assert.equal(f.calls.length,0);assert.equal(f.sheet.listeners.keydown.size,0);
 f=fixture();f.sheet.open=false;await f.ctl.navigate(1);assert.equal(f.calls.length,0);f.ctl.destroy();
 f=fixture();reduce=true;const before=animations;await f.ctl.enter(1);await f.ctl.navigate(1);assert.equal(animations,before);assert.equal(f.calls.length,1);f.ctl.destroy();
 console.log('PASS: swipe navigation, short-drag rebound, vertical scroll, cancellation, multi-touch guard, boundaries, repeat taps, dismissal cleanup and reduced motion.');
})().catch(e=>{console.error(e);process.exitCode=1});
