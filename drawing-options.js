/* Drawing toolbar v0.10.6. Display only: no structural dimensions are changed. */
(function(root){
'use strict';
const TYPES=new Set(['wallExterior','wallBearing','partition','beam','foundation']);
function settings(input){
  const v=input&&typeof input==='object'?input:{};
  return {schema:1,dimensions:v.dimensions!==false,automatic:v.automatic!==false,manual:v.manual!==false,
    selectedOnly:v.selectedOnly===true,grid:v.grid!==false,unit:['m','cm','mm'].includes(v.unit)?v.unit:'m'};
}
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
function label(length,unit='m'){
  if(!Number.isFinite(length)||length<0)return '—';
  const factor=unit==='mm'?1000:unit==='cm'?100:1,decimals=unit==='m'?2:unit==='cm'?1:0;
  return (length*factor).toFixed(decimals).replace('.',',')+' '+unit;
}
function descriptors(model,options,selected){
  const s=settings(options);
  if(!s.dimensions||!s.automatic)return [];
  return (model.elements||[]).filter(e=>e.mode==='construction'&&e.levelId===model.activeLevelId&&TYPES.has(e.type)&&!e.generator&&point(e.a)&&point(e.b)&&(!s.selectedOnly||e.id===selected))
    .map(e=>({id:e.id,type:e.type,a:{...e.a},b:{...e.b},thickness:Number.isFinite(e.thickness)&&e.thickness>0?e.thickness:0,length:Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)}))
    .filter(e=>Number.isFinite(e.length)&&e.length>1e-6).map(e=>({...e,text:label(e.length,s.unit)}));
}
const api={settings,label,descriptors};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root||!root.document)return;
root.PBPDrawing=api;
const app=root.planApp,$=s=>document.querySelector(s),R=root.PlanRenderer2D;
if(!app||!R||!root.ProjectModel)throw Error('Le bandeau de dessin nécessite le moteur de plan.');
let ready=false,lastLayout=[],scheduled=false;
const current=()=>settings(app.model.drawingDisplay);
const P=root.ProjectModel.prototype,previousSnapshot=P.snapshot,previousRestore=P.restore;
P.snapshot=function(){const data=JSON.parse(previousSnapshot.call(this));data.drawingDisplay=settings(this.drawingDisplay);return JSON.stringify(data);};
P.restore=function(text){const data=JSON.parse(text);previousRestore.call(this,text);this.drawingDisplay=settings(data.drawingDisplay);};
function refresh(){app.renderer2d?.draw();}
function change(patch){
  const s=settings({...current(),...patch});app.model.drawingDisplay=s;
  if(app.selectedElement?.type==='dimension'&&(!s.dimensions||!s.manual)){
    app.selectedElement=null;app.selectedPart=null;$('#propertiesPanel')?.classList.add('hidden');
    if($('#statusSelection'))$('#statusSelection').textContent='Aucun élément sélectionné';
  }
  refresh();
}
const grid=R.prototype.drawGrid;
R.prototype.drawGrid=function(...args){if(current().grid)return grid.apply(this,args);};
const element=R.prototype.drawElement;
R.prototype.drawElement=function(e,a,overlay){
  if(e.type==='dimension'&&(overlay||!current().dimensions||!current().manual||current().selectedOnly&&app.selectedElement?.id!==e.id))return;
  return element.call(this,e,a,overlay);
};
// Manual dimensions remain in the project, but hidden measurements cannot be picked.
const hit=R.prototype.hitTest;
R.prototype.hitTest=function(...args){
  const s=current(),m=this.app.model,original=m.elements;
  try{m.elements=original.filter(e=>e.type!=='dimension'||s.dimensions&&s.manual&&(!s.selectedOnly||app.selectedElement?.id===e.id));return hit.apply(this,args);}
  finally{m.elements=original;}
};
R.prototype.drawDimension=function(e,alpha=1){
  const s=current();if(!s.dimensions||!s.manual||!point(e.a)||!point(e.b))return;
  const a=this.worldToScreen(e.a),b=this.worldToScreen(e.b),c=this.ctx;
  c.save();c.globalAlpha=alpha;c.strokeStyle='#876320';c.fillStyle='#876320';c.lineWidth=1;
  c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.font='12px system-ui';c.textAlign='center';
  c.fillText(label(Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),s.unit),(a.x+b.x)/2,(a.y+b.y)/2-7);c.restore();
};
const selection=R.prototype.drawSelection;
R.prototype.drawSelection=function(e){const s=current();if(e?.type==='dimension'&&(!s.dimensions||!s.manual))return;return selection.call(this,e);};
// Display preferences must not prevent a newly requested manual measurement from showing.
function revealMeasure(){change({dimensions:true,manual:true,selectedOnly:false});}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function drawAutomatic(renderer){
  lastLayout=[];
  if(app.viewMode==='3d')return;
  const rows=descriptors(app.model,current(),app.selectedElement?.id);
  if(!rows.length)return;
  const c=renderer.ctx,W=renderer.width,H=renderer.height;
  const center=rows.reduce((p,e)=>({x:p.x+(e.a.x+e.b.x)/2/rows.length,y:p.y+(e.a.y+e.b.y)/2/rows.length}),{x:0,y:0});
  const occupied=[];
  const viewRect=renderer.canvas.getBoundingClientRect();
  for(const target of document.querySelectorAll('#propertiesPanel:not(.hidden),#view2d .pane-label')){
    const r=target.getBoundingClientRect();if(r.width&&r.height)occupied.push({x:r.left-viewRect.left-4,y:r.top-viewRect.top-4,w:r.width+8,h:r.height+8});
  }
  c.save();c.font='11px system-ui';c.textAlign='center';c.textBaseline='middle';
  const order=rows.slice().sort((a,b)=>(b.id===app.selectedElement?.id?1:0)-(a.id===app.selectedElement?.id?1:0));
  for(const e of order){
    const a=renderer.worldToScreen(e.a),b=renderer.worldToScreen(e.b),L=Math.hypot(b.x-a.x,b.y-a.y),u={x:(b.x-a.x)/L,y:(b.y-a.y)/L},n={x:-u.y,y:u.x};
    if(L<12||Math.max(a.x,b.x)<-80||Math.min(a.x,b.x)>W+80||Math.max(a.y,b.y)<-80||Math.min(a.y,b.y)>H+80)continue;
    const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},worldMid={x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2};
    const sign=(worldMid.x-center.x)*n.x+(worldMid.y-center.y)*n.y<0?-1:1;
    const half=e.thickness*50*renderer.scale/2,offset=half+22,textW=c.measureText(e.text).width+14,textH=21;
    let angle=Math.atan2(u.y,u.x);if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;
    const boxW=Math.abs(Math.cos(angle))*textW+Math.abs(Math.sin(angle))*textH;
    const boxH=Math.abs(Math.sin(angle))*textW+Math.abs(Math.cos(angle))*textH;
    let placed=null;
    placement: for(const distance of [offset,offset+24,offset+48])for(const side of [sign,-sign]){
      const o=side*distance,m={x:mid.x+n.x*o,y:mid.y+n.y*o},rect={x:m.x-boxW/2-3,y:m.y-boxH/2-3,w:boxW+6,h:boxH+6};
      if(rect.x<5||rect.y<5||rect.x+rect.w>W-5||rect.y+rect.h>H-5||occupied.some(x=>overlap(rect,x)))continue;
      placed={o,m,rect};break placement;
    }
    if(!placed)continue;
    occupied.push(placed.rect);
    const {o,m}=placed,p={x:a.x+n.x*o,y:a.y+n.y*o},q={x:b.x+n.x*o,y:b.y+n.y*o};
    c.strokeStyle=e.id===app.selectedElement?.id?'#176485':'#577784';c.lineWidth=1;c.setLineDash([]);
    c.beginPath();
    for(const end of [a,b]){const side=Math.sign(o);c.moveTo(end.x+n.x*side*(half+3),end.y+n.y*side*(half+3));c.lineTo(end.x+n.x*(o+side*6),end.y+n.y*(o+side*6));}
    c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);
    for(const end of [p,q]){const tx=(u.x+n.x)*3.6,ty=(u.y+n.y)*3.6;c.moveTo(end.x-tx,end.y-ty);c.lineTo(end.x+tx,end.y+ty);}c.stroke();
    c.save();c.translate(m.x,m.y);c.rotate(angle);c.fillStyle='rgba(255,255,255,.96)';c.fillRect(-textW/2,-textH/2,textW,textH);c.fillStyle='#244e62';c.fillText(e.text,0,.5);c.restore();
    lastLayout.push({id:e.id,text:e.text,length:e.length,rect:placed.rect});
  }
  c.restore();
}
function syncUI(){
  if(!ready)return;const s=current(),is3D=app.viewMode==='3d';
  for(const [id,value] of [['drawCotes',s.dimensions],['drawGrid',s.grid]]){
    const el=$('#'+id);el.classList.toggle('active',value);el.setAttribute('aria-pressed',String(value));el.disabled=is3D;
  }
  $('#drawCotes').textContent='↔ Cotes '+(s.dimensions?'✓':'—');$('#drawGrid').textContent='▦ Grille '+(s.grid?'✓':'—');
  for(const [id,key] of [['dimAutomatic','automatic'],['dimManual','manual'],['dimSelection','selectedOnly']])$('#'+id).checked=s[key];
  $('#dimUnit').value=s.unit;
  const mag=$('#magToggle');if(mag)mag.setAttribute('aria-pressed',String(app.model.magnet?.enabled!==false));
  $('#drawingToolbar').dataset.view=app.viewMode;
}
const draw=R.prototype.draw;
R.prototype.draw=function(...args){const result=draw.apply(this,args);drawAutomatic(this);syncUI();return result;};
function init(){
  const style=document.createElement('style');
  style.textContent=`
#app{grid-template-columns:minmax(0,1fr)}
.workspace,.topbar{min-width:0}
.plan-column{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;position:relative;overflow:hidden}
#drawingToolbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 9px;background:#fff;border-bottom:1px solid #d9e2e8;flex:none;z-index:21}
#drawingToolbar button,#drawingToolbar select{font-size:11px;min-height:31px;border:1px solid #d4dfe6;border-radius:6px;padding:5px 8px;background:#fff;white-space:nowrap}
#drawingToolbar button.active{background:#eaf3f8;border-color:#99bdcf;color:#174d68}
#drawingToolbar button:disabled{opacity:.45;cursor:default}
#drawingToolbar .draw-group{display:flex;align-items:center;flex-wrap:wrap;gap:5px;min-width:0;max-width:100%}
#drawingToolbar .draw-group + .draw-group{border-left:1px solid #e3e9ed;padding-left:7px}
#drawingToolbar .draw-title{font-size:10px;color:#6d818d;font-weight:700;letter-spacing:.06em;margin-right:3px}
#drawingToolbar .draw-check{display:flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap;min-height:31px}
#drawingToolbar .draw-check input{margin:0 2px;accent-color:#245c7d}
#drawingToolbar #magRef{width:158px;max-width:40vw;min-width:0}
#drawingToolbar .zoom-controls{margin-left:auto;border:0;padding:0}
#drawingToolbar .zoom-controls button{min-width:29px;padding:5px}
#drawingToolbar .zoom-controls .zoom-value{min-width:54px}
#drawingToolbar #drawOptions{font-weight:600}
#drawingOptions{position:absolute;right:8px;top:52px;z-index:31;width:min(300px,calc(100% - 16px));padding:12px;background:#fff;border:1px solid #cbd9e2e8;border-radius:9px;box-shadow:0 8px 26px #203b4d26;font-size:12px;max-height:calc(100% - 70px);overflow:auto}
#drawingOptions[hidden]{display:none}
#drawingOptions h3{font-size:13px;margin:0 0 9px}
#drawingOptions label{display:flex;align-items:center;gap:7px;margin:10px 0;line-height:1.4}
#drawingOptions select{margin-left:auto;padding:5px;min-width:90px;border:1px solid #d1dce3;border-radius:5px;background:white}
#drawingOptions p{font-size:11px;line-height:1.45;color:#617681;margin:10px 0}
#drawingOptions .draw-close{float:right;font-size:13px;padding:0 5px;min-height:22px}
#canvasShell>#propertiesPanel{max-width:calc(100% - 20px)}
@media(max-width:1100px){#drawingToolbar .draw-title{display:none}#drawingToolbar{gap:5px;padding:6px}#drawingToolbar #magRef{width:137px}}
@media(max-width:600px){#drawingToolbar .draw-group + .draw-group{border-left:0;padding-left:0}#drawingToolbar button,#drawingToolbar select{font-size:11px}.tools-panel{flex:0 0 135px;width:135px}}
`;
  document.head.append(style);
  const shell=$('#canvasShell'),column=document.createElement('div');column.className='plan-column';shell.before(column);
  const bar=document.createElement('div');bar.id='drawingToolbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Options du dessin');
  bar.innerHTML='<span class="draw-title">DESSIN</span><div class="draw-group" id="drawDimensions"><button id="drawCotes" type="button" aria-pressed="true" title="Afficher ou masquer les cotes du niveau actif (plan 2D)">↔ Cotes ✓</button><button id="drawOptions" type="button" aria-expanded="false" aria-controls="drawingOptions">Options ▾</button></div><div class="draw-group" id="drawMagnets"></div><div class="draw-group" id="drawViews"><button id="drawGrid" type="button" aria-pressed="true" title="Afficher ou masquer le quadrillage 2D, sans changer l’aimantation">▦ Grille ✓</button></div>';
  column.append(bar,shell);
  const properties=$('#propertiesPanel');if(properties)shell.append(properties);
  const oldCard=$('.precision-card'),mag=$('#magToggle'),cross=$('#magCross'),ref=$('#magRef');
  if(mag){mag.title='Aimantation des murs, angles droits, axes et extrémités. Alt pour libérer temporairement.';$('#drawMagnets').append(mag);}
  if(cross){const label=cross.closest('label');label.className='draw-check';for(const n of [...label.childNodes])if(n!==cross)n.remove();label.append(document.createTextNode(' Repères niveaux'));label.title='Alignements sur la structure d’un autre niveau, sans la déplacer';$('#drawMagnets').append(label);}
  if(ref){ref.title='Niveau servant de référence à l’aimantation';$('#drawMagnets').append(ref);}
  if(oldCard)oldCard.remove();
  const overlay=$('#overlayBtn');if(overlay)$('#drawViews').append(overlay);
  const zoom=$('.zoom-controls');if(zoom)bar.append(zoom);
  const panel=document.createElement('section');panel.id='drawingOptions';panel.hidden=true;panel.setAttribute('aria-label','Réglages des cotes');
  panel.innerHTML='<button type="button" class="draw-close" id="drawCloseOptions" aria-label="Fermer les options">×</button><h3>Affichage des cotes</h3><label><input type="checkbox" id="dimAutomatic" checked> Longueurs des murs automatiques</label><label><input type="checkbox" id="dimManual" checked> Cotes ajoutées avec l’outil Cote</label><label><input type="checkbox" id="dimSelection"> Seulement l’élément sélectionné</label><label>Unité <select id="dimUnit"><option value="m">Mètres</option><option value="cm">Centimètres</option><option value="mm">Millimètres</option></select></label><p>Les cotes automatiques mesurent les extrémités sur <strong>l’axe des murs</strong> du niveau actif. Ce ne sont pas les dimensions intérieures finies.</p><p>Les niveaux en transparence ne sont pas cotés. Les petites cotes sans place sont masquées pour éviter les superpositions : zoomez pour les lire.</p><p>La grille est seulement visuelle ; l’aimantation reste réglée par « Aimant murs ». Ces options sont conservées avec <strong>Enregistrer</strong>.</p>';
  column.append(panel);
  function showOptions(show){panel.hidden=!show;$('#drawOptions').setAttribute('aria-expanded',String(show));if(show){panel.style.top=(bar.getBoundingClientRect().height+6)+'px';}}
  $('#drawOptions').onclick=()=>showOptions(panel.hidden);$('#drawCloseOptions').onclick=()=>showOptions(false);
  $('#drawCotes').onclick=()=>change({dimensions:!current().dimensions});$('#drawGrid').onclick=()=>change({grid:!current().grid});
  for(const [id,key] of [['dimAutomatic','automatic'],['dimManual','manual'],['dimSelection','selectedOnly']])$('#'+id).onchange=e=>change({[key]:e.target.checked});
  $('#dimUnit').onchange=e=>change({unit:e.target.value});
  document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!$('#drawOptions').contains(e.target))showOptions(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){showOptions(false);$('#drawOptions').focus();}});
  $('[data-tool="dimension"]')?.addEventListener('click',revealMeasure);
  new ResizeObserver(()=>{if(!panel.hidden)panel.style.top=(bar.getBoundingClientRect().height+6)+'px';}).observe(bar);
  document.querySelectorAll('.view-btn').forEach(b=>b.addEventListener('click',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;syncUI();});}}));
  $('.version').textContent='v0.10.6';document.title='Plan Bâtiment Pro — v0.10.6';
  ready=true;root.PBPDrawingReady=true;api.refresh=refresh;api.getLayout=()=>lastLayout.map(x=>({...x,rect:{...x.rect}}));api.getSettings=current;
  syncUI();app.renderer2d?.resize();app.renderer3d?.resize();
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
