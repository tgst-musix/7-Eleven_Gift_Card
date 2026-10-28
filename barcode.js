/* Local-only Code 128 decoder. No image or barcode values are sent over the network. */
(function(root){
 const PAUSE=()=>new Promise(r=>setTimeout(r,0));
 function decodePixels(rgba,w,h){
  const gray=new Uint8ClampedArray(w*h);
  for(let i=0;i<gray.length;i++)gray[i]=(rgba[i*4]+2*rgba[i*4+1]+rgba[i*4+2])>>2;
  const hints=new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.CODE_128]],[ZXing.DecodeHintType.TRY_HARDER,true]]);
  const reader=new ZXing.MultiFormatReader();reader.setHints(hints);
  return reader.decodeWithState(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(gray,w,h))));
 }
 async function scanImage(source){
  const image=new Image();image.src=source;await image.decode();
  const results=[];
  for(const rotation of [0,90]){
   const src=document.createElement('canvas'),ctx=src.getContext('2d',{willReadFrequently:true});
   const scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));
   const iw=Math.round(image.naturalWidth*scale),ih=Math.round(image.naturalHeight*scale);
   src.width=rotation?ih:iw;src.height=rotation?iw:ih;
   if(rotation){ctx.translate(src.width,0);ctx.rotate(Math.PI/2)}
   ctx.drawImage(image,0,0,iw,ih);
   const bands=[[0,1],[0,.5],[.5,.5],...[0,.125,.25,.375,.5,.625,.75].map(y=>[y,.25])];
   for(const [top,height] of bands){
    await PAUSE();const y=Math.floor(top*src.height),h=Math.min(src.height-y,Math.floor(height*src.height));
    try{const data=ctx.getImageData(0,y,src.width,h),r=decodePixels(data.data,data.width,data.height),text=r.getText();
     if(!/^[\x20-\x7e]{1,80}$/.test(text))continue;
     const pts=r.getResultPoints(),pos=y+pts.reduce((n,p)=>n+p.getY(),0)/Math.max(pts.length,1);
     if(!results.some(x=>x.value===text))results.push({value:text,y:pos,rotation});
    }catch{}
   }
   if(results.length>=2)break;
  }
  if(results.length!==2)throw Error(results.length===1?'只辨識到一段條碼。請重新拍攝兩段完整條碼，或手動補填。':'無法確認兩段 Code 128 條碼。請拍清楚一些，或手動輸入。');
  return results.sort((a,b)=>a.y-b.y).map(x=>x.value);
 }
 function draw(svg,value){JsBarcode(svg,value,{format:'CODE128',width:3,height:85,margin:30,displayValue:false,background:'#ffffff',lineColor:'#000000'});}
 root.WalletBarcode={scanImage,decodePixels,draw};
})(typeof window==='undefined'?globalThis:window);
