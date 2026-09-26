/* v0.16.0 — Office-style ribbon + safe level deletion. */
(function(root){
'use strict';
const app=root.planApp,$=s=>document.querySelector(s),clone=v=>JSON.parse(JSON.stringify(v));
if(!app||!root.ProjectModel)return;

const PROTECTED_LEVELS=new Set(['foundations','ground','roof']);
const TAB_DEFS=[
 ['project','Projet'],
 ['architecture','Architecture'],
 ['structure','Structure'],
 ['roof','Toiture'],
 ['envelope','Isolation'],
 ['annotate','Pièces & annotations'],
 ['view','Affichage'],
 ['extensions','Extensions']
];
const registry=new Map(),tabs=new Map();
let activeTab='architecture',deleteTarget=null;

function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function levelLabel(l){return l?l.name+' ('+(Number(l.elevation)||0).toFixed(2).replace('.',',')+' m)':'—';}
function isGeneratedLevel(l){return !!l?.autoFloor;}
function canDeleteLevel(l){
 if(!l)return{ok:false,reason:'Aucun niveau sélectionné.'};
 if(PROTECTED_LEVELS.has(l.id))return{ok:false,reason:'Ce niveau de base est protégé.'};
 if(isGeneratedLevel(l))return{ok:false,reason:'Ce niveau est généré par un plancher automatique. Supprimez le plancher depuis Structure.'};
 const ordinary=app.model.levels.filter(x=>!x.autoFloor&&!PROTECTED_LEVELS.has(x.id));
 if(ordinary.length<=1)return{ok:false,reason:'Le projet doit conserver au moins un niveau utilisateur.'};
 return{ok:true,reason:''};
}
function currentLevel(){return app.model.levels.find(l=>l.id===app.model.activeLevelId)||null;}

function rebuildLevelSelect(){
 const s=$('#levelSelect');if(!s)return;
 const current=app.model.activeLevelId;s.replaceChildren();
 for(const l of app.model.levels){
  const o=document.createElement('option');o.value=l.id;o.textContent=(l.autoFloor?'▤ ':'')+levelLabel(l);s.append(o);
 }
 if(app.model.levels.some(l=>l.id===current))s.value=current;else if(app.model.levels[0]){app.model.activeLevelId=app.model.levels[0].id;s.value=app.model.activeLevelId;}
 syncDeleteButton();
}
function syncDeleteButton(){
 const b=$('#deleteLevelBtn'),l=currentLevel();if(!b)return;
 const c=canDeleteLevel(l);b.disabled=!c.ok;b.title=c.ok?'Supprimer '+l.name:c.reason;
}

function deletionStats(id){
 const m=app.model,removedElements=(m.elements||[]).filter(e=>e.levelId===id),removedIds=new Set(removedElements.map(e=>e.id));
 const floors=(m.buildingDesign?.floors||[]).filter(f=>f.belowId===id||f.aboveId===id||f.id===id);
 const legacyFloors=(m.structureDesign?.floors||[]).filter(f=>f.levelId===id||f.sourceLevelId===id);
 const envelopes=(m.envelopeDesign?.assemblies||[]).filter(a=>a.levelId===id||removedIds.has(a.hostId));
 const roofs=(m.roofDesign?.groups||[]).filter(g=>g.supportLevelId===id);
 const sources=(m.planSources||[]).filter(s=>s.levelId===id);
 return{elements:removedElements.length,floors:floors.length,legacyFloors:legacyFloors.length,envelopes:envelopes.length,roofs:roofs.length,sources:sources.length};
}
function cleanRoomNames(names,id){
 const out={};for(const [k,v] of Object.entries(names||{})){let keep=true;try{const x=JSON.parse(k);if(Array.isArray(x)&&String(x[0])===String(id))keep=false;}catch{}if(keep)out[k]=v;}return out;
}
function deleteLevelCascade(id){
 const m=app.model,l=m.levels.find(x=>x.id===id),guard=canDeleteLevel(l);if(!guard.ok)throw Error(guard.reason);
 const oldElevation=Number(l.elevation)||0;
 m.commit();
 const removedIds=new Set(m.elements.filter(e=>e.levelId===id).map(e=>e.id));
 m.elements=m.elements.filter(e=>e.levelId!==id&&!removedIds.has(e.hostWallId)&&!removedIds.has(e.sourceWallId));
 m.levels=m.levels.filter(x=>x.id!==id&&!(x.autoFloor&&(x.belowId===id||x.aboveId===id)));

 if(m.buildingDesign){
  const d=root.PBPBuilding?.settings?root.PBPBuilding.settings(m.buildingDesign):clone(m.buildingDesign);
  d.floors=(d.floors||[]).filter(f=>f.belowId!==id&&f.aboveId!==id&&f.id!==id);
  if(d.materials&&typeof d.materials==='object')delete d.materials[id];
  m.buildingDesign=d;
 }
 if(m.structureDesign){
  const d=root.PBPStructure?.settings?root.PBPStructure.settings(m.structureDesign):clone(m.structureDesign);
  d.floors=(d.floors||[]).filter(f=>f.levelId!==id&&f.sourceLevelId!==id);
  m.structureDesign=d;
 }
 if(m.envelopeDesign){
  const d=root.PBPEnvelope?.settings?root.PBPEnvelope.settings(m.envelopeDesign):clone(m.envelopeDesign);
  d.assemblies=(d.assemblies||[]).filter(a=>a.levelId!==id&&!removedIds.has(a.hostId));
  m.envelopeDesign=d;
 }
 if(m.roofDesign){
  if(Array.isArray(m.roofDesign.groups)){
   m.roofDesign={...m.roofDesign,groups:m.roofDesign.groups.filter(g=>g.supportLevelId!==id)};
   if(root.PBPCoverage?.roofSettings)m.roofDesign=root.PBPCoverage.roofSettings(m.roofDesign);
  }else if(m.roofDesign.supportLevelId===id)m.roofDesign={...m.roofDesign,enabled:false,supportLevelId:'ground'};
 }
 if(m.foundationAutomation){
  const d=root.PBPFoundations?.settings?root.PBPFoundations.settings(m.foundationAutomation):clone(m.foundationAutomation);
  if(d.sourceLevelId===id||d.targetLevelId===id){
   d.enabled=false;
   if(d.sourceLevelId===id)d.sourceLevelId=m.levels.find(x=>x.id==='ground')?.id||m.levels.find(x=>!x.autoFloor&&!PROTECTED_LEVELS.has(x.id))?.id||'ground';
   if(d.targetLevelId===id)d.targetLevelId=m.levels.find(x=>x.id==='foundations')?.id||'foundations';
  }
  m.foundationAutomation=d;
 }
 if(Array.isArray(m.planSources))m.planSources=m.planSources.filter(s=>s.levelId!==id);
 if(m.spaceDesign)m.spaceDesign={...m.spaceDesign,names:cleanRoomNames(m.spaceDesign.names,id)};

 const candidates=m.levels.filter(x=>!x.autoFloor).sort((a,b)=>a.elevation-b.elevation);
 const below=candidates.filter(x=>Number(x.elevation)<=oldElevation).at(-1),next=below||candidates[0]||m.levels[0];
 m.activeLevelId=next?.id||'ground';
 app.selectedElement=null;app.selectedPart=null;app.drawingStart=null;
 $('#propertiesPanel')?.classList.add('hidden');
 rebuildLevelSelect();
 root.PBPBuildingUI?.refresh?.();
 root.PBPFoundationUI?.refresh?.();
 root.PBPEnvelopeUI?.refresh?.();
 root.PBPRoofUI?.refresh?.();
 root.PBPSpacesUI?.refresh?.();
 root.PBPAutonomyUI?.refresh?.();
 app.renderer2d?.draw();app.renderer3d?.draw();
 root.dispatchEvent(new CustomEvent('pbp:level-deleted',{detail:{id,name:l.name}}));
 return l;
}
function openDeleteLevel(){
 const l=currentLevel(),guard=canDeleteLevel(l);if(!guard.ok){alert(guard.reason);return;}
 deleteTarget=l.id;const s=deletionStats(l.id),d=$('#deleteLevelDialog');
 $('#deleteLevelTitle').textContent='Supprimer le niveau « '+l.name+' » ?';
 $('#deleteLevelSummary').innerHTML=
  '<b>'+esc(levelLabel(l))+'</b><br>'+
  s.elements+' élément(s) du niveau seront supprimés'+
  (s.floors?' · '+s.floors+' plancher(s) lié(s)':'')+
  (s.legacyFloors?' · '+s.legacyFloors+' calcul(s) structure':'')+
  (s.envelopes?' · '+s.envelopes+' doublage(s)/cloison(s)':'')+
  (s.roofs?' · '+s.roofs+' toiture(s) liée(s)':'')+
  (s.sources?' · '+s.sources+' fond(s) importé(s)':'')+'.';
 $('#deleteLevelConfirm').disabled=true;$('#deleteLevelAck').checked=false;d.showModal();
}

function makeRibbon(){
 const appEl=$('#app'),top=$('.topbar'),workspace=$('.workspace');if(!appEl||!top||!workspace)return;
 const ribbon=node('section','office-ribbon');ribbon.id='officeRibbon';
 const tabbar=node('div','ribbon-tabs'),panel=node('div','ribbon-panel');panel.id='ribbonPanel';
 ribbon.append(tabbar,panel);top.after(ribbon);
 for(const [id,label] of TAB_DEFS){
  const b=node('button','ribbon-tab',label);b.type='button';b.dataset.ribbonTab=id;b.setAttribute('role','tab');b.onclick=()=>activateTab(id);tabbar.append(b);
  const page=node('div','ribbon-page');page.dataset.ribbonPage=id;page.setAttribute('role','tabpanel');page.hidden=id!==activeTab;panel.append(page);tabs.set(id,{button:b,page,groups:new Map()});
 }
 activateTab(activeTab);
}
function groupFor(tabId,name){
 const tab=tabs.get(tabId)||tabs.get('extensions');if(!tab)return null;
 if(tab.groups.has(name))return tab.groups.get(name);
 const g=node('section','ribbon-group'),body=node('div','ribbon-group-body'),title=node('div','ribbon-group-title',name);g.append(body,title);tab.page.append(g);const o={root:g,body,title};tab.groups.set(name,o);return o;
}
function activateTab(id){
 if(!tabs.has(id))id='extensions';activeTab=id;
 for(const [k,t] of tabs){const on=k===id;t.button.classList.toggle('active',on);t.button.setAttribute('aria-selected',String(on));t.page.hidden=!on;}
}
function resolve(selector,closest){
 const e=typeof selector==='string'?$(selector):selector;if(!e)return null;
 return closest?e.closest(closest)||e:e;
}
function register({tab='extensions',group='Autres',selector=null,element=null,closest=null,wide=false}={}){
 const e=element||resolve(selector,closest);if(!e||e.dataset?.ribbonPlaced==='true')return e||null;
 const g=groupFor(tab,group);if(!g)return null;e.dataset.ribbonPlaced='true';e.classList.add('ribbon-command');if(wide)e.classList.add('ribbon-wide');g.body.append(e);registry.set(e.id||Math.random().toString(36),{tab,group,element:e});return e;
}
function proxy(tab,group,label,action,title=''){
 const b=node('button','ribbon-command',label);b.type='button';b.title=title;b.onclick=action;register({tab,group,element:b});return b;
}

function setupDeleteLevel(){
 if(!$('#deleteLevelBtn')){
  const b=node('button','', '− Niveau');b.id='deleteLevelBtn';b.type='button';$('#addLevelBtn')?.after(b);b.onclick=openDeleteLevel;
 }
 const d=document.createElement('dialog');d.id='deleteLevelDialog';d.innerHTML='<form id="deleteLevelForm"><h3 id="deleteLevelTitle">Supprimer le niveau ?</h3><div id="deleteLevelSummary" class="level-delete-summary"></div><p class="level-delete-warning">Cette opération supprime aussi les objets et automatismes directement liés à ce niveau. Elle peut être annulée ensuite avec <b>↶ Annuler</b>.</p><label class="level-delete-ack"><input id="deleteLevelAck" type="checkbox"> Je confirme la suppression de ce niveau et de ses éléments liés.</label><div class="level-delete-actions"><button id="deleteLevelCancel" type="button">Annuler</button><button id="deleteLevelConfirm" class="danger" type="submit" disabled>Supprimer le niveau</button></div></form>';document.body.append(d);
 $('#deleteLevelAck').onchange=e=>$('#deleteLevelConfirm').disabled=!e.target.checked;$('#deleteLevelCancel').onclick=()=>d.close();
 $('#deleteLevelForm').onsubmit=e=>{e.preventDefault();if(!deleteTarget)return;try{const l=deleteLevelCascade(deleteTarget);d.close();deleteTarget=null;$('#statusSelection').textContent='Niveau « '+l.name+' » supprimé';}catch(err){alert(err.message);}};
 $('#levelSelect')?.addEventListener('change',()=>requestAnimationFrame(syncDeleteButton));
 new MutationObserver(syncDeleteButton).observe($('#levelSelect'),{childList:true,subtree:true});
 syncDeleteButton();
}

function setupViewExtras(){
 const base=$('#gShowFloor')?.closest('label');
 if(base&&!$('#gShowRoofCover')){
  const label=document.createElement('label');label.title='Afficher/masquer uniquement la couverture, sans masquer la charpente';label.innerHTML='<input id="gShowRoofCover" type="checkbox"> Couverture du toit';base.after(label);
  const input=$('#gShowRoofCover');input.checked=app.model.view3D?.showRoofCover!==false;input.onchange=()=>{app.model.commit();app.model.view3D={...app.model.view3D,showRoofCover:input.checked};app.renderer3d?.draw();};
  const old=root.ConstructionRenderer3D.prototype.draw;root.ConstructionRenderer3D.prototype.draw=function(...a){input.checked=this.app.model.view3D?.showRoofCover!==false;return old.apply(this,a);};
 }
 if(!$('#togglePlanSource')){
  const source=node('button','','Fond importé ✓');source.type='button';source.id='togglePlanSource';source.title='Afficher ou masquer le document de référence sans masquer les objets convertis';
  source.onclick=()=>{const current=(app.model.planSources||[]).filter(s=>s.levelId===app.model.activeLevelId),show=current.some(s=>s.hidden);current.forEach(s=>s.hidden=!show);source.textContent=show?'Fond importé ✓':'Fond importé —';app.renderer2d?.draw();};
  ($('#drawViews')||$('#ribbonPanel'))?.append(source);
 }
}

function organizeCommands(){
 const importLabel=$('#importInput')?.closest('label');if(importLabel){[...importLabel.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.textContent='Ouvrir JSON');importLabel.title='Ouvrir un projet natif déjà enregistré';}
 if($('#rfOpen'))$('#rfOpen').textContent='⌂ Toiture & charpente auto';

 // Project and global checks.
 register({tab:'project',group:'Projet',selector:'#autoOpen'});
 register({tab:'project',group:'Bâtiment',selector:'#bOpenMaterials'});
 register({tab:'project',group:'Imports',selector:'#importPlanBtn'});

 // Architecture.
 for(const s of ['[data-tool="select"]','[data-tool="wallExterior"]','[data-tool="wallBearing"]','[data-tool="partition"]','[data-tool="column"]','[data-tool="beam"]'])register({tab:'architecture',group:'Construction',selector:s});
 for(const s of ['[data-tool="door"]','[data-tool="window"]','[data-tool="opening"]','[data-tool="stair"]'])register({tab:'architecture',group:'Ouvertures & circulation',selector:s});
 register({tab:'architecture',group:'Pose',selector:'#placementSettings',wide:true});

 // Structure.
 for(const s of ['#faOpen','#stFoundationOpen','#faShow','[data-tool="foundation"]'])register({tab:'structure',group:'Fondations',selector:s});
 for(const s of ['#joistAutoBtn','#bOpenFloors','[data-tool="slab"]'])register({tab:'structure',group:'Planchers & solivage',selector:s});

 // Roof.
 register({tab:'roof',group:'Toiture & charpente',selector:'#rfOpen'});
 proxy('roof','Documents','▣ Dossier toiture',()=>root.PBPRoofDocuments?.open?.(),'Plans 2D, coupes, détails et 3D');

 // Envelope.
 register({tab:'envelope',group:'Second œuvre',selector:'#envOpen'});

 // Rooms / annotations.
 for(const s of ['#spaceNames','#spaceShow','[data-tool="dimension"]'])register({tab:'annotate',group:'Pièces & mesures',selector:s});
 register({tab:'annotate',group:'Cotation',selector:'#drawDimensions',wide:true});

 // View.
 register({tab:'view',group:'Aimantation',selector:'#drawMagnets',wide:true});
 register({tab:'view',group:'Affichage 2D',selector:'#drawViews',wide:true});
 register({tab:'view',group:'Vues',selector:'.view-switch',wide:true});
 register({tab:'view',group:'Zoom',selector:'.zoom-controls',wide:true});
 for(const id of ['#gShowFoundations','#gShowFloor','#gShowRoofCover'])register({tab:'view',group:'Affichage 3D',selector:id,closest:'label'});
 if($('#togglePlanSource'))register({tab:'view',group:'Affichage 2D',selector:'#togglePlanSource'});

 // Hide empty legacy containers; command nodes themselves have been moved.
 const sidebar=$('.tools-panel');if(sidebar)sidebar.hidden=true;
 const draw=$('#drawingToolbar');if(draw)draw.hidden=true;
}

function absorbFuture(){
 const known=new Set([...document.querySelectorAll('[data-ribbon-placed="true"]')]);
 for(const el of document.querySelectorAll('[data-ribbon-tab][data-ribbon-group]')){
  if(known.has(el))continue;register({tab:el.dataset.ribbonTab,group:el.dataset.ribbonGroup,element:el});
 }
 const sidebar=$('.tools-panel');if(sidebar)for(const b of sidebar.querySelectorAll('button:not([data-ribbon-placed])')){
  if(b.closest('dialog'))continue;register({tab:'extensions',group:'Nouvelles commandes',element:b});
 }
}
function setupFutureRegistry(){
 root.PBPRibbon={register,activate:activateTab,registerCommand:(element,tab='extensions',group='Nouvelles commandes')=>register({tab,group,element}),tabs:()=>TAB_DEFS.map(x=>x[0])};
 const targets=[$('.tools-panel'),$('#drawingToolbar')].filter(Boolean);for(const t of targets)new MutationObserver(()=>queueMicrotask(absorbFuture)).observe(t,{childList:true,subtree:true});
 absorbFuture();
}

function init(){
 const style=document.createElement('style');style.textContent=`
#app{grid-template-rows:auto auto minmax(0,1fr) 30px}
.topbar{min-height:48px;display:flex;flex-wrap:wrap;gap:6px;padding:6px 10px;align-items:center;background:#fff;border-bottom:1px solid #d7e0e6}
.brand{font-size:13px;margin-right:auto}.top-actions{display:flex;flex-wrap:wrap;gap:5px;align-items:center;overflow:visible}.top-actions button,.top-actions select,.top-actions .file-button{font-size:11px;padding:6px 8px}
#deleteLevelBtn{border-color:#dab2aa;color:#8c3f32}#deleteLevelBtn:disabled{opacity:.42;color:#7c858a;border-color:#d9dee2}
.office-ribbon{background:#f7f9fb;border-bottom:1px solid #cfd9e0;box-shadow:0 1px 3px #263b4b10;min-width:0}
.ribbon-tabs{height:34px;display:flex;align-items:end;gap:2px;padding:0 10px;background:#fff;border-bottom:1px solid #d9e2e7;overflow-x:auto}.ribbon-tab{border:0;border-radius:5px 5px 0 0;background:transparent;padding:8px 12px 7px;font-size:11px;font-weight:650;color:#425f6f;white-space:nowrap}.ribbon-tab.active{background:#eef5f8;color:#164e69;border-bottom:2px solid #2b7598}
.ribbon-panel{height:104px;overflow-x:auto;overflow-y:hidden;background:#f6f8fa;padding:5px 8px}.ribbon-page{height:94px;display:flex;align-items:stretch;gap:5px;min-width:max-content}.ribbon-page[hidden]{display:none!important}.ribbon-group{display:flex;flex-direction:column;min-width:max-content;border-right:1px solid #d5dee4;padding:2px 8px 0 4px}.ribbon-group-body{display:flex;align-items:flex-start;gap:5px;flex:1;min-height:0}.ribbon-group-title{text-align:center;font-size:9px;color:#6e808b;line-height:15px;white-space:nowrap}.ribbon-command{font-size:10px!important;min-height:31px!important;padding:5px 7px!important;margin:0!important;white-space:nowrap}.ribbon-command.tool{width:auto!important;text-align:center!important}.ribbon-wide{display:flex!important;align-items:center!important;gap:5px!important;max-width:500px}.ribbon-wide button,.ribbon-wide select{font-size:10px!important;min-height:30px!important}
#placementSettings.ribbon-command{display:grid!important;grid-template-columns:auto auto;gap:3px 7px;max-height:76px;overflow:auto;padding:5px!important;min-width:280px}.ribbon-command .section-title,.ribbon-command .preset-note{display:none}.ribbon-command .placement-tool-name{grid-column:1/-1;margin:0;font-size:10px}.ribbon-command .setting-row{margin:0;font-size:10px;grid-template-columns:75px 65px}
#drawingToolbar[hidden],.tools-panel[hidden]{display:none!important}.workspace{min-height:0}.canvas-shell{min-width:0}
.level-delete-summary{background:#eef4f7;border:1px solid #d5e1e7;border-radius:7px;padding:10px;font-size:12px;line-height:1.55}.level-delete-warning{font-size:11px;color:#7c4e27;background:#fff5df;border-left:3px solid #d29a43;padding:8px}.level-delete-ack{font-size:12px;line-height:1.4}.level-delete-actions{display:flex;gap:7px;justify-content:flex-end}.danger{background:#a54334!important;color:white!important;border-color:#8b362a!important}.danger:disabled{opacity:.4!important}
#deleteLevelDialog{width:min(500px,92vw)}
#autoBadge{top:auto!important;bottom:35px;max-width:calc(100% - 20px)}
@media(max-width:850px){.ribbon-panel{height:98px}.ribbon-page{height:88px}.topbar{padding:5px}.brand{display:none}.top-actions{justify-content:flex-start}.ribbon-tab{padding:7px 9px}.ribbon-command{font-size:9.5px!important}}
@media(max-width:560px){.ribbon-panel{height:92px}.ribbon-page{height:82px}.ribbon-tabs{padding-left:4px}.ribbon-tab{padding:7px 7px}.top-actions select{max-width:150px}}
`;document.head.append(style);

 makeRibbon();setupDeleteLevel();setupViewExtras();organizeCommands();setupFutureRegistry();
 $('.version').textContent='v0.16.0';document.title='Plan Bâtiment Pro — v0.16.0';root.PBPWorkspaceReady=true;
 app.renderer2d?.resize();app.renderer3d?.resize();
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
