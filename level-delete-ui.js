/* Plan Bâtiment Pro v0.16.1 — safe level deletion, independent of workspace layout. */
(function(root){
'use strict';
const app=root.planApp,$=s=>document.querySelector(s),clone=v=>JSON.parse(JSON.stringify(v));
if(!app||!root.ProjectModel)return;
const PROTECTED=new Set(['foundations','ground','roof']);let target=null;
function current(){return app.model.levels.find(l=>l.id===app.model.activeLevelId)||null;}
function canDelete(l){
 if(!l)return{ok:false,reason:'Aucun niveau sélectionné.'};
 if(PROTECTED.has(l.id))return{ok:false,reason:'Ce niveau de base est protégé.'};
 if(l.autoFloor)return{ok:false,reason:'Ce niveau est généré par un plancher automatique. Supprimez le plancher depuis Structure.'};
 const user=app.model.levels.filter(x=>!x.autoFloor&&!PROTECTED.has(x.id));
 if(user.length<=1)return{ok:false,reason:'Le projet doit conserver au moins un niveau utilisateur.'};
 return{ok:true,reason:''};
}
function roomNames(names,id){const out={};for(const [k,v] of Object.entries(names||{})){let keep=true;try{const x=JSON.parse(k);if(Array.isArray(x)&&String(x[0])===String(id))keep=false;}catch{}if(keep)out[k]=v;}return out;}
function stats(id){
 const m=app.model,els=(m.elements||[]).filter(e=>e.levelId===id),ids=new Set(els.map(e=>e.id));
 return{elements:els.length,floors:(m.buildingDesign?.floors||[]).filter(f=>f.belowId===id||f.aboveId===id||f.id===id).length,structural:(m.structureDesign?.floors||[]).filter(f=>f.levelId===id||f.sourceLevelId===id).length,envelopes:(m.envelopeDesign?.assemblies||[]).filter(a=>a.levelId===id||ids.has(a.hostId)).length,roofs:(m.roofDesign?.groups||[]).filter(g=>g.supportLevelId===id).length,sources:(m.planSources||[]).filter(s=>s.levelId===id).length};
}
function rebuild(){
 const s=$('#levelSelect');if(!s)return;const id=app.model.activeLevelId;s.replaceChildren();
 for(const l of app.model.levels){const o=document.createElement('option');o.value=l.id;o.textContent=(l.autoFloor?'▤ ':'')+l.name+' ('+(Number(l.elevation)||0).toFixed(2).replace('.',',')+' m)';s.append(o);}
 if(app.model.levels.some(l=>l.id===id))s.value=id;sync();
}
function refresh(){
 root.PBPBuildingUI?.refresh?.();root.PBPFoundationUI?.refresh?.();root.PBPEnvelopeUI?.refresh?.();root.PBPRoofUI?.refresh?.();root.PBPSpacesUI?.refresh?.();root.PBPAutonomyUI?.refresh?.();rebuild();app.renderer2d?.draw();app.renderer3d?.draw();
}
function remove(id){
 const m=app.model,l=m.levels.find(x=>x.id===id),g=canDelete(l);if(!g.ok)throw Error(g.reason);const oldZ=Number(l.elevation)||0;m.commit();
 const removed=new Set((m.elements||[]).filter(e=>e.levelId===id).map(e=>e.id));
 m.elements=(m.elements||[]).filter(e=>e.levelId!==id&&!removed.has(e.hostWallId)&&!removed.has(e.sourceWallId));
 m.levels=(m.levels||[]).filter(x=>x.id!==id&&!(x.autoFloor&&(x.belowId===id||x.aboveId===id)));
 if(m.buildingDesign){const d=root.PBPBuilding?.settings?root.PBPBuilding.settings(m.buildingDesign):clone(m.buildingDesign);d.floors=(d.floors||[]).filter(f=>f.belowId!==id&&f.aboveId!==id&&f.id!==id);if(d.materials)delete d.materials[id];m.buildingDesign=d;}
 if(m.structureDesign){const d=root.PBPStructure?.settings?root.PBPStructure.settings(m.structureDesign):clone(m.structureDesign);d.floors=(d.floors||[]).filter(f=>f.levelId!==id&&f.sourceLevelId!==id);m.structureDesign=d;}
 if(m.envelopeDesign){const d=root.PBPEnvelope?.settings?root.PBPEnvelope.settings(m.envelopeDesign):clone(m.envelopeDesign);d.assemblies=(d.assemblies||[]).filter(a=>a.levelId!==id&&!removed.has(a.hostId));m.envelopeDesign=d;}
 if(m.roofDesign){if(Array.isArray(m.roofDesign.groups)){m.roofDesign={...m.roofDesign,groups:m.roofDesign.groups.filter(g=>g.supportLevelId!==id)};if(root.PBPCoverage?.roofSettings)m.roofDesign=root.PBPCoverage.roofSettings(m.roofDesign);}else if(m.roofDesign.supportLevelId===id)m.roofDesign={...m.roofDesign,enabled:false,supportLevelId:'ground'};}
 if(m.foundationAutomation){const d=root.PBPFoundations?.settings?root.PBPFoundations.settings(m.foundationAutomation):clone(m.foundationAutomation);if(d.sourceLevelId===id||d.targetLevelId===id){d.enabled=false;if(d.sourceLevelId===id)d.sourceLevelId='ground';if(d.targetLevelId===id)d.targetLevelId='foundations';}m.foundationAutomation=d;}
 if(Array.isArray(m.planSources))m.planSources=m.planSources.filter(s=>s.levelId!==id);
 if(m.spaceDesign)m.spaceDesign={...m.spaceDesign,names:roomNames(m.spaceDesign.names,id)};
 const levels=m.levels.filter(x=>!x.autoFloor).sort((a,b)=>a.elevation-b.elevation),next=levels.filter(x=>Number(x.elevation)<=oldZ).at(-1)||levels[0]||m.levels[0];m.activeLevelId=next?.id||'ground';app.selectedElement=null;app.drawingStart=null;$('#propertiesPanel')?.classList.add('hidden');refresh();return l;
}
function sync(){const b=$('#deleteLevelBtn');if(!b)return;const g=canDelete(current());b.disabled=!g.ok;b.title=g.ok?'Supprimer '+current().name:g.reason;}
function open(){
 const l=current(),g=canDelete(l);if(!g.ok){alert(g.reason);return;}target=l.id;const s=stats(l.id);
 $('#levelDeleteTitle').textContent='Supprimer le niveau « '+l.name+' » ?';
 $('#levelDeleteSummary').textContent=s.elements+' élément(s)'+(s.floors?' · '+s.floors+' plancher(s)':'')+(s.structural?' · '+s.structural+' calcul(s) structure':'')+(s.envelopes?' · '+s.envelopes+' doublage(s)':'')+(s.roofs?' · '+s.roofs+' toiture(s)':'')+(s.sources?' · '+s.sources+' fond(s) importé(s)':'')+' seront aussi concernés.';
 $('#levelDeleteAck').checked=false;$('#levelDeleteConfirm').disabled=true;$('#levelDeleteDialog').showModal();
}
function init(){
 const style=document.createElement('style');style.textContent='#deleteLevelBtn{border-color:#dab2aa;color:#8c3f32}#deleteLevelBtn:disabled{opacity:.42}.level-delete-summary{background:#eef4f7;border:1px solid #d5e1e7;border-radius:7px;padding:10px;font-size:12px;line-height:1.55}.level-delete-warning{font-size:11px;color:#7c4e27;background:#fff5df;border-left:3px solid #d29a43;padding:8px}.level-delete-actions{display:flex;gap:7px;justify-content:flex-end}.danger{background:#a54334!important;color:#fff!important;border-color:#8b362a!important}.danger:disabled{opacity:.4!important}#levelDeleteDialog{width:min(500px,92vw)}';document.head.append(style);
 const b=document.createElement('button');b.id='deleteLevelBtn';b.type='button';b.textContent='− Niveau';$('#addLevelBtn')?.after(b);b.onclick=open;
 const d=document.createElement('dialog');d.id='levelDeleteDialog';d.innerHTML='<form id="levelDeleteForm"><h3 id="levelDeleteTitle">Supprimer le niveau ?</h3><div id="levelDeleteSummary" class="level-delete-summary"></div><p class="level-delete-warning">Les objets et automatismes liés seront supprimés avec le niveau. Vous pourrez utiliser ↶ Annuler après l’opération.</p><label><input id="levelDeleteAck" type="checkbox"> Je confirme la suppression.</label><div class="level-delete-actions"><button id="levelDeleteCancel" type="button">Annuler</button><button id="levelDeleteConfirm" type="submit" class="danger" disabled>Supprimer</button></div></form>';document.body.append(d);
 $('#levelDeleteAck').onchange=e=>$('#levelDeleteConfirm').disabled=!e.target.checked;$('#levelDeleteCancel').onclick=()=>d.close();$('#levelDeleteForm').onsubmit=e=>{e.preventDefault();if(!target)return;try{const l=remove(target);target=null;d.close();$('#statusSelection').textContent='Niveau « '+l.name+' » supprimé';}catch(err){alert(err.message);}};
 $('#levelSelect')?.addEventListener('change',()=>requestAnimationFrame(sync));new MutationObserver(sync).observe($('#levelSelect'),{childList:true,subtree:true});sync();
 root.PBPLevelDeleteReady=true;
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);