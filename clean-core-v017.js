/* Plan Bâtiment Pro v0.17.0 Clean Core.
   Single model, single 2D renderer, single event path. No prototype overrides. */
(function(root){
'use strict';
const ALIAS={
 '#ccCanvas2D':'#planCanvas','#ccCanvas3D':'#view3dCanvas','#ccCoords':'#statusCoords','#ccMeasure':'#statusMeasure',
 '#ccCloseProps':'#closePropertiesBtn','#ccUndo':'#undoBtn','#ccRedo':'#redoBtn','#ccZoomIn':'#zoomInBtn','#ccZoomOut':'#zoomOutBtn','#ccZoomReset':'#zoomResetBtn',
 '#ccLevelSelect':'#levelSelect','#ccAddLevel':'#addLevelBtn','#ccOverlayBtn':'#overlayBtn','#ccOverlayDialog':'#overlayDialog','#ccOverlayBelow':'#overlayBelow','#ccOverlayAbove':'#overlayAbove',
 '#ccOverlayFoundations':'#overlayFoundations','#ccOverlayOpacity':'#overlayOpacity','#ccOverlayOpacityValue':'#overlayOpacityValue','#ccSplitter':'#splitter','#ccCanvasShell':'#canvasShell',
 '#ccSave':'#saveBtn','#ccExport':'#exportBtn','#ccImport':'#importInput','#ccNew':'#newProjectBtn','#ccPerf':'#statusSnap','#cleanProperties':'#propertiesPanel',
 '#ccPropertiesBody':'#propertiesBody','#ccSelection':'#statusSelection','#ccView2D':'#view2d','#ccView3D':'#view3d','#ccSheetBadge':'#view2d .pane-label'
};
const $=s=>document.querySelector(ALIAS[s]||s),$=s=>[...document.querySelectorAll(s==='[data-view]'?'[data-view]':s)];
const CALC=root.PBPCleanCalc,B=root.PBPBuilding,S=root.PBPStructure;
const VERSION='0.17.0',PX_PER_M=50,EPS=.004,WALL_TYPES=new Set(['wallExterior','wallBearing','partition','foundation','beam']),LINE_TYPES=new Set([...WALL_TYPES,'dimension']);
const EDITABLE_LINES=new Set(['wallExterior','wallBearing','partition','foundation','beam']);
const uid=()=>Math.random().toString(36).slice(2,10);
const clone=v=>JSON.parse(JSON.stringify(v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const near=(a,b,e=EPS)=>dist(a,b)<=e;
const fmt=(v,n=2)=>Number.isFinite(Number(v))?Number(v).toFixed(n).replace('.',','):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function defaults(){
 return{projectName:'Mon projet',levels:[{id:'foundations',name:'Fondations',elevation:-.8,height:.8},{id:'ground',name:'RDC',elevation:0,height:2.8},{id:'r1',name:'R+1',elevation:2.8,height:2.8},{id:'roof',name:'Toiture',elevation:5.6,height:1.5}],activeLevelId:'ground',elements:[],buildingDesign:{schema:1,materials:{},floors:[]},structureDesign:{schema:1,foundation:{},floors:[]},foundationAutomation:{},roofDesign:{},cleanCoreVersion:VERSION,activeSheetId:'story:ground'};
}
function normalize(raw){
 let d=raw&&typeof raw==='object'?clone(raw):defaults();const base=defaults();d={...base,...d};
 d.levels=Array.isArray(d.levels)&&d.levels.length?d.levels:base.levels;d.elements=Array.isArray(d.elements)?d.elements:[];
 d.activeLevelId=d.activeLevelId||d.levels.find(l=>l.id==='ground')?.id||d.levels[0]?.id;
 d.buildingDesign=d.buildingDesign&&typeof d.buildingDesign==='object'?d.buildingDesign:base.buildingDesign;
 d.structureDesign=d.structureDesign&&typeof d.structureDesign==='object'?d.structureDesign:base.structureDesign;
 d.foundationAutomation=d.foundationAutomation&&typeof d.foundationAutomation==='object'?d.foundationAutomation:{};
 d.roofDesign=d.roofDesign&&typeof d.roofDesign==='object'?d.roofDesign:{};
 d.cleanCoreVersion=VERSION;return d;
}
class Bus{
 constructor(){this.m=new Map();}
 on(k,fn){if(!this.m.has(k))this.m.set(k,new Set());this.m.get(k).add(fn);return()=>this.m.get(k)?.delete(fn);}
 emit(k,p){for(const fn of this.m.get(k)||[])try{fn(p);}catch(e){console.error(e);}}
}
class Model{
 constructor(raw,bus){this.bus=bus;this.data=normalize(raw);this.history=[];this.future=[];this.revision=1;}
 serialize(){return JSON.stringify({...this.data,cleanCoreVersion:VERSION});}
 restore(text,{history=false}={}){this.data=normalize(JSON.parse(text));if(!history){this.history=[];this.future=[];}this.revision++;this.bus.emit('changed',{revision:this.revision,restore:true});}
 mutate(fn,label='modification'){const before=this.serialize();fn(this.data);this.history.push(before);if(this.history.length>80)this.history.shift();this.future=[];this.revision++;this.bus.emit('changed',{revision:this.revision,label});}
 commitFrom(before,label='déplacement'){if(before===this.serialize())return false;this.history.push(before);if(this.history.length>80)this.history.shift();this.future=[];this.revision++;this.bus.emit('changed',{revision:this.revision,label});return true;}
 undo(){if(!this.history.length)return false;const now=this.serialize(),prev=this.history.pop();this.future.push(now);this.data=normalize(JSON.parse(prev));this.revision++;this.bus.emit('changed',{revision:this.revision,undo:true});return true;}
 redo(){if(!this.future.length)return false;const now=this.serialize(),next=this.future.pop();this.history.push(now);this.data=normalize(JSON.parse(next));this.revision++;this.bus.emit('changed',{revision:this.revision,redo:true});return true;}
 get levels(){return this.data.levels;} get elements(){return this.data.elements;} get activeLevelId(){return this.data.activeLevelId;} set activeLevelId(v){this.data.activeLevelId=v;}
 level(id){return this.levels.find(l=>l.id===id);} storyLevels(){return this.levels.filter(l=>!l.autoFloor&&l.id!=='foundations'&&l.id!=='roof'&&!/^toiture$/i.test(l.name||'')).sort((a,b)=>a.elevation-b.elevation);}
}
class Sheets{
 constructor(app){this.app=app;this.cache=new Map();}
 list(){
  const m=this.app.model,d=m.data,out=m.storyLevels().map((l,i)=>({id:'story:'+l.id,kind:'story',levelId:l.id,label:l.name||('Niveau '+(i+1)),icon:'▱',order:10+i}));
  const fs=B?.settings(d.buildingDesign)?.floors||[];fs.filter(f=>f.enabled!==false).forEach((f,i)=>{const lo=m.level(f.belowId),hi=m.level(f.aboveId);out.push({id:'floor:'+f.id,kind:'floor',floorId:f.id,levelId:f.belowId,label:'Solivage '+(hi?.name||i+1),subtitle:lo&&hi?lo.name+' → '+hi.name:'',icon:'▥',order:100+i});});
  out.push({id:'foundations',kind:'foundations',levelId:d.foundationAutomation?.sourceLevelId||'ground',label:'Fondations',icon:'▰',order:200});
  out.push({id:'roof',kind:'roof',levelId:(d.roofDesign?.supportLevelId||m.storyLevels().at(-1)?.id),label:'Toiture / charpente',icon:'⌂',order:210});
  out.push({id:'3d',kind:'3d',label:'Vue 3D',icon:'◇',order:300});return out.sort((a,b)=>a.order-b.order);
 }
 active(){const rows=this.list(),id=this.app.model.data.activeSheetId;return rows.find(s=>s.id===id)||rows.find(s=>s.id==='story:'+this.app.model.activeLevelId)||rows[0];}
 status(id){const s=this.list().find(x=>x.id===id);if(!s||s.kind==='story')return'current';const x=this.cache.get(id);if(!x)return'never';if(x.error)return'error';return x.revision===this.app.model.revision?'current':'stale';}
 invalidate(){this.app.bus.emit('sheetStatus');}
 configForFloor(id){return (B?.settings(this.app.model.data.buildingDesign)?.floors||[]).find(f=>f.id===id);}
 compute(sheet){
  const t=performance.now();let result;
  if(sheet.kind==='floor')result=CALC.floor(this.app.model.data,sheet.floorId);
  else if(sheet.kind==='foundations')result=CALC.foundations(this.app.model.data);
  else if(sheet.kind==='roof')result=CALC.roof(this.app.model.data);
  else return null;
  const entry={revision:this.app.model.revision,result,ms:performance.now()-t,error:null};this.cache.set(sheet.id,entry);return entry;
 }
 ensure(sheet){
  if(sheet.kind==='story')return null;
  if(sheet.kind==='3d'){for(const s of this.list().filter(x=>['floor','foundations','roof'].includes(x.kind))){const c=this.cache.get(s.id);if(!c||c.revision!==this.app.model.revision)try{this.compute(s);}catch(e){this.cache.set(s.id,{revision:this.app.model.revision,result:null,error:e,ms:0});}}return null;}
  const c=this.cache.get(sheet.id);if(c&&c.revision===this.app.model.revision)return c;try{return this.compute(sheet);}catch(e){const x={revision:this.app.model.revision,result:null,error:e,ms:0};this.cache.set(sheet.id,x);return x;}
 }
 result(id){return this.cache.get(id)?.result||null;}
 open(id){
  const s=this.list().find(x=>x.id===id);if(!s)return;const previous=this.active();
  if(s.kind==='3d'&&previous?.kind!=='3d')this.app.last2DSheet=previous?.id;
  this.app.model.data.activeSheetId=s.id;if(s.levelId)this.app.model.activeLevelId=s.levelId;
  const entry=this.ensure(s);this.app.selected=null;this.app.drawingStart=null;this.app.drag=null;this.app.panDrag=null;
  if(s.kind==='3d')this.app.viewMode='3d';else if(this.app.viewMode==='3d')this.app.viewMode='2d';this.app.bus.emit('sheetChanged',{sheet:s,entry});this.app.requestDraw();this.app.renderUI();
 }
}
function wallFill(e,overlay=false){if(overlay)return'#8ea3b0';if(e.type==='wallBearing')return'#273a49';if(e.type==='partition')return'#7b8790';if(e.type==='foundation')return'#69747c';if(e.type==='beam')return'#50616d';return'#344c5d';}
function nodeKey(p){const q=500;return Math.round(p.x*q)+','+Math.round(p.y*q);}
function buildWallPaths(elements){
 const groups=new Map(),paths=[];
 for(const el of elements){if(!el.a||!el.b||!WALL_TYPES.has(el.type))continue;const key=el.type+'|'+Number(el.thickness??.2).toFixed(4);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(el);}
 for(const group of groups.values()){
  const edges=group.map(el=>({el,aKey:nodeKey(el.a),bKey:nodeKey(el.b),used:false})),nodes=new Map();
  const addNode=(key,p,i)=>{if(!nodes.has(key))nodes.set(key,{p:{...p},edges:[]});nodes.get(key).edges.push(i);};
  edges.forEach((e,i)=>{addNode(e.aKey,e.el.a,i);addNode(e.bKey,e.el.b,i);});
  const walk=(start,idx)=>{const pts=[{...nodes.get(start).p}],els=[];let key=start,closed=false,guard=0;while(idx!=null&&guard++<edges.length+5){const e=edges[idx];if(e.used)break;e.used=true;els.push(e.el);const next=e.aKey===key?e.bKey:e.aKey;pts.push({...nodes.get(next).p});if(next===start){closed=true;break;}const n=nodes.get(next);if(!n||n.edges.length!==2)break;const ni=n.edges.find(i=>!edges[i].used);if(ni==null)break;key=next;idx=ni;}if(els.length)paths.push({points:pts,closed,thickness:els[0].thickness??.2,representative:els[0]});};
  for(const [key,n] of nodes)if(n.edges.length!==2)for(const i of n.edges)if(!edges[i].used)walk(key,i);
  for(let i=0;i<edges.length;i++)if(!edges[i].used)walk(edges[i].aKey,i);
 }
 return paths;
}
function lineColor(e,overlay=false){if(overlay)return'#8299a6';return e.type==='wallBearing'?'#263a49':e.type==='partition'?'#78868f':e.type==='beam'?'#745f4c':e.type==='foundation'?'#68757d':'#344f61';}
class Renderer2D{
 constructor(app,canvas){this.app=app;this.canvas=canvas;this.ctx=canvas.getContext('2d');this.scale=1;this.pan={x:0,y:0};this.width=1;this.height=1;new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);this.resize();}
 resize(){const r=this.canvas.parentElement.getBoundingClientRect(),dpr=root.devicePixelRatio||1;this.canvas.width=Math.max(1,Math.floor(r.width*dpr));this.canvas.height=Math.max(1,Math.floor(r.height*dpr));this.canvas.style.width=r.width+'px';this.canvas.style.height=r.height+'px';this.ctx.setTransform(dpr,0,0,dpr,0,0);this.width=r.width;this.height=r.height;this.app.requestDraw?.();}
 world(p){return{x:this.width/2+p.x*PX_PER_M*this.scale+this.pan.x,y:this.height/2+p.y*PX_PER_M*this.scale+this.pan.y};}
 screen(p){return{x:(p.x-this.width/2-this.pan.x)/(PX_PER_M*this.scale),y:(p.y-this.height/2-this.pan.y)/(PX_PER_M*this.scale)};}
 drawGrid(){const c=this.ctx,minor=PX_PER_M*this.scale*.5,major=PX_PER_M*this.scale;if(minor<8)return;c.save();c.lineWidth=1;const ox=(this.width/2+this.pan.x)%minor,oy=(this.height/2+this.pan.y)%minor;for(let x=ox;x<this.width;x+=minor){const m=Math.abs(((x-(this.width/2+this.pan.x))/major)-Math.round((x-(this.width/2+this.pan.x))/major))<.05;c.strokeStyle=m?'#d2d9df':'#e9edf0';c.beginPath();c.moveTo(x,0);c.lineTo(x,this.height);c.stroke();}for(let y=oy;y<this.height;y+=minor){const m=Math.abs(((y-(this.height/2+this.pan.y))/major)-Math.round((y-(this.height/2+this.pan.y))/major))<.05;c.strokeStyle=m?'#d2d9df':'#e9edf0';c.beginPath();c.moveTo(0,y);c.lineTo(this.width,y);c.stroke();}c.restore();}
 drawWallBatch(elements,alpha=1,overlay=false){const paths=buildWallPaths(elements),c=this.ctx;if(!paths.length)return;c.save();c.globalAlpha=alpha;c.lineJoin='miter';c.miterLimit=30;c.lineCap='butt';for(const p of paths){const pts=p.points.map(q=>this.world(q));c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)c.lineTo(pts[i].x,pts[i].y);if(p.closed)c.closePath();c.strokeStyle=overlay?'#667f8f':'#142b3a';c.lineWidth=Math.max(3,p.thickness*PX_PER_M*this.scale+2);c.stroke();}for(const p of paths){const pts=p.points.map(q=>this.world(q));c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)c.lineTo(pts[i].x,pts[i].y);if(p.closed)c.closePath();c.strokeStyle=wallFill(p.representative,overlay);c.lineWidth=Math.max(2,p.thickness*PX_PER_M*this.scale);c.stroke();}c.restore();}
drawOpening(e,alpha=1,overlay=false){const c=this.ctx,p=this.world(e),w=(Number(e.width)||.9)*PX_PER_M*this.scale;c.save();c.globalAlpha=alpha;c.strokeStyle=overlay?'#8da1af':(e.type==='window'?'#2f6d86':'#725f4b');c.lineWidth=3;c.beginPath();c.moveTo(p.x-w/2,p.y);c.lineTo(p.x+w/2,p.y);c.stroke();if(e.type==='door'){c.lineWidth=1;c.beginPath();c.arc(p.x-w/2,p.y,w,0,-Math.PI/2,true);c.stroke();}c.restore();}
drawLine(e,alpha=1,generated=false){const a=this.world(e.a),b=this.world(e.b),c=this.ctx;c.save();c.globalAlpha=alpha;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineCap='butt';c.strokeStyle=generated?(e.role==='loadTransferRequired'?'#b05b2d':'#9a7449'):lineColor(e);c.lineWidth=Math.max(1,(Number(e.thickness)||.04)*PX_PER_M*this.scale);if(e.role==='loadTransferRequired')c.setLineDash([7,4]);c.stroke();c.restore();}
 drawRect(e,alpha=1,generated=false){const c=this.ctx,w=Number(e.width)||.9,d=Number(e.depth)||.2,x=Number(e.x)||0,y=Number(e.y)||0,a=(Number(e.rotation)||0)*Math.PI/180,u={x:Math.cos(a),y:Math.sin(a)},v={x:-Math.sin(a),y:Math.cos(a)},pts=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(q=>this.world({x:x+u.x*q[0]+v.x*q[1],y:y+u.y*q[0]+v.y*q[1]}));c.save();c.globalAlpha=alpha;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=e.type==='opening'?'rgba(255,255,255,.45)':e.type==='stair'?'rgba(145,125,100,.25)':e.type==='column'?'#536674':generated?'rgba(165,135,90,.25)':'rgba(100,125,140,.18)';c.fill();c.strokeStyle=e.type==='opening'?'#a06d45':'#647985';c.lineWidth=1.3;if(e.type==='opening')c.setLineDash([5,4]);c.stroke();c.restore();}
 drawPolygon(e,alpha=.25){const ps=e.polygon;if(!Array.isArray(ps)||ps.length<3)return;const c=this.ctx;c.save();c.globalAlpha=alpha;c.beginPath();ps.map(p=>this.world(p)).forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(!e.void){c.fillStyle=e.role==='panel'?'#ceb58a':'#bfc8cd';c.fill();}c.strokeStyle='#8497a2';if(e.void)c.setLineDash([6,4]);c.stroke();c.restore();}
 baseLevel(sheet){if(sheet.kind==='story')return sheet.levelId;if(sheet.kind==='floor')return this.app.sheets.configForFloor(sheet.floorId)?.belowId;if(sheet.kind==='foundations')return this.app.model.data.foundationAutomation?.sourceLevelId||'ground';if(sheet.kind==='roof')return sheet.levelId;return this.app.model.activeLevelId;}
 levelElements(level){return this.app.model.elements.filter(e=>e.mode==='construction'&&!e.generator&&e.levelId===level);}
 sourceElements(sheet){return this.levelElements(this.baseLevel(sheet));}
 overlayLevelIds(sheet){const base=this.baseLevel(sheet),stories=this.app.model.storyLevels(),i=stories.findIndex(l=>l.id===base),ids=[];if(this.app.overlay?.below&&i>0)ids.push(stories[i-1].id);if(this.app.overlay?.above&&i>=0&&i<stories.length-1)ids.push(stories[i+1].id);if(this.app.overlay?.foundations&&base!=='foundations')ids.push('foundations');return [...new Set(ids)];}
 derived(sheet){if(sheet.kind==='floor'||sheet.kind==='foundations'||sheet.kind==='roof')return this.app.sheets.result(sheet.id)?.elements||[];return[];}
 drawLayer(elements,alpha=1,overlay=false,generated=false){const walls=elements.filter(e=>e.a&&e.b&&WALL_TYPES.has(e.type)),others=elements.filter(e=>!walls.includes(e));if(generated){for(const e of walls)this.drawLine(e,alpha,true);}else this.drawWallBatch(walls,alpha,overlay);for(const e of others){if(e.polygon)this.drawPolygon(e,e.void?.16:alpha*.25);else if(e.a&&e.b)this.drawLine(e,alpha,generated);else if(['door','window'].includes(e.type))this.drawOpening(e,alpha,overlay);else if(Number.isFinite(Number(e.x))&&Number.isFinite(Number(e.y)))this.drawRect(e,alpha,generated);}}
 draw(){
  const c=this.ctx;c.clearRect(0,0,this.width,this.height);c.fillStyle='#fbfcfd';c.fillRect(0,0,this.width,this.height);this.drawGrid();const sheet=this.app.sheets.active();
  const oa=(Number(this.app.overlay?.opacity)||35)/100;for(const id of this.overlayLevelIds(sheet))this.drawLayer(this.levelElements(id),oa,true,false);
  this.drawLayer(this.sourceElements(sheet),1,false,false);this.drawLayer(this.derived(sheet),.92,false,true);
  if(sheet.kind==='story'&&this.app.drawingStart&&this.app.pointerWorld){this.drawLine({a:this.app.drawingStart,b:this.app.pointerWorld,thickness:.03,type:'beam'},.55,false);}
  const sel=this.app.selected;if(sel&&sheet.kind==='story'){if(sel.a&&sel.b){const a=this.world(sel.a),b=this.world(sel.b);c.save();c.strokeStyle='#1976a7';c.lineWidth=1.5;c.setLineDash([5,4]);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);for(const [i,p] of [a,b].entries()){const active=(i===0?'a':'b')===this.app.selectedPart;c.fillStyle=active?'#1976a7':'#fff';c.beginPath();c.arc(p.x,p.y,active?6.5:5.5,0,Math.PI*2);c.fill();c.strokeStyle='#1976a7';c.stroke();}if(Math.hypot(b.x-a.x,b.y-a.y)>44){const x=(a.x+b.x)/2,y=(a.y+b.y)/2;c.fillStyle=this.app.selectedPart?'#fff':'#1976a7';c.beginPath();c.moveTo(x,y-4);c.lineTo(x+4,y);c.lineTo(x,y+4);c.lineTo(x-4,y);c.closePath();c.fill();c.stroke();}c.restore();}else if(Number.isFinite(sel.x)){const p=this.world(sel);c.save();c.strokeStyle='#1976a7';c.setLineDash([5,4]);c.beginPath();c.arc(p.x,p.y,8,0,Math.PI*2);c.stroke();c.restore();}}
 }
 hit(screen,pointerType='mouse'){
  const sheet=this.app.sheets.active();if(sheet.kind!=='story')return null;const w=this.screen(screen),rows=this.sourceElements(sheet);for(let i=rows.length-1;i>=0;i--){const e=rows[i];if(e.a&&e.b){const ab={x:e.b.x-e.a.x,y:e.b.y-e.a.y},L2=ab.x*ab.x+ab.y*ab.y;if(!L2)continue;const t=Math.max(0,Math.min(1,((w.x-e.a.x)*ab.x+(w.y-e.a.y)*ab.y)/L2)),q={x:e.a.x+ab.x*t,y:e.a.y+ab.y*t};if(dist(w,q)<Math.max(.12,(Number(e.thickness)||.1)/2+.05))return e;}else if(Number.isFinite(e.x)){if(Math.abs(w.x-e.x)<(Number(e.width)||.8)/2+.15&&Math.abs(w.y-e.y)<(Number(e.depth)||.3)/2+.15)return e;}}return null;
 }
 corner(screen,pointerType='mouse'){
  const sheet=this.app.sheets.active();if(sheet.kind!=='story')return null;const radius=pointerType==='touch'?19:12,rows=this.sourceElements(sheet).filter(e=>e.a&&e.b);let best=null,d=Infinity;for(const e of rows)for(const end of ['a','b']){const p=this.world(e[end]),q=Math.hypot(p.x-screen.x,p.y-screen.y);if(q<radius&&q<d){d=q;best={element:e,end};}}return best;
 }
}
class Renderer3D{
 constructor(app,canvas){this.app=app;this.canvas=canvas;this.ctx=canvas.getContext('2d');this.angle=-.75;this.tilt=.55;this.zoom=38;this.width=1;this.height=1;this.drag=null;new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);this.bind();this.resize();}
 resize(){const r=this.canvas.parentElement.getBoundingClientRect(),dpr=root.devicePixelRatio||1;this.canvas.width=Math.max(1,Math.floor(r.width*dpr));this.canvas.height=Math.max(1,Math.floor(r.height*dpr));this.canvas.style.width=r.width+'px';this.canvas.style.height=r.height+'px';this.ctx.setTransform(dpr,0,0,dpr,0,0);this.width=r.width;this.height=r.height;if(this.app.viewMode!=='2d')this.app.requestDraw();}
 project(x,y,z){const ca=Math.cos(this.angle),sa=Math.sin(this.angle),rx=x*ca-y*sa,ry=x*sa+y*ca;return{x:this.width/2+rx*this.zoom,y:this.height*.62+(ry*Math.sin(this.tilt)-z*Math.cos(this.tilt))*this.zoom,depth:ry*Math.cos(this.tilt)+z*Math.sin(this.tilt)};}
 beam(e,z0=0,h=.2,color='#9a7449'){if(!e.a||!e.b)return;const a=this.project(e.a.x,e.a.y,Number(e.a.z??e.zBase??z0)),b=this.project(e.b.x,e.b.y,Number(e.b.z??e.zBase??z0));const c=this.ctx;c.save();c.strokeStyle=color;c.lineWidth=Math.max(2,(Number(e.thickness||e.width)||.06)*this.zoom);c.lineCap='butt';c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.restore();}
 wall(e,level){if(!e.a||!e.b)return;const z=Number(e.zBase??level?.elevation??0),h=Number(e.height)||Number(level?.height)||2.8,a0=this.project(e.a.x,e.a.y,z),b0=this.project(e.b.x,e.b.y,z),a1=this.project(e.a.x,e.a.y,z+h),b1=this.project(e.b.x,e.b.y,z+h),c=this.ctx;c.save();c.beginPath();c.moveTo(a0.x,a0.y);c.lineTo(b0.x,b0.y);c.lineTo(b1.x,b1.y);c.lineTo(a1.x,a1.y);c.closePath();c.fillStyle=e.type==='wallBearing'?'#687985':e.type==='partition'?'#b4bdc2':'#8b9ca6';c.globalAlpha=.9;c.fill();c.strokeStyle='#536773';c.stroke();c.restore();}
 polygon(e){if(!Array.isArray(e.polygon)||e.polygon.length<3)return;const z=Number(e.zBase)||0,ps=e.polygon.map(p=>this.project(p.x,p.y,z+Number(e.height||0))),c=this.ctx;c.save();c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=e.role==='panel'?'#c9ad7c':'#bbc4c9';c.globalAlpha=.72;c.fill();c.strokeStyle='#738791';c.stroke();c.restore();}
 draw(){const c=this.ctx;c.clearRect(0,0,this.width,this.height);c.fillStyle='#edf2f5';c.fillRect(0,0,this.width,this.height);const m=this.app.model,levels=new Map(m.levels.map(l=>[l.id,l]));for(const e of m.elements.filter(e=>e.mode==='construction'&&!e.generator)){if(e.a&&e.b&&['wallExterior','wallBearing','partition','beam'].includes(e.type))this.wall(e,levels.get(e.levelId));}
  for(const s of this.app.sheets.list().filter(x=>['floor','foundations','roof'].includes(x.kind))){const r=this.app.sheets.result(s.id);if(!r)continue;for(const e of r.elements||[]){if(e.type==='slab'&&e.polygon)this.polygon(e);else if(e.a&&e.b)this.beam(e,levels.get(e.levelId)?.elevation||0,e.height,e.role==='loadTransferRequired'?'#b05b2d':'#a77d4f');}}
 }
 updatePlacementSettings(){
  const panel=document.getElementById('placementSettings'),s=this.toolSettings[this.activeTool];
  if(!panel||!s){if(panel)panel.style.display='none';return;}
  panel.style.display='block';const name=document.getElementById('placementToolName');if(name)name.textContent=({wallExterior:'Mur extérieur',wallBearing:'Mur porteur',partition:'Cloison',foundation:'Fondation',beam:'Poutre',slab:'Dalle',column:'Poteau',door:'Porte',window:'Fenêtre',opening:'Trémie',stair:'Escalier',dimension:'Cote'})[this.activeTool]||this.activeTool;
  const t=document.getElementById('presetThickness'),h=document.getElementById('presetHeight');if(t)t.value=Number(s.thickness??s.width??.1).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');if(h)h.value=Number(s.height??.2).toFixed(2);
 }
 savePlacementSettings(){
  const s=this.toolSettings[this.activeTool];if(!s)return;const t=Number(document.getElementById('presetThickness')?.value),h=Number(document.getElementById('presetHeight')?.value);
  if(Number.isFinite(t)){if('thickness'in s)s.thickness=Math.max(.01,Math.min(2,t));else if('width'in s)s.width=Math.max(.01,Math.min(20,t));}
  if(Number.isFinite(h))s.height=Math.max(.01,Math.min(20,h));this.updatePlacementSettings();
 }
  bind(){this.canvas.addEventListener('pointerdown',e=>{this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.canvas.setPointerCapture?.(e.pointerId);});this.canvas.addEventListener('pointermove',e=>{if(!this.drag||e.pointerId!==this.drag.id)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;this.angle+=dx*.008;this.tilt=Math.max(.18,Math.min(1.12,this.tilt+dy*.004));this.drag.x=e.clientX;this.drag.y=e.clientY;this.app.requestDraw();});this.canvas.addEventListener('pointerup',e=>{if(this.drag?.id===e.pointerId)this.drag=null;});this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(14,Math.min(95,this.zoom*(e.deltaY<0?1.08:.92)));this.app.requestDraw();},{passive:false});}
}
class CleanApp{
 constructor(){
  this.bus=new Bus();let raw=null,migrated=false;try{const clean=localStorage.getItem('planBatimentProClean017'),old=localStorage.getItem('planBatimentPro');if(clean)raw=JSON.parse(clean);else if(old){raw=JSON.parse(old);migrated=true;}}catch(e){console.warn(e);}
  this.model=new Model(raw,this.bus);this.sheets=new Sheets(this);this.selected=null;this.selectedPart=null;this.activeTool='select';this.drawingStart=null;this.pointerWorld=null;this.drag=null;this.panMode=false;this.panDrag=null;this.suppressClick=false;this.viewMode='2d';this.last2DSheet=this.sheets.active()?.id;this.overlay={below:true,above:false,foundations:true,opacity:35};this.splitRatio=.30;this.frame=0;
  this.toolSettings={wallExterior:{thickness:.32,height:2.8},wallBearing:{thickness:.20,height:2.8},partition:{thickness:.072,height:2.8},foundation:{thickness:.50,height:.50},beam:{thickness:.20,height:.30},slab:{width:2,depth:2,height:.20},column:{width:.20,depth:.20,height:2.8},door:{width:.90,depth:.16,height:2.04},window:{width:1.20,depth:.16,height:1.20},opening:{width:1.0,depth:2.0,height:.2,openingFraming:'auto'},stair:{width:1,depth:3,height:2.8},dimension:{thickness:.02,height:0}};
  this.installLegacyControls();
  this.r2=new Renderer2D(this,$('#ccCanvas2D'));this.r3=new Renderer3D(this,$('#ccCanvas3D'));this.bind();this.bus.on('changed',()=>{this.sheets.invalidate();this.renderUI();this.updatePlacementSettings();this.requestDraw();});this.bus.on('sheetStatus',()=>this.renderSheets());this.bus.on('sheetChanged',()=>{this.renderUI();this.requestDraw();});this.renderUI();this.requestDraw();if(migrated)this.setStatus('Projet v0.16 chargé dans Clean Core sans modifier la sauvegarde d’origine.');
 }
 installLegacyControls(){
  const sidebar=document.querySelector('.tools-panel');if(!sidebar)return;
  const addSection=(title,items)=>{const sec=document.createElement('div');sec.className='tool-section clean-core-section';const h=document.createElement('div');h.className='section-title';h.textContent=title;sec.append(h);for(const item of items){const b=document.createElement('button');b.type='button';b.id=item.id;b.textContent=item.text;b.className='tool';sec.append(b);}sidebar.append(sec);};
  if(!document.getElementById('ccCreateFloor'))addSection('Calculs à la demande',[{id:'ccCreateFloor',text:'▤ Solivage auto'},{id:'ccFoundationsSheet',text:'▰ Fondations auto'},{id:'ccRoofSheet',text:'⌂ Toiture & charpente auto'},{id:'cc3DSheet',text:'◇ Vue 3D'}]);
  if(!document.getElementById('ccPan'))addSection('Navigation',[{id:'ccPan',text:'✥ Déplacer le plan'},{id:'ccCancelDraw',text:'Échap / annuler le tracé'},{id:'ccLegacy',text:'↩ v0.16.16 de secours'}]);
  if(!document.getElementById('ccModeText')){const x=document.createElement('span');x.id='ccModeText';x.hidden=true;document.body.append(x);}
  if(!document.getElementById('ccToolsFab')){const x=document.createElement('button');x.id='ccToolsFab';x.hidden=true;document.body.append(x);}
 }
  requestDraw(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;if(this.viewMode!=='3d')this.r2.draw();if(this.viewMode!=='2d')this.r3.draw();});}
 currentStory(){const s=this.sheets.active();return s.kind==='story'?s:null;}
 snap(p){const story=this.currentStory();if(!story)return p;let best=null,bd=.16;for(const e of this.model.elements)if(e.levelId===story.levelId&&e.a&&e.b){for(const q of [e.a,e.b]){const d=dist(p,q);if(d<bd){bd=d;best=q;}}}if(best)return{...best};if(this.drawingStart){const dx=p.x-this.drawingStart.x,dy=p.y-this.drawingStart.y,len=Math.hypot(dx,dy),step=Math.PI/4,a=Math.round(Math.atan2(dy,dx)/step)*step;if(len>.03&&Math.abs(Math.atan2(dy,dx)-a)<.10)return{x:this.drawingStart.x+Math.cos(a)*len,y:this.drawingStart.y+Math.sin(a)*len};}return{x:Math.round(p.x*20)/20,y:Math.round(p.y*20)/20};}
 pointer(e){const r=$('#ccCanvas2D').getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 editable(el){return el&&el.mode==='construction'&&!el.generator&&this.currentStory()&&el.levelId===this.currentStory().levelId;}
 beginDrag(e){
  if(this.activeTool!=='select'||e.button!==0||e.isPrimary===false||!this.currentStory())return;const p=this.pointer(e),corner=this.r2.corner(p,e.pointerType),hit=corner?.element||this.r2.hit(p,e.pointerType);if(!hit)return;this.selected=hit;this.selectedPart=corner?.end||null;this.renderProperties();
  if(!hit.a||!hit.b||!EDITABLE_LINES.has(hit.type))return;const anchors=corner?[corner.end]:['a','b'],connected=[];for(const other of this.model.elements){if(other.id===hit.id||other.levelId!==hit.levelId||!other.a||!other.b||!EDITABLE_LINES.has(other.type))continue;for(const end of ['a','b'])for(const anchor of anchors)if(near(other[end],hit[anchor])){connected.push({id:other.id,end,origin:{...other[end]},anchor});break;}}
  this.drag={id:hit.id,pointerId:e.pointerId,kind:corner?'corner':'wall',end:corner?.end||null,start:this.r2.screen(p),screenStart:p,originalA:{...hit.a},originalB:{...hit.b},connected,before:this.model.serialize(),moved:false};e.currentTarget.setPointerCapture?.(e.pointerId);this.requestDraw();
 }
 moveDrag(e){
  const d=this.drag;if(!d||e.pointerId!==d.pointerId)return false;const sp=this.pointer(e);if(!d.moved&&Math.hypot(sp.x-d.screenStart.x,sp.y-d.screenStart.y)<3)return true;const now=this.r2.screen(sp),dx=now.x-d.start.x,dy=now.y-d.start.y,el=this.model.elements.find(x=>x.id===d.id);if(!el)return true;
  const a={...d.originalA},b={...d.originalB};if(d.kind==='wall'||d.end==='a'){a.x+=dx;a.y+=dy;}if(d.kind==='wall'||d.end==='b'){b.x+=dx;b.y+=dy;}if(dist(a,b)<.05)return true;el.a=a;el.b=b;for(const x of d.connected){const o=this.model.elements.find(q=>q.id===x.id);if(o)o[x.end]={x:x.origin.x+dx,y:x.origin.y+dy};}d.moved=true;this.pointerWorld=now;this.updateStatusMeasure(el);this.requestDraw();return true;
 }
 endDrag(e){
  const d=this.drag;if(!d||e.pointerId!==d.pointerId)return;this.moveDrag(e);this.drag=null;if(d.moved)this.model.commitFrom(d.before,'déplacement mur');this.suppressClick=true;setTimeout(()=>this.suppressClick=false,0);this.renderProperties();this.requestDraw();
 }
 cancelDrag(){const d=this.drag;if(!d)return;const el=this.model.elements.find(x=>x.id===d.id);if(el){el.a={...d.originalA};el.b={...d.originalB};}for(const x of d.connected){const o=this.model.elements.find(q=>q.id===x.id);if(o)o[x.end]={...x.origin};}this.drag=null;this.requestDraw();}
 addLine(type,p){if(!this.drawingStart){this.drawingStart=p;this.pointerWorld=p;this.requestDraw();return;}const a=this.drawingStart,b=p;if(dist(a,b)<.05)return;const s=this.toolSettings[type]||{thickness:.1,height:2.8};let item;this.model.mutate(d=>{item={id:uid(),mode:'construction',levelId:this.model.activeLevelId,type,a:{...a},b:{...b},thickness:s.thickness||.08,height:s.height||2.8};d.elements.push(item);},'ajout '+type);this.selected=item;this.drawingStart=null;this.pointerWorld=null;this.renderProperties();this.setTool('select');}
 addPoint(type,p){const s=this.toolSettings[type]||{},item={id:uid(),mode:'construction',levelId:this.model.activeLevelId,type,x:p.x,y:p.y,width:s.width||.8,depth:s.depth||.2,height:s.height||2.8,rotation:0};if(type==='opening')item.openingFraming=s.openingFraming||'auto';this.model.mutate(d=>d.elements.push(item),'ajout '+type);this.selected=item;this.renderProperties();this.setTool('select');}
 setTool(tool){this.activeTool=tool;this.drawingStart=null;this.pointerWorld=null;$('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));$('#ccModeText').textContent=tool==='select'?'Sélection':({wallExterior:'Mur extérieur',wallBearing:'Mur porteur',partition:'Cloison',foundation:'Fondation',beam:'Poutre',slab:'Dalle',column:'Poteau',door:'Porte',window:'Fenêtre',opening:'Trémie',stair:'Escalier',dimension:'Cote'})[tool]||tool;this.requestDraw();}
 clickPlan(e){if(this.suppressClick||this.panMode||this.drag||!this.currentStory())return;const sp=this.pointer(e),p=this.snap(this.r2.screen(sp));if(this.activeTool==='select'){this.selected=this.r2.hit(sp,e.pointerType);this.selectedPart=null;this.renderProperties();this.requestDraw();return;}if(['wallExterior','wallBearing','partition','foundation','beam','dimension'].includes(this.activeTool))this.addLine(this.activeTool,p);else if(['column','slab','door','window','opening','stair'].includes(this.activeTool))this.addPoint(this.activeTool,p);}
 bind(){
  $('.tool').forEach(b=>b.onclick=()=>this.setTool(b.dataset.tool));$('#ccCanvas2D').addEventListener('pointerdown',e=>{if(this.panMode){const p=this.pointer(e);this.panDrag={id:e.pointerId,x:p.x,y:p.y,pan:{...this.r2.pan}};e.currentTarget.setPointerCapture?.(e.pointerId);return;}this.beginDrag(e);});$('#ccCanvas2D').addEventListener('pointermove',e=>{const p=this.pointer(e);if(this.panDrag&&e.pointerId===this.panDrag.id){this.r2.pan={x:this.panDrag.pan.x+p.x-this.panDrag.x,y:this.panDrag.pan.y+p.y-this.panDrag.y};this.requestDraw();return;}if(this.moveDrag(e))return;this.pointerWorld=this.snap(this.r2.screen(p));$('#ccCoords').textContent='X: '+fmt(this.pointerWorld.x)+' m · Y: '+fmt(this.pointerWorld.y)+' m';if(this.drawingStart){const L=dist(this.drawingStart,this.pointerWorld),a=(Math.atan2(this.pointerWorld.y-this.drawingStart.y,this.pointerWorld.x-this.drawingStart.x)*180/Math.PI+360)%360;$('#ccMeasure').textContent='Longueur: '+fmt(L)+' m · Angle: '+fmt(a,1)+'°';}this.requestDraw();});$('#ccCanvas2D').addEventListener('pointerup',e=>{if(this.panDrag?.id===e.pointerId){this.panDrag=null;return;}this.endDrag(e);});$('#ccCanvas2D').addEventListener('pointercancel',e=>{if(this.panDrag?.id===e.pointerId)this.panDrag=null;this.cancelDrag();});$('#ccCanvas2D').addEventListener('click',e=>this.clickPlan(e));
  $('#ccPan').onclick=()=>{this.panMode=!this.panMode;$('#ccPan').classList.toggle('active',this.panMode);};$('#ccCancelDraw').onclick=()=>{this.cancelDrag();this.drawingStart=null;this.pointerWorld=null;this.requestDraw();};$('#ccCloseProps').onclick=()=>{this.selected=null;this.renderProperties();this.requestDraw();};
  $('#ccUndo').onclick=()=>{if(this.model.undo()){this.selected=null;this.renderUI();this.requestDraw();}};$('#ccRedo').onclick=()=>{if(this.model.redo()){this.selected=null;this.renderUI();this.requestDraw();}};
  document.getElementById('presetThickness')?.addEventListener('change',()=>this.savePlacementSettings());document.getElementById('presetHeight')?.addEventListener('change',()=>this.savePlacementSettings());this.updatePlacementSettings();
  $('#ccZoomIn').onclick=()=>{this.r2.scale=Math.min(5,this.r2.scale*1.15);this.updateZoom();this.requestDraw();};$('#ccZoomOut').onclick=()=>{this.r2.scale=Math.max(.25,this.r2.scale/1.15);this.updateZoom();this.requestDraw();};$('#ccZoomReset').onclick=()=>{this.r2.scale=1;this.r2.pan={x:0,y:0};this.updateZoom();this.requestDraw();};
  $('#ccLevelSelect').onchange=e=>{const id=e.target.value;if(id==='foundations')this.sheets.open('foundations');else if(id==='roof'||/^toiture$/i.test(this.model.level(id)?.name||''))this.sheets.open('roof');else this.sheets.open('story:'+id);};
  $('#ccAddLevel').onclick=()=>this.addLevel();
  $('#ccOverlayBtn').onclick=()=>$('#ccOverlayDialog').showModal();
  $('#ccOverlayBelow').onchange=e=>{this.overlay.below=e.target.checked;this.requestDraw();};$('#ccOverlayAbove').onchange=e=>{this.overlay.above=e.target.checked;this.requestDraw();};$('#ccOverlayFoundations').onchange=e=>{this.overlay.foundations=e.target.checked;this.requestDraw();};$('#ccOverlayOpacity').oninput=e=>{this.overlay.opacity=Number(e.target.value);$('#ccOverlayOpacityValue').textContent=e.target.value+' %';this.requestDraw();};
  $('[data-view]').forEach(b=>b.onclick=()=>this.setViewMode(b.dataset.view));
  const splitter=$('#ccSplitter'),shell=$('#ccCanvasShell');splitter.addEventListener('pointerdown',e=>{this.splitDrag={id:e.pointerId};splitter.setPointerCapture?.(e.pointerId);});splitter.addEventListener('pointermove',e=>{if(!this.splitDrag||e.pointerId!==this.splitDrag.id)return;const r=shell.getBoundingClientRect();this.splitRatio=Math.max(.18,Math.min(.55,(e.clientX-r.left)/r.width));this.renderUI();});splitter.addEventListener('pointerup',e=>{if(this.splitDrag?.id===e.pointerId)this.splitDrag=null;});
  $('.work-category').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)$('.work-category').forEach(x=>{if(x!==d)x.open=false;});}));
  $('#ccCanvas2D').addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey){this.r2.scale=Math.max(.25,Math.min(5,this.r2.scale*Math.exp(-e.deltaY*.0025)));this.updateZoom();}else{this.r2.pan.x-=e.deltaX;this.r2.pan.y-=e.deltaY;}this.requestDraw();},{passive:false});
  $('#ccSave').onclick=()=>{localStorage.setItem('planBatimentProClean017',this.model.serialize());this.setStatus('Projet Clean Core enregistré dans ce navigateur.');};$('#ccExport').onclick=()=>{const blob=new Blob([this.model.serialize()],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='plan-batiment-pro-v017.json';a.click();URL.revokeObjectURL(a.href);};
  $('#ccImport').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{this.model.restore(await f.text());this.selected=null;this.sheets.cache.clear();this.renderUI();this.requestDraw();this.setStatus('Projet importé.');}catch(err){alert('Fichier invalide : '+err.message);}e.target.value='';};
  $('#ccNew').onclick=()=>{this.model=new Model(defaults(),this.bus);this.sheets=new Sheets(this);this.selected=null;this.renderUI();this.requestDraw();};$('#ccLegacy').onclick=()=>{location.href='legacy-v016.html';};$('#ccFoundationsSheet').onclick=()=>this.sheets.open('foundations');$('#ccRoofSheet').onclick=()=>this.sheets.open('roof');$('#cc3DSheet').onclick=()=>this.sheets.open('3d');$('#ccCreateFloor').onclick=()=>this.createFloor();
  $('#ccToolsFab').onclick=()=>document.body.classList.toggle('tools-open');document.querySelector('.canvas-shell')?.addEventListener('pointerdown',()=>{if(innerWidth<=700)document.body.classList.remove('tools-open');});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){this.cancelDrag();this.drawingStart=null;this.requestDraw();}if((e.key==='Delete'||e.key==='Backspace')&&this.selected&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){this.deleteSelected();}});
 }
 setViewMode(mode){
  if(!['2d','split','3d'].includes(mode))return;
  const active=this.sheets.active();
  if(mode==='3d'&&active?.kind!=='3d'){this.last2DSheet=active?.id;this.model.data.activeSheetId='3d';this.sheets.ensure(this.sheets.list().find(s=>s.id==='3d'));}
  if((mode==='2d'||mode==='split')&&this.sheets.active()?.kind==='3d'){const id=this.last2DSheet&&this.sheets.list().some(s=>s.id===this.last2DSheet)?this.last2DSheet:this.sheets.list().find(s=>s.kind==='story')?.id;if(id){this.model.data.activeSheetId=id;const s=this.sheets.active();if(s.levelId)this.model.activeLevelId=s.levelId;}}
  if(mode==='split')this.sheets.ensure(this.sheets.list().find(s=>s.id==='3d'));
  this.viewMode=mode;this.renderUI();setTimeout(()=>{this.r2.resize();this.r3.resize();},0);this.requestDraw();
 }
 renderLevels(){const sel=$('#ccLevelSelect');if(!sel)return;const old=sel.value;sel.replaceChildren();for(const l of this.model.levels.filter(l=>!l.autoFloor)){const o=document.createElement('option');o.value=l.id;o.textContent=l.name+' ('+fmt(l.elevation)+' m)';sel.append(o);}sel.value=this.model.activeLevelId;if(!sel.value&&old)sel.value=old;}
 addLevel(){const stories=this.model.storyLevels(),highest=stories.at(-1);if(!highest)return;const name=prompt('Nom du niveau :','R+'+Math.max(2,stories.length));if(!name)return;const def=Number(highest.elevation)+Number(highest.height||2.8),elevation=Number(prompt('Altitude du niveau (m) :',String(def)));if(!Number.isFinite(elevation))return;const id=uid();this.model.mutate(d=>{d.levels.push({id,name,elevation,height:2.8});d.levels.sort((a,b)=>a.elevation-b.elevation);const roof=d.levels.find(l=>l.id==='roof'||/^toiture$/i.test(l.name||''));if(roof&&roof.elevation<=elevation+.01)roof.elevation=elevation+2.8;d.activeLevelId=id;d.activeSheetId='story:'+id;},'ajout niveau');this.sheets.open('story:'+id);}
  createFloor(){const story=this.currentStory()||this.sheets.list().find(s=>s.kind==='story'&&s.levelId===this.model.activeLevelId);if(!story)return;const ls=this.model.storyLevels(),i=ls.findIndex(l=>l.id===story.levelId),below=ls[i],above=ls[i+1];if(!below||!above){this.setStatus('Ajoute ou sélectionne un niveau avec un étage au-dessus.');return;}let config=(B.settings(this.model.data.buildingDesign).floors||[]).find(f=>f.aboveId===above.id);if(!config){config={...B.config(S,below,above),assistant:true,scenarioMode:'standard-prestudy',grade:'C24',enabled:true,coverageZones:{mode:'all',ids:[]},blockingEnabled:true,blockingPattern:'staggered'};this.model.mutate(d=>{const bd=B.settings(d.buildingDesign);bd.floors=bd.floors.filter(f=>f.aboveId!==above.id).concat([config]);d.buildingDesign=bd;},'création solivage');}this.renderSheets();this.sheets.open('floor:'+config.id);}
 deleteSelected(){const id=this.selected?.id;if(!id)return;this.model.mutate(d=>{d.elements=d.elements.filter(e=>e.id!==id);},'suppression');this.selected=null;this.renderProperties();this.requestDraw();}
 updateZoom(){$('#ccZoomReset').textContent=Math.round(this.r2.scale*100)+' %';}
 setStatus(text){$('#ccPerf').textContent=text;}
 updateStatusMeasure(el){if(!el?.a||!el?.b)return;const L=dist(el.a,el.b),a=(Math.atan2(el.b.y-el.a.y,el.b.x-el.a.x)*180/Math.PI+360)%360;$('#ccMeasure').textContent='Longueur: '+fmt(L)+' m · Angle: '+fmt(a,1)+'°';}
 renderProperties(){const panel=$('#cleanProperties'),body=$('#ccPropertiesBody'),e=this.selected;if(!e){panel.classList.add('hidden');$('#ccSelection').textContent='Aucun élément sélectionné';return;}panel.classList.remove('hidden');$('#ccSelection').textContent=({wallExterior:'Mur extérieur',wallBearing:'Mur porteur',partition:'Cloison',beam:'Poutre',column:'Poteau',door:'Porte',window:'Fenêtre',opening:'Trémie',stair:'Escalier'})[e.type]||e.type;let html='<div><b>'+esc($('#ccSelection').textContent)+'</b></div>';
  if(e.a&&e.b){html+='<label class="prop-row"><span>Épaisseur (m)</span><input data-prop="thickness" type="number" step="0.01" value="'+esc(e.thickness??'')+'"></label><label class="prop-row"><span>Hauteur (m)</span><input data-prop="height" type="number" step="0.05" value="'+esc(e.height??'')+'"></label><label class="prop-row"><span>Ax</span><input data-prop="a.x" type="number" step="0.01" value="'+esc(e.a.x)+'"></label><label class="prop-row"><span>Ay</span><input data-prop="a.y" type="number" step="0.01" value="'+esc(e.a.y)+'"></label><label class="prop-row"><span>Bx</span><input data-prop="b.x" type="number" step="0.01" value="'+esc(e.b.x)+'"></label><label class="prop-row"><span>By</span><input data-prop="b.y" type="number" step="0.01" value="'+esc(e.b.y)+'"></label>';}
  else{for(const [label,k] of [['X','x'],['Y','y'],['Largeur (m)','width'],['Profondeur (m)','depth'],['Hauteur (m)','height'],['Rotation (°)','rotation']])html+='<label class="prop-row"><span>'+label+'</span><input data-prop="'+k+'" type="number" step="0.01" value="'+esc(e[k]??'')+'"></label>';}
  html+='<div class="prop-actions"><button id="ccDeleteSelected" class="danger-action">Supprimer</button></div>';body.innerHTML=html;body.querySelectorAll('[data-prop]').forEach(input=>input.onchange=()=>{const k=input.dataset.prop,v=Number(input.value);if(!Number.isFinite(v))return;this.model.mutate(()=>{if(k.includes('.')){const [a,b]=k.split('.');e[a][b]=v;}else e[k]=v;},'propriété');this.renderProperties();});$('#ccDeleteSelected').onclick=()=>this.deleteSelected();
 }
 renderSheets(){const bar=$('#cleanSheetBar'),active=this.sheets.active();bar.innerHTML='<div class="clean-sheet-caption">FEUILLETS</div><div class="clean-sheet-scroll">'+this.sheets.list().map(s=>{const st=this.sheets.status(s.id);return'<button class="clean-sheet '+(s.id===active?.id?'active ':'')+st+'" data-sheet="'+esc(s.id)+'">'+esc(s.icon)+' <span>'+esc(s.label)+'</span>'+(s.kind==='story'?'':'<i class="dot"></i>')+'</button>';}).join('')+'</div>';bar.querySelectorAll('[data-sheet]').forEach(b=>b.onclick=()=>this.sheets.open(b.dataset.sheet));}
 renderCalcCard(){const card=$('#ccCalcCard'),s=this.sheets.active();if(s.kind==='story'){card.hidden=true;return;}card.hidden=false;const entry=this.sheets.cache.get(s.id);if(s.kind==='3d'){card.innerHTML='<b>Vue 3D</b><br>Les moteurs techniques ont été calculés uniquement à l’ouverture de ce feuillet.';return;}if(!entry){card.innerHTML='<b>'+esc(s.label)+'</b><br>Calcul non lancé.';return;}if(entry.error){card.innerHTML='<b>'+esc(s.label)+'</b><p class="error">'+esc(entry.error.message)+'</p>';return;}const r=entry.result,errors=(r?.issues||[]).filter(i=>i.severity==='error'),warnings=(r?.issues||[]).filter(i=>i.severity!=='error');let info=s.kind==='floor'?(r.section?'Section '+r.section.b+' × '+r.section.h+' mm · ':'')+(r.count||0)+' solives':s.kind==='foundations'?(r.spanCount||0)+' tronçons · '+(r.padCount||0)+' appuis':(r.count||0)+' éléments de charpente';card.innerHTML='<b>'+esc(s.label)+'</b> · '+fmt(entry.ms,1)+' ms<br>'+esc(info)+(errors.length?'<p class="error">'+errors.length+' erreur(s) à corriger</p>':'')+(warnings.length?'<p class="warn">'+warnings.length+' avertissement(s)</p>':'');}
 renderUI(){const s=this.sheets.active(),v2=$('#ccView2D'),v3=$('#ccView3D'),split=$('#ccSplitter');v2.classList.toggle('hidden',this.viewMode==='3d');v3.classList.toggle('hidden',this.viewMode==='2d');split.style.display=this.viewMode==='split'?'block':'none';if(this.viewMode==='split'){v2.style.flex='0 0 '+(this.splitRatio*100)+'%';v3.style.flex='1 1 auto';}else{v2.style.flex='1 1 auto';v3.style.flex='1 1 auto';}$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===this.viewMode));$('#ccSheetBadge').textContent='PLAN 2D · '+s.label+(s.subtitle?' · '+s.subtitle:'');this.renderLevels();this.renderSheets();this.renderCalcCard();this.renderProperties();this.updateZoom();this.setStatus(this.viewMode==='3d'?'3D calculée à la demande':s.kind==='story'?'Édition 2D légère · aucun moteur structurel actif':this.sheets.status(s.id)==='current'?'Calcul du feuillet en cache':'Feuillet à calculer');}
}
const app=new CleanApp();root.PBPCleanApp=app;
})(window);
