/* v0.13.0 — Editable room names, live interior areas and graphical zone pickers. */
(function(root){
'use strict';
const app=root.planApp,Z=root.PBPSpaces,$=s=>document.querySelector(s),clone=x=>JSON.parse(JSON.stringify(x));
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=x=>Number.isFinite(x)?x.toFixed(2).replace('.',','):'—';
let roomDraft=null,roomBase='',roomModel=null,roomLevel='',hits=[],cacheKey='',cache=null,cacheModel=null;
const P=root.ProjectModel.prototype,previousSnapshot=P.snapshot,previousRestore=P.restore;
P.snapshot=function(){const d=JSON.parse(previousSnapshot.call(this));d.spaceDesign=Z.settings(this.spaceDesign);return JSON.stringify(d);};
P.restore=function(text){previousRestore.call(this,text);this.spaceDesign=Z.settings(JSON.parse(text).spaceDesign);cacheKey='';};
function storeys(){return app.model.levels.filter(l=>!l.autoFloor&&!root.PBPGeometry.foundationIds(app.model).has(l.id)&&l.id!=='roof'&&!/^toiture$/i.test(l.name||''));}
function refresh(){cacheKey='';app.renderer2d?.draw();app.renderer3d?.draw();}
function roomReport(levelId){const m=app.model,key=JSON.stringify([levelId,m.spaceDesign,m.elements.filter(e=>Z.usableWall(e)&&e.levelId===levelId)]);if(cacheModel!==m||cacheKey!==key){cache=Z.rooms(m,levelId);cacheKey=key;cacheModel=m;}return cache;}
function drawRooms(r){
 hits=[];const m=app.model,s=Z.settings(m.spaceDesign),show=$('#spaceShow');if(show){show.textContent='Pièces '+(s.visible?'✓':'—');show.setAttribute('aria-pressed',String(s.visible));}if(!s.visible||app.viewMode==='3d'||(app.activeMode&&app.activeMode!=='construction'))return;
 const c=r.ctx;c.save();c.textAlign='center';c.textBaseline='middle';
 for(const room of roomReport(m.activeLevelId).rows){const p=r.worldToScreen(room.anchor);if(p.x<5||p.y<5||p.x>r.width-5||p.y>r.height-5)continue;
  c.font='600 12px system-ui';let name=room.name;if(name.length>26)name=name.slice(0,25)+'…';const surface=(room.approximate?'≈ ':'')+fmt(room.area)+' m²',w=Math.max(c.measureText(name).width,c.measureText(surface).width)+14,h=37;
  if(p.x-w/2<0||p.x+w/2>r.width||p.y-h/2<0||p.y+h/2>r.height)continue;
  const box={id:room.id,x:p.x-w/2,y:p.y-h/2,w,h};if(hits.some(a=>a.x<box.x+w&&a.x+a.w>box.x&&a.y<box.y+h&&a.y+a.h>box.y))continue;
  c.fillStyle='rgba(255,255,255,.91)';c.fillRect(box.x,box.y,w,h);c.fillStyle='#294c60';c.fillText(name,p.x,p.y-7);c.font='11px system-ui';c.fillStyle='#537685';c.fillText(surface,p.x,p.y+9);hits.push(box);
 }
 c.restore();
 const btn=$('#spaceShow');if(btn){btn.textContent='Pièces '+(s.visible?'✓':'—');btn.setAttribute('aria-pressed',String(s.visible));}
}
function renderRooms(){
 const model={...app.model,spaceDesign:roomDraft},data=Z.rooms(model,roomLevel),list=$('#spaceRows');list.replaceChildren();
 for(const room of data.rows){const row=el('label',undefined,'space-name-row'),input=document.createElement('input');input.type='text';input.maxLength=80;input.value=room.name;input.dataset.roomId=room.id;input.setAttribute('aria-label','Nom de '+room.defaultName);input.oninput=()=>{roomDraft.names[room.id]=input.value.trim()||room.defaultName;};row.append(input,el('span',(room.approximate?'≈ ':'')+fmt(room.area)+' m²'));row.title=room.areaNote;list.append(row);}
 if(!data.rows.length)list.append(el('p','Aucune pièce fermée détectée. Fermez les contours avec les murs ou les cloisons.','space-note'));
 $('#spaceTotal').textContent=data.rows.length+' pièce(s) · surface intérieure calculée : '+fmt(data.rows.reduce((n,r)=>n+(r.area||0),0))+' m²'+(data.rows.some(r=>r.area===null)?' · certaines surfaces sont indéterminées':'');
 $('#spaceRoomIssues').textContent=data.issues.join(' ');
}
function openRooms(id){
 if(app.dragWall||app.parallelDrag)return;roomModel=app.model;roomBase=app.model.snapshot();roomDraft=Z.settings(app.model.spaceDesign);const ls=storeys(),select=$('#spaceLevel');select.replaceChildren();ls.forEach(l=>{const o=el('option',l.name);o.value=l.id;select.append(o);});roomLevel=ls.some(l=>l.id===app.model.activeLevelId)?app.model.activeLevelId:ls[0]?.id||'';select.value=roomLevel;renderRooms();$('#spaceDialog').showModal();
 if(id){const input=[...$('#spaceRows').querySelectorAll('input')].find(x=>x.dataset.roomId===id);input?.focus();input?.select();}
}
function picker(parent,model,levelId,basis,value,onChange,options={}){
 const d=Z.zones(model,levelId,basis),pick=Z.resolve(d.rows,value);parent.replaceChildren();
 const actions=el('div',undefined,'space-picker-actions'),all=el('button','Tout couvrir'),none=el('button','Tout laisser vide');all.type=none.type='button';all.onclick=()=>onChange({mode:'all',ids:[]});none.onclick=()=>onChange({mode:'selected',ids:[]});actions.append(all,none);parent.append(actions);
 const canvas=document.createElement('canvas');canvas.width=600;canvas.height=330;canvas.className='space-picker-canvas';canvas.setAttribute('aria-label','Zones à couvrir ; les mêmes choix sont disponibles dans les cases sous le dessin');parent.append(canvas);
 const points=d.rows.flatMap(r=>r.face.points),c=canvas.getContext('2d'),chosen=new Set(pick.chosen.map(r=>r.id));c.fillStyle='#f6f9fb';c.fillRect(0,0,600,330);
 if(points.length){const x0=Math.min(...points.map(p=>p.x)),x1=Math.max(...points.map(p=>p.x)),y0=Math.min(...points.map(p=>p.y)),y1=Math.max(...points.map(p=>p.y)),scale=Math.min(552/(x1-x0||1),280/(y1-y0||1)),ox=(600-(x1-x0)*scale)/2,oy=(330-(y1-y0)*scale)/2,xy=p=>({x:ox+(p.x-x0)*scale,y:oy+(p.y-y0)*scale});
  for(const row of d.rows){const ps=row.face.points.map(xy),yes=chosen.has(row.id);c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=yes?'#ddecf4':'#f1ece6';c.fill();c.strokeStyle=yes?'#346b88':'#a69b8e';c.lineWidth=2;c.stroke();
   if(yes&&row.rectangle&&options.joists){const f=row.face,p=f.points,a=Z.dist(p[0],p[3]),b=Z.dist(p[1],p[0]),i=(a<=b?0:1)^(options.invert?1:0);c.strokeStyle='#a28b64';c.lineWidth=.9;for(let k=1;k<7;k++){const t=k/7,A=xy(Z.add(p[i],Z.mul(Z.sub(p[(i+1)%4],p[i]),t))),B=xy(Z.add(p[(i+3)%4],Z.mul(Z.sub(p[(i+1)%4],p[i]),t)));c.beginPath();c.moveTo(A.x,A.y);c.lineTo(B.x,B.y);c.stroke();}}
   const a=xy(row.anchor),name=row.name.length>28?row.name.slice(0,27)+'…':row.name;c.font='600 11px system-ui';c.textAlign='center';const w=Math.max(c.measureText(name).width,120)+10;c.fillStyle='rgba(255,255,255,.94)';c.fillRect(a.x-w/2,a.y-27,w,54);c.fillStyle='#284f63';c.fillText(name,a.x,a.y-12);c.font='11px system-ui';c.fillText(fmt(row.area)+' m² sur axes',a.x,a.y+3);let caption=yes?'Zone à couvrir':'Vide · sans '+(options.joists?'plancher':'toiture');if(yes&&options.joists&&row.rectangle){const p=row.face.points,spans=[Z.dist(p[0],p[3]),Z.dist(p[1],p[0])],i=(spans[0]<=spans[1]?0:1)^(options.invert?1:0);caption='Portée : '+fmt(spans[i])+' m';}c.fillText(caption,a.x,a.y+18);
  }
  canvas.onclick=e=>{const box=canvas.getBoundingClientRect(),p={x:x0+((e.clientX-box.left)*600/box.width-ox)/scale,y:y0+((e.clientY-box.top)*330/box.height-oy)/scale},row=d.rows.find(r=>Z.inside(p,r.face.points));if(row)onChange(Z.toggle(d.rows,value,row.id));};
 }else{c.font='14px system-ui';c.fillStyle='#765738';c.fillText('Aucune zone porteuse fermée à ce niveau',25,40);}
 const list=el('div',undefined,'space-picker-list');for(const row of d.rows){const line=el('label'),box=document.createElement('input');box.type='checkbox';box.checked=chosen.has(row.id);box.dataset.zoneId=row.id;box.onchange=()=>onChange(Z.toggle(d.rows,value,row.id));line.append(box,el('span',row.name+' · '+fmt(row.area)+' m² sur axes'));list.append(line);}parent.append(list);
 parent.append(el('p',fmt(pick.selectedArea)+' m² choisis · '+fmt(pick.totalArea-pick.selectedArea)+' m² laissés vides.','space-note'));
 if(pick.missing.length){const n=el('p',pick.missing.length+' ancienne(s) zone(s) ne correspondent plus au plan. Resélection nécessaire.','space-error');parent.append(n);}
 if(d.issues.length)parent.append(el('p',d.issues.join(' '),'space-note'));
 return{data:d,pick};
}
function decorateJoists(){
 const w=root.PBPJoistWizard,config=w?.getDraft?.(),canvas=$('#jwPreview');if(!config||!canvas||$('#joistZonePicker'))return;
 const box=el('section',undefined,'space-joist-picker');box.id='joistZonePicker';canvas.before(box);canvas.hidden=true;const detection=$('#jwDetection');if(detection)detection.hidden=true;
 const heading=el('p','Choisissez les zones à couvrir. Une zone décochée reste sans solives, panneaux ni plafond horizontal. Les cloisons non porteuses ne créent pas d’appui.','space-note');box.append(heading);const content=el('div');box.append(content);
 function paint(){picker(content,app.model,config.belowId,'structure',config.coverageZones,next=>{config.coverageZones=next;paint();},{joists:true,invert:config.invert});}paint();
}
function init(){
 const style=el('style');style.textContent=`.space-picker-canvas{width:100%;height:auto!important;display:block;cursor:pointer;border:1px solid #cedce4;border-radius:7px}.space-picker-actions{display:flex;gap:6px;margin:7px 0}.space-picker-actions button{font-size:11px;padding:6px 8px}.space-picker-list{display:grid;gap:6px;margin-top:8px;max-height:170px;overflow:auto}.space-picker-list label{display:flex!important;gap:7px;align-items:center;font-size:12px}.space-picker-list input{width:auto!important}.space-note{font-size:11px!important;color:#647986;line-height:1.5}.space-error{font-size:12px;color:#a33e2c;font-weight:600}#spaceDialog{width:min(540px,94vw);max-height:88vh;overflow:auto}#spaceForm{display:block;padding:16px}#spaceForm h3{margin:0 0 12px;font-size:17px}.space-name-row{display:grid!important;grid-template-columns:minmax(120px,1fr) 115px;gap:10px;align-items:center;margin:9px 0}.space-name-row input{min-width:0;width:100%;border:1px solid #cedae2;border-radius:5px;padding:8px}.space-name-row span{font-size:12px;text-align:right}.space-actions{display:flex;gap:7px;justify-content:flex-end;margin:12px 0 0}.space-primary{background:#245c7d;color:white}#spaceLevel{max-width:100%;padding:6px}.space-label-hint{font-size:10px;color:#667d8b}#spaceRows{max-height:48vh;overflow:auto}#jwPreview[hidden]{display:none!important}`;document.head.append(style);
 const bar=$('#drawingToolbar')||$('.mode-title').parentElement,group=el('div',undefined,'draw-group'),show=el('button','Pièces ✓'),edit=el('button','Noms / surfaces');show.type=edit.type='button';show.id='spaceShow';edit.id='spaceNames';group.append(show,edit);const zoom=bar.querySelector('.zoom-controls');if(zoom)bar.insertBefore(group,zoom);else bar.append(group);
 show.onclick=()=>{app.model.commit();app.model.spaceDesign={...Z.settings(app.model.spaceDesign),visible:!Z.settings(app.model.spaceDesign).visible};refresh();show.textContent='Pièces '+(Z.settings(app.model.spaceDesign).visible?'✓':'—');};edit.onclick=()=>openRooms();
 const dlg=el('dialog');dlg.id='spaceDialog';dlg.innerHTML='<form id="spaceForm"><h3>Pièces : noms et surfaces</h3><select id="spaceLevel" aria-label="Niveau"></select><p class="space-note">Pièce 1, Pièce 2… sont les noms par défaut. Modifiez-les ici ; un double-clic sur une étiquette du plan ouvre aussi cette fenêtre.</p><div id="spaceRows"></div><p id="spaceTotal"></p><p id="spaceRoomIssues" class="space-note"></p><p class="space-note">Surfaces entre faces des murs dessinés. Parements et doublages rapportés non déduits ; ce n’est pas la surface de plancher réglementaire. Les contours non fermés ne sont pas inventés.</p><div class="space-actions"><button type="button" id="spaceCancel">Annuler</button><button class="space-primary" type="submit">Enregistrer les noms</button></div></form>';document.body.append(dlg);
 $('#spaceLevel').onchange=e=>{roomLevel=e.target.value;renderRooms();};$('#spaceCancel').onclick=()=>dlg.close();$('#spaceForm').onsubmit=e=>{e.preventDefault();if(app.model!==roomModel||app.model.snapshot()!==roomBase){$('#spaceRoomIssues').textContent='Le projet a changé. Fermez et rouvrez la fenêtre avant d’enregistrer.';return;}app.model.commit();app.model.spaceDesign=Z.settings(roomDraft);dlg.close();refresh();};
 const base=root.PlanRenderer2D.prototype.draw;root.PlanRenderer2D.prototype.draw=function(...args){const v=base.apply(this,args);drawRooms(this);return v;};
 $('#planCanvas').addEventListener('dblclick',e=>{if(app.activeTool!=='select'||app.dragWall||app.parallelDrag)return;const b=e.currentTarget.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,hit=hits.find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);if(hit){e.stopImmediatePropagation();e.preventDefault();openRooms(hit.id);}},true);
 const body=$('#jwBody');if(body)new MutationObserver(decorateJoists).observe(body,{childList:true,subtree:true});decorateJoists();
 root.PBPSpacesReady=true;root.PBPSpacesUI.getLabelBoxes=()=>hits.map(h=>({...h}));$('.version').textContent='v0.13.0';document.title='Plan Bâtiment Pro — v0.13.0';refresh();
}
root.PBPSpacesUI={picker,refresh,open:openRooms};if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
