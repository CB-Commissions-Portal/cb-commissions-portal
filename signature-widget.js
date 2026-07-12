// Reusable signature-capture widget — shared by the in-app staff "Sign as" modal (app.js)
// and the public contract-sign.html page. Draw (mouse/touch/pen via Pointer Events) or
// type a name in a cursive font; either way exports a PNG data URL.

let _fontPromise=null;
export function ensureSignatureFont(){
  if(!document.getElementById('_sig_dancing_script_link')){
    const link=document.createElement('link');
    link.id='_sig_dancing_script_link';
    link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap';
    document.head.appendChild(link);
  }
  if(!_fontPromise){
    _fontPromise=(document.fonts&&document.fonts.load)?document.fonts.load('600 40px "Dancing Script"').catch(()=>{}):Promise.resolve();
  }
  return _fontPromise;
}

export function createSignaturePad(canvas){
  const ctx=canvas.getContext('2d');
  let drawing=false,lastX=0,lastY=0,hasInk=false;
  let mode='draw'; // 'draw'|'type'
  let typedText='';

  function resize(){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const dpr=window.devicePixelRatio||1;
    const prevMode=mode,prevText=typedText;
    canvas.width=rect.width*dpr;
    canvas.height=rect.height*dpr;
    ctx.scale(dpr,dpr);
    ctx.lineWidth=2.5;
    ctx.lineCap='round';
    ctx.lineJoin='round';
    ctx.strokeStyle='#111';
    if(prevMode==='type'&&prevText)renderTyped();
  }

  function pos(e){
    const rect=canvas.getBoundingClientRect();
    return{x:e.clientX-rect.left,y:e.clientY-rect.top};
  }
  function down(e){
    if(mode!=='draw')return;
    drawing=true;
    const p=pos(e);lastX=p.x;lastY=p.y;
    try{canvas.setPointerCapture(e.pointerId);}catch(err){}
  }
  function move(e){
    if(!drawing||mode!=='draw')return;
    const p=pos(e);
    ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(p.x,p.y);ctx.stroke();
    lastX=p.x;lastY=p.y;
    hasInk=true;
  }
  function up(){drawing=false;}

  canvas.style.touchAction='none';
  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('pointerleave',up);
  window.addEventListener('resize',resize);
  resize();

  function clear(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    hasInk=false;typedText='';mode='draw';
  }
  function renderTyped(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const rect=canvas.getBoundingClientRect();
    const size=Math.min(rect.height*0.55,44);
    ctx.font=`600 ${size}px "Dancing Script", cursive`;
    ctx.fillStyle='#111';
    ctx.textBaseline='middle';
    ctx.fillText(typedText,12,rect.height/2);
    hasInk=!!typedText.trim();
  }
  function setTypedText(text){
    typedText=text;
    mode='type';
    ensureSignatureFont().then(renderTyped);
  }
  function setDrawMode(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    mode='draw';typedText='';hasInk=false;
  }
  function isEmpty(){
    if(mode==='type')return!typedText.trim();
    if(!hasInk)return true;
    try{
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      for(let i=3;i<data.length;i+=4){if(data[i]!==0)return false;}
      return true;
    }catch(e){return!hasInk;}
  }
  function toDataURL(){return canvas.toDataURL('image/png');}

  return{clear,isEmpty,toDataURL,setTypedText,setDrawMode,get mode(){return mode;}};
}
