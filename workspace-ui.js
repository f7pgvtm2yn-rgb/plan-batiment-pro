/* Plan Bâtiment Pro v0.17.0 — BIM-like workspace: app bar, métier ribbon, project navigator, properties dock. */
(function(root){
'use strict';
const app=root.planApp,$=s=>document.querySelector(s),clone=v=>JSON.parse(JSON.stringify(v));
if(!app||!root.ProjectModel)return;

const PROTECTED=new Set(['foundations','ground','roof']);
const TABS=[
 ['home','Accueil'],
 ['construction','Construction'],
 ['structure','Structure'],
 ['roof','Toiture'],
 ['finish','Second œuvre'],
 ['networks','Réseaux'],
 ['terrain','Terrain'],
 ['documents','Documents']
];
const tabs=new Map();
let activeTab='construction',deleteTarget=null,menuLevelId=null;

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function id(prefix='id'){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(v){return Number.isFinite(Number(v))?Number(v).toFixed(2).replace('.',','):'—';}
function activeLevel(){return app.model.levels.find(l=>l.id===app.model.activeLevelId)||null;}
function isProtected(l){return !l||PROTECTED.has(l.id)||l.autoFloor===true;}
function canDelete(l){
 if(!l)return{ok:false,reason:'Aucun niveau sélectionné.'};
 if(PROTECTED.has(l.id))return{ok:false,reason:'Ce niveau de base est protégé.'};
 if(l.autoFloor)return{ok:false,reason:'Ce niveau est généré par un plancher automatique. Supprimez le plancher depuis Structure.'};
 const user=app.model.levels.filter(x=>!x.autoFloor&&!PROTECTED.has(x.id));
 if(user.length<=1)return{ok:false,reason:'Le projet doit conserver au moins un niveau utilisateur.'};
 return{ok:true,reason:''};
}
function levelIcon(l){
 if(l.id==='foundations'||/fondation/i.test(l.name||''))return'▰';
 if(l.id==='roof'||/toiture/i.test(l.name||''))return'⌂';
 if(l.autoFloor||l.kind==='floor')return'▤';
 return'▱';
}
function selectLevel(levelId){
 const s=$('#levelSelect');if(!app.model.levels.some(l=>l.id===levelId))return;
 app.model.activeLevelId=levelId;
 if(s){s.value=levelId;s.dispatchEvent(new Event('change',{bubbles:true}));}
 else{app.selectedElement=null;app.drawingStart=null;app.renderer2d?.draw();app.renderer3d?.draw();}
 renderNavigator();syncProperties();
}
function cleanRoomNames(names,levelId){
 const out={};for(const [k,v] of Object.entries(names||{})){let keep=true;try{const x=JSON.parse(k);if(Array.isArray(x)&&String(x[0])===String(levelId))keep=false;}catch{}if(keep)out[k]=v;}return out;
}
function deletionStats(levelId){
 const m=app.model,els=(m.elements||[]).filter(e=>e.levelId===levelId),ids=new Set(els.map(e=>e.id));
 return{
  elements:els.length,
  floors:(m.buildingDesign?.floors||[]).filter(f=>f.belowId===levelId||f.aboveId===levelId||f.id===levelId).length,
  structural:(m.structureDesign?.floors||[]).filter(f=>f.levelId===levelId||f.sourceLevelId===levelId).length,
  envelopes:(m.envelopeDesign?.assemblies||[]).filter(a=>a.levelId===levelId||ids.has(a.hostId)).length,
  roofs:(m.roofDesign?.groups||[]).filter(g=>g.supportLevelId===levelId).length,
  sources:(m.planSources||[]).filter(s=>s.levelId===levelId).length
 };
}
function deleteLevelCascade(levelId){
 const m=app.model,l=m.levels.find(x=>x.id===levelId),guard=canDelete(l);if(!guard.ok)throw Error(guard.reason);
 const oldElevation=Number(l.elevation)||0;m.commit();
 const removedIds=new Set((m.elements||[]).filter(e=>e.levelId===levelId).map(e=>e.id));
 m.elements=(m.elements||[]).filter(e=>e.levelId!==levelId&&!removedIds.has(e.hostWallId)&&!removedIds.has(e.sourceWallId));
 m.levels=(m.levels||[]).filter(x=>x.id!==levelId&&!(x.autoFloor&&(x.belowId===levelId||x.aboveId===levelId)));

 if(m.buildingDesign){
  const d=root.PBPBuilding?.settings?root.PBPBuilding.settings(m.buildingDesign):clone(m.buildingDesign);
  d.floors=(d.floors||[]).filter(f=>f.belowId!==levelId&&f.aboveId!==levelId&&f.id!==levelId);if(d.materials)delete d.materials[levelId];m.buildingDesign=d;
 }
 if(m.structureDesign){
  const d=root.PBPStructure?.settings?root.PBPStructure.settings(m.structureDesign):clone(m.structureDesign);d.floors=(d.floors||[]).filter(f=>f.levelId!==levelId&&f.sourceLevelId!==levelId);m.structureDesign=d;
 }
 if(m.envelopeDesign){
  const d=root.PBPEnvelope?.settings?root.PBPEnvelope.settings(m.envelopeDesign):clone(m.envelopeDesign);d.assemblies=(d.assemblies||[]).filter(a=>a.levelId!==levelId&&!removedIds.has(a.hostId));m.envelopeDesign=d;
 }
 if(m.roofDesign){
  if(Array.isArray(m.roofDesign.groups)){m.roofDesign={...m.roofDesign,groups:m.roofDesign.groups.filter(g=>g.supportLevelId!==levelId)};if(root.PBPCoverage?.roofSettings)m.roofDesign=root.PBPCoverage.roofSettings(m.roofDesign);}
  else if(m.roofDesign.supportLevelId===levelId)m.roofDesign={...m.roofDesign,enabled:false,supportLevelId:'ground'};
 }
 if(m.foundationAutomation){
  const d=root.PBPFoundations?.settings?root.PBPFoundations.settings(m.foundationAutomation):clone(m.foundationAutomation);
  if(d.sourceLevelId===levelId||d.targetLevelId===levelId){d.enabled=false;if(d.sourceLevelId===levelId)d.sourceLevelId=m.levels.find(x=>x.id==='ground')?.id||'ground';if(d.targetLevelId===levelId)d.targetLevelId=m.levels.find(x=>x.id==='foundations')?.id||'foundations';}
  m.foundationAutomation=d;
 }
 if(Array.isArray(m.planSources))m.planSources=m.planSources.filter(s=>s.levelId!==levelId);
 if(m.spaceDesign)m.spaceDesign={...m.spaceDesign,names:cleanRoomNames(m.spaceDesign.names,levelId)};

 const ordinary=m.levels.filter(x=>!x.autoFloor).sort((a,b)=>a.elevation-b.elevation),below=ordinary.filter(x=>Number(x.elevation)<=oldElevation).at(-1),next=below||ordinary[0]||m.levels[0];
 m.activeLevelId=next?.id||'ground';app.selectedElement=null;app.selectedPart=null;app.drawingStart=null;$('#propertiesPanel')?.classList.add('hidden');
 refreshAll();root.dispatchEvent(new CustomEvent('pbp:level-deleted',{detail:{id:levelId,name:l.name}}));return l;
}
function refreshAll(){
 root.PBPBuildingUI?.refresh?.();root.PBPFoundationUI?.refresh?.();root.PBPEnvelopeUI?.refresh?.();root.PBPRoofUI?.refresh?.();root.PBPSpacesUI?.refresh?.();root.PBPAutonomyUI?.refresh?.();
 rebuildHiddenLevelSelect();renderNavigator();syncProperties();app.renderer2d?.draw();app.renderer3d?.draw();
}
function rebuildHiddenLevelSelect(){
 const s=$('#levelSelect');if(!s)return;const current=app.model.activeLevelId;s.replaceChildren();
 for(const l of app.model.levels){const o=document.createElement('option');o.value=l.id;o.textContent=(l.autoFloor?'▤ ':'')+l.name+' ('+fmt(l.elevation)+' m)';s.append(o);}
 if(app.model.levels.some(l=>l.id===current))s.value=current;
}

function openDelete(levelId){
 const l=app.model.levels.find(x=>x.id===levelId),guard=canDelete(l);if(!guard.ok){alert(guard.reason);return;}deleteTarget=levelId;
 const s=deletionStats(levelId);$('#levelDeleteTitle').textContent='Supprimer le niveau « '+l.name+' » ?';
 $('#levelDeleteSummary').innerHTML='<b>'+esc(l.name)+'</b> · altitude '+fmt(l.elevation)+' m<br>'+s.elements+' élément(s) seront supprimés'+(s.floors?' · '+s.floors+' plancher(s) lié(s)':'')+(s.structural?' · '+s.structural+' calcul(s) structure':'')+(s.envelopes?' · '+s.envelopes+' doublage(s)/cloison(s)':'')+(s.roofs?' · '+s.roofs+' toiture(s) liée(s)':'')+(s.sources?' · '+s.sources+' fond(s) importé(s)':'')+'.';
 $('#levelDeleteAck').checked=false;$('#levelDeleteConfirm').disabled=true;$('#levelDeleteDialog').showModal();
}
function renameLevel(levelId){
 const l=app.model.levels.find(x=>x.id===levelId);if(!l||l.autoFloor)return;const name=prompt('Nouveau nom du niveau :',l.name);if(!name?.trim())return;app.model.commit();l.name=name.trim().slice(0,80);rebuildHiddenLevelSelect();renderNavigator();app.renderer2d?.draw();app.renderer3d?.draw();
}
function elevationLevel(levelId){
 const l=app.model.levels.find(x=>x.id===levelId);if(!l||l.autoFloor)return;const val=prompt('Altitude du niveau (m) :',String(l.elevation));if(val===null)return;const z=Number(String(val).replace(',','.'));if(!Number.isFinite(z)){alert('Altitude invalide.');return;}app.model.commit();l.elevation=z;app.model.levels.sort((a,b)=>a.elevation-b.elevation);rebuildHiddenLevelSelect();renderNavigator();refreshAll();
}
function addAbove(levelId){
 const l=app.model.levels.find(x=>x.id===levelId);if(!l)return;const name=prompt('Nom du nouveau niveau :','Niveau '+(app.model.levels.filter(x=>!x.autoFloor).length));if(!name?.trim())return;const z=(Number(l.elevation)||0)+(Number(l.height)||2.8),next=app.model.addLevel(name.trim().slice(0,80),z,2.8);app.model.activeLevelId=next.id;rebuildHiddenLevelSelect();selectLevel(next.id);
}
function duplicateLevel(levelId){
 const l=app.model.levels.find(x=>x.id===levelId);if(!l||l.autoFloor)return;const name=prompt('Nom de la copie :',l.name+' copie');if(!name?.trim())return;
 const z=(Number(l.elevation)||0)+(Number(l.height)||2.8),m=app.model;m.commit(),newId=id('level'),next={...clone(l),id:newId,name:name.trim().slice(0,80),elevation:z,autoFloor:false};
 m.levels.push(next);m.levels.sort((a,b)=>a.elevation-b.elevation);
 const source=(m.elements||[]).filter(e=>e.levelId===levelId&&!e.generator);for(const e of source)m.elements.push({...clone(e),id:id('el'),levelId:newId});
 if(m.buildingDesign?.materials?.[levelId])m.buildingDesign.materials[newId]=clone(m.buildingDesign.materials[levelId]);
 m.activeLevelId=newId;refreshAll();selectLevel(newId);
}

function renderNavigator(){
 const list=$('#projectLevelList');if(!list)return;list.replaceChildren();const levels=[...app.model.levels].sort((a,b)=>a.elevation-b.elevation);
 for(const l of levels){
  const row=el('div','project-level'+(l.id===app.model.activeLevelId?' active':'')+(l.autoFloor?' generated':''));
  const main=el('button','project-level-main');main.type='button';main.innerHTML='<span class="level-icon">'+levelIcon(l)+'</span><span class="level-copy"><b>'+esc(l.name)+'</b><small>'+fmt(l.elevation)+' m'+(l.autoFloor?' · structure':'')+'</small></span>';main.onclick=()=>selectLevel(l.id);
  const menu=el('button','project-level-more','•••');menu.type='button';menu.title='Options du niveau';menu.onclick=e=>{e.stopPropagation();openLevelMenu(l.id,menu);};row.append(main,menu);list.append(row);
 }
 const title=$('#navigatorProjectName');if(title)title.textContent=app.model.projectName||'Mon projet';
}
function openLevelMenu(levelId,anchor){
 menuLevelId=levelId;const l=app.model.levels.find(x=>x.id===levelId),m=$('#levelContextMenu');if(!l||!m)return;
 for(const b of m.querySelectorAll('button')){const action=b.dataset.levelAction;b.disabled=l.autoFloor&&['rename','elevation','duplicate'].includes(action)||(action==='delete'&&!canDelete(l).ok);}
 const r=anchor.getBoundingClientRect();m.style.left=Math.max(8,Math.min(innerWidth-190,r.right-180))+'px';m.style.top=Math.min(innerHeight-230,r.bottom+4)+'px';m.hidden=false;
}
function closeLevelMenu(){const m=$('#levelContextMenu');if(m)m.hidden=true;menuLevelId=null;}

function makeTabs(){
 const bar=$('#tradeTabs'),pages=$('#tradeRibbonPages');for(const [id,label] of TABS){const b=el('button','trade-tab',label);b.type='button';b.dataset.tradeTab=id;b.onclick=()=>activateTab(id);bar.append(b);const p=el('div','trade-page');p.dataset.tradePage=id;p.hidden=id!==activeTab;pages.append(p);tabs.set(id,{button:b,page:p,groups:new Map()});}activateTab(activeTab);
}
function activateTab(id){if(!tabs.has(id))id='home';activeTab=id;for(const [k,t] of tabs){const on=k===id;t.button.classList.toggle('active',on);t.page.hidden=!on;}root.dispatchEvent(new CustomEvent('pbp:ribbon-tab',{detail:{id}}));}
function group(tabId,name){const t=tabs.get(tabId);if(!t)return null;if(t.groups.has(name))return t.groups.get(name);const g=el('section','trade-group'),body=el('div','trade-group-body'),title=el('div','trade-group-title',name);g.append(body,title);t.page.append(g);const o={root:g,body,title};t.groups.set(name,o);return o;}
function resolve(selector,closest){const e=typeof selector==='string'?$(selector):selector;if(!e)return null;return closest?e.closest(closest)||e:e;}
function place({tab,group:name,selector,element,closest,wide=false}){
 const e=element||resolve(selector,closest);if(!e||e.dataset.tradePlaced==='true')return e||null;const g=group(tab,name);if(!g)return null;e.dataset.tradePlaced='true';e.classList.add('trade-command');if(wide)e.classList.add('trade-wide');g.body.append(e);return e;
}
function proxy(tab,name,label,fn,title=''){const b=el('button','trade-command',label);b.type='button';b.title=title;b.onclick=fn;place({tab,group:name,element:b});return b;}
function organize(){
 const importLabel=$('#importInput')?.closest('label');if(importLabel){[...importLabel.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.textContent='Ouvrir JSON');importLabel.title='Ouvrir un projet natif';}
 // Application bar: only global/project commands.
 const appLeft=$('#appCommands'),appRight=$('#appViews');
 for(const s of ['#newProjectBtn','#saveBtn','#exportBtn']){const e=$(s);if(e)appLeft.append(e);}
 if(importLabel)appLeft.append(importLabel);if($('#importPlanBtn'))appLeft.append($('#importPlanBtn'));for(const s of ['#undoBtn','#redoBtn']){const e=$(s);if(e)appLeft.append(e);}
 const view=$('.view-switch');if(view)appRight.append(view);

 // Home.
 place({tab:'home',group:'Projet',selector:'#autoOpen'});place({tab:'home',group:'Bâtiment',selector:'#bOpenMaterials'});
 proxy('home','Navigation','Pièces',()=>root.PBPSpacesUI?.open?.());
 // Construction.
 for(const s of ['[data-tool="select"]','[data-tool="wallExterior"]','[data-tool="wallBearing"]','[data-tool="partition"]','[data-tool="column"]','[data-tool="beam"]'])place({tab:'construction',group:'Dessin',selector:s});
 for(const s of ['[data-tool="door"]','[data-tool="window"]','[data-tool="opening"]','[data-tool="stair"]'])place({tab:'construction',group:'Ouvertures & circulation',selector:s});
 place({tab:'construction',group:'Avant pose',selector:'#placementSettings',wide:true});
 // Structure.
 for(const s of ['#faOpen','#stFoundationOpen','#faShow','[data-tool="foundation"]'])place({tab:'structure',group:'Fondations',selector:s});
 for(const s of ['#joistAutoBtn','#bOpenFloors','[data-tool="slab"]'])place({tab:'structure',group:'Planchers & solivage',selector:s});
 // Roof.
 place({tab:'roof',group:'Toiture & charpente',selector:'#rfOpen'});proxy('roof','Documents','▣ Dossier toiture',()=>root.PBPRoofDocuments?.open?.());
 // Finish.
 place({tab:'finish',group:'Isolation & cloisons',selector:'#envOpen'});
 // Networks.
 proxy('networks','Réseaux','Gaines / vides techniques',()=>root.PBPBuildingUI?.open?.('technical'));
 // Terrain.
 proxy('terrain','Sol & fondations','Contexte sol / géotechnique',()=>$('#faOpen')?.click());proxy('terrain','Projet','Contexte réglementaire',()=>$('#autoOpen')?.click());
 // Documents.
 proxy('documents','Plans','Dossier toiture',()=>root.PBPRoofDocuments?.open?.());proxy('documents','Métré','Métré bâtiment',()=>root.PBPBuildingUI?.open?.('quantities'));
 place({tab:'documents',group:'Annotations',selector:'#spaceNames'});place({tab:'documents',group:'Annotations',selector:'[data-tool="dimension"]'});
 // View commands remain in a compact floating strip under app bar.
 const strip=$('#viewStrip');for(const s of ['#drawDimensions','#drawMagnets','#drawViews','.zoom-controls','#overlayBtn']){const e=resolve(s);if(e)strip.append(e);}
}
function setupFutureCommands(){
 root.PBPRibbon={activate:activateTab,register:(element,{tab='home',group='Autres',wide=false}={})=>place({tab,group,element,wide}),tabs:()=>TABS.map(x=>x[0])};
 new MutationObserver(()=>{for(const e of document.querySelectorAll('[data-pbp-tab][data-pbp-group]:not([data-trade-placed])'))place({tab:e.dataset.pbpTab,group:e.dataset.pbpGroup,element:e});}).observe(document.body,{childList:true,subtree:true});
}
function syncProperties(){
 const dock=$('#propertiesDock'),panel=$('#propertiesPanel'),empty=$('#propertiesEmpty');if(!dock||!panel||!empty)return;empty.hidden=!panel.classList.contains('hidden');
}
function setupPropertiesDock(){
 const dock=$('#propertiesDock'),panel=$('#propertiesPanel');if(!dock||!panel)return;dock.append(panel);panel.classList.add('properties-docked');const empty=el('div','properties-empty');empty.id='propertiesEmpty';empty.innerHTML='<b>PROPRIÉTÉS</b><p>Sélectionnez un mur, une pièce, une solive, une toiture ou un autre objet pour modifier ses paramètres.</p>';dock.prepend(empty);
 new MutationObserver(syncProperties).observe(panel,{attributes:true,attributeFilter:['class']});syncProperties();
}
function setupViewExtras(){
 const base=$('#gShowFloor')?.closest('label');if(base&&!$('#gShowRoofCover')){const label=document.createElement('label');label.innerHTML='<input id="gShowRoofCover" type="checkbox"> Couverture toit';base.after(label);const input=$('#gShowRoofCover');input.checked=app.model.view3D?.showRoofCover!==false;input.onchange=()=>{app.model.commit();app.model.view3D={...app.model.view3D,showRoofCover:input.checked};app.renderer3d?.draw();};}
 if(!$('#togglePlanSource')){const b=el('button','','Fond importé ✓');b.id='togglePlanSource';b.type='button';b.onclick=()=>{const rows=(app.model.planSources||[]).filter(s=>s.levelId===app.model.activeLevelId),show=rows.some(s=>s.hidden);rows.forEach(s=>s.hidden=!show);b.textContent=show?'Fond importé ✓':'Fond importé —';app.renderer2d?.draw();};$('#viewStrip').append(b);}
 for(const id of ['#gShowFoundations','#gShowFloor','#gShowRoofCover']){const lab=$(id)?.closest('label');if(lab)$('#viewStrip').append(lab);}
}
function setupDialogsAndMenus(){
 const menu=el('div','level-context-menu');menu.id='levelContextMenu';menu.hidden=true;menu.innerHTML='<button data-level-action="rename">Renommer</button><button data-level-action="duplicate">Dupliquer le niveau</button><button data-level-action="elevation">Modifier l’altitude</button><button data-level-action="above">Ajouter un niveau au-dessus</button><hr><button class="danger-text" data-level-action="delete">Supprimer le niveau…</button>';document.body.append(menu);
 menu.onclick=e=>{const b=e.target.closest('button[data-level-action]');if(!b||!menuLevelId)return;const x=menuLevelId,action=b.dataset.levelAction;closeLevelMenu();if(action==='rename')renameLevel(x);if(action==='duplicate')duplicateLevel(x);if(action==='elevation')elevationLevel(x);if(action==='above')addAbove(x);if(action==='delete')openDelete(x);};
 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!e.target.closest('.project-level-more'))closeLevelMenu();});
 const d=document.createElement('dialog');d.id='levelDeleteDialog';d.innerHTML='<form id="levelDeleteForm"><h3 id="levelDeleteTitle">Supprimer le niveau ?</h3><div id="levelDeleteSummary" class="delete-summary"></div><p class="delete-warning">Les objets et automatismes directement liés seront également supprimés. Vous pourrez revenir en arrière avec ↶ Annuler.</p><label class="delete-ack"><input id="levelDeleteAck" type="checkbox"> Je confirme la suppression de ce niveau.</label><div class="delete-actions"><button id="levelDeleteCancel" type="button">Annuler</button><button id="levelDeleteConfirm" type="submit" class="danger-button" disabled>Supprimer</button></div></form>';document.body.append(d);
 $('#levelDeleteAck').onchange=e=>$('#levelDeleteConfirm').disabled=!e.target.checked;$('#levelDeleteCancel').onclick=()=>d.close();$('#levelDeleteForm').onsubmit=e=>{e.preventDefault();if(!deleteTarget)return;try{const l=deleteLevelCascade(deleteTarget);d.close();deleteTarget=null;$('#statusSelection').textContent='Niveau « '+l.name+' » supprimé';}catch(err){alert(err.message);}};
}
function init(){
 const style=document.createElement('style');style.textContent=`
#app{grid-template-rows:auto auto auto minmax(0,1fr) 30px;background:#eef1f4}
.topbar{min-height:46px;padding:5px 9px;display:flex;gap:8px;align-items:center;background:#fff;border-bottom:1px solid #d7e0e6}.brand{font-size:13px;margin-right:6px}.top-actions{display:none!important}
.app-commandbar{display:flex;align-items:center;gap:5px;flex:1;min-width:0}.app-commandbar button,.app-commandbar select,.app-commandbar .file-button{font-size:10px;padding:5px 7px;white-space:nowrap}.app-commandbar .spacer{flex:1}.app-viewbar{display:flex;gap:5px;align-items:center}
.trade-tabs{display:flex;gap:2px;padding:0 10px;background:#fff;border-bottom:1px solid #dbe3e8;overflow-x:auto}.trade-tab{border:0;background:transparent;border-radius:5px 5px 0 0;padding:8px 12px 7px;font-size:11px;font-weight:650;color:#466273;white-space:nowrap}.trade-tab.active{background:#eef5f8;color:#174f69;border-bottom:2px solid #2b7598}
.trade-ribbon{height:90px;background:#f6f8fa;border-bottom:1px solid #ccd8df;overflow-x:auto;overflow-y:hidden;padding:5px 8px}.trade-page{height:80px;display:flex;gap:5px;min-width:max-content}.trade-page[hidden]{display:none!important}.trade-group{display:flex;flex-direction:column;border-right:1px solid #d4dee4;padding:2px 8px 0 4px;min-width:max-content}.trade-group-body{display:flex;gap:5px;align-items:flex-start;flex:1}.trade-group-title{text-align:center;color:#70818b;font-size:9px;line-height:14px}.trade-command{font-size:10px!important;min-height:31px!important;padding:5px 7px!important;margin:0!important;white-space:nowrap}.trade-command.tool{width:auto!important;text-align:center!important}.trade-wide{display:flex!important;gap:5px!important;align-items:center!important;max-width:520px}
#placementSettings.trade-command{display:grid!important;grid-template-columns:auto auto;gap:3px 7px;max-height:70px;overflow:auto;padding:5px!important;min-width:270px}#placementSettings .section-title,#placementSettings .preset-note{display:none}#placementSettings .placement-tool-name{grid-column:1/-1;font-size:10px;margin:0}#placementSettings .setting-row{margin:0;font-size:10px;grid-template-columns:72px 60px}
.view-strip{display:flex;align-items:center;gap:5px;min-height:35px;padding:3px 8px;background:#fff;border-bottom:1px solid #dbe3e8;overflow-x:auto}.view-strip button,.view-strip select,.view-strip label{font-size:10px;white-space:nowrap}.view-strip .draw-group{display:flex!important;gap:4px;align-items:center;border-right:1px solid #dfe6ea;padding-right:5px}.view-strip .draw-title{display:none}.view-strip #drawingToolbar{display:contents!important}
.workspace{display:grid!important;grid-template-columns:215px minmax(0,1fr) 265px;min-height:0;overflow:hidden}.tools-panel{display:none!important}.plan-column{min-width:0;min-height:0}.plan-column>#drawingToolbar{display:none!important}.canvas-shell{min-width:0;min-height:0}
.project-nav{background:#fff;border-right:1px solid #cfd9df;display:flex;flex-direction:column;min-height:0}.project-nav-head{padding:10px;border-bottom:1px solid #e0e7eb}.project-nav-head b{display:block;font-size:12px;color:#2e5265}.project-nav-head small{font-size:9px;color:#748690}.project-level-list{padding:6px;overflow:auto;flex:1}.project-level{display:grid;grid-template-columns:minmax(0,1fr) 30px;gap:2px;border-radius:5px;margin:2px 0}.project-level.active{background:#e8f2f7}.project-level.generated{opacity:.78}.project-level-main{border:0;background:transparent!important;display:flex;align-items:center;gap:7px;text-align:left;padding:7px 6px;min-width:0}.level-icon{width:18px;text-align:center;color:#45697b}.level-copy{display:flex;flex-direction:column;min-width:0}.level-copy b{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.level-copy small{font-size:9px;color:#73838d}.project-level-more{border:0;background:transparent!important;padding:3px;font-weight:800}.project-nav-foot{padding:7px;border-top:1px solid #e0e7eb;display:flex;gap:5px}.project-nav-foot button{flex:1;font-size:10px;padding:6px}
.properties-dock{background:#fff;border-left:1px solid #cfd9df;min-width:0;min-height:0;overflow:auto}.properties-docked{position:relative!important;top:auto!important;right:auto!important;width:100%!important;max-width:none!important;max-height:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;height:auto!important}.properties-empty{padding:13px;color:#71818b;font-size:11px;line-height:1.45}.properties-empty b{color:#39596a;font-size:11px}.properties-empty[hidden]{display:none!important}
.level-context-menu{position:fixed;z-index:120;background:#fff;border:1px solid #c8d5dd;border-radius:7px;box-shadow:0 10px 30px #20374430;padding:5px;width:180px}.level-context-menu[hidden]{display:none}.level-context-menu button{width:100%;text-align:left;border:0;background:transparent;border-radius:4px;font-size:11px;padding:7px}.level-context-menu button:hover{background:#edf4f7}.level-context-menu button:disabled{opacity:.4}.level-context-menu hr{border:0;border-top:1px solid #e2e8eb;margin:4px}.danger-text{color:#9a3b2e!important}
#levelDeleteDialog{width:min(500px,92vw)}.delete-summary{padding:10px;background:#eef4f7;border:1px solid #d3e0e6;border-radius:7px;font-size:12px;line-height:1.55}.delete-warning{font-size:11px;color:#785029;background:#fff4df;border-left:3px solid #d29a43;padding:8px}.delete-ack{font-size:12px}.delete-actions{display:flex;gap:7px;justify-content:flex-end}.danger-button{background:#a54334!important;color:white!important;border-color:#8b362a!important}.danger-button:disabled{opacity:.4!important}
#autoBadge{top:auto!important;bottom:35px;max-width:calc(100% - 20px)}
@media(max-width:1000px){.workspace{grid-template-columns:175px minmax(0,1fr) 220px}.trade-tab{padding:7px 9px}.trade-ribbon{height:84px}.trade-page{height:74px}}
@media(max-width:720px){.workspace{grid-template-columns:145px minmax(0,1fr)}.properties-dock{position:absolute;right:0;top:0;bottom:0;width:210px;z-index:45;box-shadow:-8px 0 20px #23374322}.properties-dock:has(.properties-panel.hidden){display:none}.trade-ribbon{height:78px}.trade-page{height:68px}.trade-command{font-size:9px!important}.brand{display:none}}
`;document.head.append(style);

 // Build application bar.
 const top=$('.topbar'),appbar=el('div','app-commandbar'),left=el('div','app-commandbar'),right=el('div','app-viewbar'),spacer=el('span','spacer');left.id='appCommands';right.id='appViews';appbar.append(left,spacer,right);top.append(appbar);

 // Trade tabs + ribbon + compact view strip.
 const tabsEl=el('nav','trade-tabs');tabsEl.id='tradeTabs';const ribbon=el('section','trade-ribbon');const pages=el('div');pages.id='tradeRibbonPages';ribbon.append(pages);const viewStrip=el('div','view-strip');viewStrip.id='viewStrip';top.after(tabsEl,ribbon,viewStrip);

 // Project navigator + properties dock.
 const workspace=$('.workspace'),plan=$('.plan-column')||$('#canvasShell'),nav=el('aside','project-nav'),dock=el('aside','properties-dock');nav.id='projectNavigator';dock.id='propertiesDock';
 nav.innerHTML='<div class="project-nav-head"><b id="navigatorProjectName">Mon projet</b><small>NIVEAUX DU BÂTIMENT</small></div><div id="projectLevelList" class="project-level-list"></div><div class="project-nav-foot"><button id="navAddLevel" type="button">+ Niveau</button><button id="navDeleteLevel" type="button">− Niveau</button></div>';
 workspace.insertBefore(nav,plan);workspace.append(dock);

 makeTabs();setupDialogsAndMenus();setupPropertiesDock();organize();setupViewExtras();setupFutureCommands();

 // Navigator buttons keep the native add-level workflow.
 $('#navAddLevel').onclick=()=>$('#addLevelBtn')?.click();$('#navDeleteLevel').onclick=()=>{const l=activeLevel(),g=canDelete(l);if(!g.ok){alert(g.reason);return;}openDelete(l.id);};
 $('#addLevelBtn').style.display='none';$('#levelSelect').style.display='none';
 new MutationObserver(()=>{renderNavigator();}).observe($('#levelSelect'),{childList:true,subtree:true});
 $('#levelSelect').addEventListener('change',()=>requestAnimationFrame(()=>{renderNavigator();syncProperties();}));
 renderNavigator();syncProperties();
 $('.version').textContent='v0.17.0';document.title='Plan Bâtiment Pro — v0.17.0';root.PBPWorkspaceReady=true;root.PBPWorkspaceLayout='bim-ribbon-v1';
 app.renderer2d?.resize();app.renderer3d?.resize();
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
