/* Plan Bâtiment Pro v0.16.7 — level-reference engine.
   Default: one object inherits the level where it is placed.
   Multi-level objects (opening/stair) retain source + target references. */
(function(root){
'use strict';
const EPS=1e-6;
const LEVEL_HEIGHT_TYPES=new Set(['wallExterior','wallBearing','partition','column']);
const MULTI_LEVEL_TYPES=new Set(['opening','stair']);
const finite=v=>Number.isFinite(Number(v));
const num=(v,f=null)=>finite(v)?Number(v):f;
const storyLevels=model=>(model?.levels||[]).filter(l=>!l.autoFloor&&l.id!=='foundations').sort((a,b)=>Number(a.elevation)-Number(b.elevation));
const level=(model,id)=>(model?.levels||[]).find(l=>l.id===id)||null;

function floorReports(rootObj){
 try{return rootObj?.PBPBuildingUI?.getReport?.()?.floors||[];}catch{return [];}
}
function floorConfigs(model){
 return Array.isArray(model?.buildingDesign?.floors)?model.buildingDesign.floors.filter(f=>f?.enabled!==false):[];
}
function floorForPlacement(model,placementId,reports=[]){
 const placed=level(model,placementId);
 if(placed?.autoFloor){
  const r=reports.find(x=>x?.config?.id===placed.id||x?.level?.id===placed.id||(x?.config?.belowId===placed.belowId&&x?.config?.aboveId===placed.aboveId));
  if(r)return{report:r,config:r.config};
  const c=floorConfigs(model).find(x=>x.id===placed.id||(x.belowId===placed.belowId&&x.aboveId===placed.aboveId));
  if(c)return{report:null,config:c};
  if(placed.belowId&&placed.aboveId)return{report:null,config:{id:placed.id,belowId:placed.belowId,aboveId:placed.aboveId}};
 }
 let r=reports.find(x=>x?.config?.aboveId===placementId);
 if(!r)r=reports.find(x=>x?.config?.belowId===placementId);
 if(r)return{report:r,config:r.config};
 let c=floorConfigs(model).find(x=>x.aboveId===placementId);
 if(!c)c=floorConfigs(model).find(x=>x.belowId===placementId);
 return c?{report:null,config:c}:null;
}
function fallbackPair(model,placementId){
 const placed=level(model,placementId),stories=storyLevels(model);if(!placed)return null;
 if(placed.autoFloor&&placed.belowId&&placed.aboveId)return{sourceLevelId:placed.belowId,targetLevelId:placed.aboveId};
 const i=stories.findIndex(l=>l.id===placementId);
 if(i<0)return null;
 if(i>0)return{sourceLevelId:stories[i-1].id,targetLevelId:stories[i].id};
 if(i+1<stories.length)return{sourceLevelId:stories[i].id,targetLevelId:stories[i+1].id};
 return null;
}
function openingReference(model,placementId,reports=[]){
 const found=floorForPlacement(model,placementId,reports),pair=found?.config?{sourceLevelId:found.config.belowId,targetLevelId:found.config.aboveId}:fallbackPair(model,placementId);
 if(!pair)return{kind:'multi-level',role:'floor-opening',placementLevelId:placementId,resolved:false,reason:'Aucun couple de niveaux ne définit le plancher traversé.'};
 const source=level(model,pair.sourceLevelId),target=level(model,pair.targetLevelId),r=found?.report;
 let zBase=null,height=null,resolved=false;
 if(r&&finite(r.bottom)&&finite(r.requiredTop)&&Number(r.requiredTop)>Number(r.bottom)+EPS){zBase=Number(r.bottom);height=Number(r.requiredTop)-zBase;resolved=true;}
 else if(r&&finite(r.bottom)&&finite(r.top)&&Number(r.top)>Number(r.bottom)+EPS){zBase=Number(r.bottom);height=Number(r.top)-zBase;resolved=true;}
 const structuralBase=source&&finite(source.elevation)&&finite(source.height)?Number(source.elevation)+Number(source.height):null;
 return{kind:'multi-level',role:'floor-opening',placementLevelId:placementId,sourceLevelId:pair.sourceLevelId,targetLevelId:pair.targetLevelId,linkedFloorId:found?.config?.id||null,zBase:resolved?zBase:structuralBase,height:resolved?height:null,resolved,sourceElevation:num(source?.elevation),targetElevation:num(target?.elevation),reason:resolved?'Épaisseur issue du plancher lié.':'Plancher lié identifié, mais son épaisseur verticale complète reste à déterminer.'};
}
function stairReference(model,placementId){
 const placed=level(model,placementId);let pair;
 if(placed?.autoFloor&&placed.belowId&&placed.aboveId)pair={sourceLevelId:placed.belowId,targetLevelId:placed.aboveId};
 else{
  const stories=storyLevels(model),i=stories.findIndex(l=>l.id===placementId);
  if(i>=0&&i+1<stories.length)pair={sourceLevelId:stories[i].id,targetLevelId:stories[i+1].id};
  else pair=fallbackPair(model,placementId);
 }
 if(!pair)return{kind:'multi-level',role:'vertical-connection',placementLevelId:placementId,resolved:false,reason:'Niveau cible absent.'};
 const source=level(model,pair.sourceLevelId),target=level(model,pair.targetLevelId),z=num(source?.elevation),top=num(target?.elevation),h=z!==null&&top!==null&&top>z+EPS?top-z:null;
 return{kind:'multi-level',role:'vertical-connection',placementLevelId:placementId,...pair,zBase:z,height:h,resolved:h!==null,sourceElevation:z,targetElevation:top,reason:h!==null?'Hauteur issue des altitudes source/cible.':'Altitudes source/cible incomplètes.'};
}
function singleReference(model,placementId){
 const l=level(model,placementId);
 return{kind:'single-level',role:'level-object',placementLevelId:placementId,referenceLevelId:placementId,zBase:num(l?.elevation),levelHeight:num(l?.height),resolved:!!l&&finite(l.elevation),reason:l?'Référence verticale du niveau de pose.':'Niveau de pose introuvable.'};
}
function referenceFor(model,type,placementId,reports=[]){
 if(type==='opening')return openingReference(model,placementId,reports);
 if(type==='stair')return stairReference(model,placementId);
 return singleReference(model,placementId);
}
function applyReference(model,input,placementId,reports=[]){
 const ref=referenceFor(model,input?.type,placementId,reports),out={...input,placementLevelId:placementId,verticalReferenceKind:ref.role,verticalReferenceResolved:ref.resolved};
 if(ref.zBase!==null&&ref.zBase!==undefined)out.zBase=ref.zBase;
 if(ref.kind==='single-level'){
  out.referenceLevelId=ref.referenceLevelId;
  if(LEVEL_HEIGHT_TYPES.has(input?.type)&&ref.levelHeight!==null){out.height=ref.levelHeight;out.levelHeightLinked=true;}
 }else{
  out.sourceLevelId=ref.sourceLevelId||null;out.targetLevelId=ref.targetLevelId||null;
  if(ref.linkedFloorId)out.linkedFloorId=ref.linkedFloorId;
  if(input?.type==='opening')out.openingFraming='auto';
  out.multiLevelLinked=true;out.verticalReferenceReason=ref.reason;
  if(ref.height!==null&&ref.height!==undefined)out.height=ref.height;
 }
 return out;
}
function syncElement(model,e,reports=[]){
 if(!e||e.generator||e.mode!=='construction')return false;let changed=false;
 const set=(k,v)=>{if(v!==undefined&&v!==null&&e[k]!==v){e[k]=v;changed=true;}};
 if(e.type==='opening'){
  const ref=openingReference(model,e.placementLevelId||e.levelId,reports);
  set('placementLevelId',e.placementLevelId||e.levelId);set('sourceLevelId',ref.sourceLevelId);set('targetLevelId',ref.targetLevelId);if(ref.linkedFloorId)set('linkedFloorId',ref.linkedFloorId);
  set('verticalReferenceKind','floor-opening');set('multiLevelLinked',true);set('openingFraming','auto');set('verticalReferenceResolved',ref.resolved);
  if(ref.zBase!==null)set('zBase',ref.zBase);if(ref.height!==null)set('height',ref.height);return changed;
 }
 if(e.type==='stair'){
  const ref=stairReference(model,e.placementLevelId||e.levelId);
  set('placementLevelId',e.placementLevelId||e.levelId);set('sourceLevelId',ref.sourceLevelId);set('targetLevelId',ref.targetLevelId);set('verticalReferenceKind','vertical-connection');set('multiLevelLinked',true);set('verticalReferenceResolved',ref.resolved);
  if(ref.zBase!==null)set('zBase',ref.zBase);if(ref.height!==null)set('height',ref.height);return changed;
 }
 const ref=singleReference(model,e.referenceLevelId||e.levelId);set('referenceLevelId',ref.referenceLevelId);set('verticalReferenceKind','level-object');if(ref.zBase!==null)set('zBase',ref.zBase);
 if(LEVEL_HEIGHT_TYPES.has(e.type)){
  if(e.levelHeightLinked===true){if(ref.levelHeight!==null)set('height',ref.levelHeight);}
  else if(e.levelHeightLinked===undefined){
   const defaultLike=Math.abs(num(e.height,NaN)-2.8)<.001||Math.abs(num(e.height,NaN)-num(ref.levelHeight,NaN))<.001;
   e.levelHeightLinked=!!defaultLike;changed=true;if(defaultLike&&ref.levelHeight!==null)set('height',ref.levelHeight);
  }
 }
 return changed;
}
function sync(model,rootObj=root){
 const reports=floorReports(rootObj);let changed=false;for(const e of model?.elements||[])if(syncElement(model,e,reports))changed=true;return changed;
}
function describe(model,e){
 if(!e)return null;const l=id=>level(model,id)?.name||id||'—';
 if(e.type==='opening')return 'Trémie · '+l(e.sourceLevelId)+' → '+l(e.targetLevelId)+(e.linkedFloorId?' · plancher lié':'');
 if(e.type==='stair')return 'Escalier · '+l(e.sourceLevelId)+' → '+l(e.targetLevelId);
 return 'Niveau de référence · '+l(e.referenceLevelId||e.levelId);
}

const api={LEVEL_HEIGHT_TYPES,MULTI_LEVEL_TYPES,storyLevels,floorForPlacement,fallbackPair,openingReference,stairReference,singleReference,referenceFor,applyReference,syncElement,sync,describe};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root?.planApp||!root?.ProjectModel){if(root)root.PBPLevelReferences=api;return;}

const app=root.planApp,P=root.ProjectModel.prototype,oldAdd=P.addElement,oldUpdate=P.updateElement;
P.addElement=function(input){
 const placementId=this.activeLevelId,next=applyReference(this,input,placementId,floorReports(root));
 return oldAdd.call(this,next);
};
P.updateElement=function(id,patch){
 const e=this.elements.find(x=>x.id===id);if(!e)return;
 const next={...patch};
 if(next.height!==undefined&&MULTI_LEVEL_TYPES.has(e.type)&&e.multiLevelLinked){delete next.height;}
 if(next.height!==undefined&&LEVEL_HEIGHT_TYPES.has(e.type)){next.levelHeightLinked=false;next.verticalReferenceKind='level-base-custom-height';}
 if(!Object.keys(next).length)return;
 return oldUpdate.call(this,id,next);
};

function decorateProperties(){
 const e=app.selectedElement,body=document.querySelector('#propertiesBody');if(!e||!body)return;
 const old=body.querySelector('.level-reference-note');if(old)old.remove();
 const box=document.createElement('div');box.className='prop-help level-reference-note';box.textContent=describe(app.model,e)||'';body.prepend(box);
 if(MULTI_LEVEL_TYPES.has(e.type)&&e.multiLevelLinked){const h=body.querySelector('input[data-prop="height"]');if(h){h.disabled=true;h.title='Hauteur pilotée par les niveaux/plancher liés.';}}
}
function refresh(){
 const changed=sync(app.model,root);decorateProperties();if(changed){app.renderer2d?.draw();app.renderer3d?.draw();}
}
const panel=document.querySelector('#propertiesPanel');if(panel)new MutationObserver(()=>queueMicrotask(decorateProperties)).observe(panel,{attributes:true,childList:true,subtree:true});
document.querySelector('#levelSelect')?.addEventListener('change',()=>queueMicrotask(refresh));
document.addEventListener('change',()=>queueMicrotask(()=>sync(app.model,root)),true);
setTimeout(refresh,0);

root.PBPLevelReferences=api;root.PBPLevelReferenceReady=true;
})(typeof window!=='undefined'?window:globalThis);
