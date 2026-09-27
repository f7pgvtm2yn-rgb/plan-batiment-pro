/* Plan Bâtiment Pro v0.16.16 — sheets / lazy calculation coordinator.
   One central building model, multiple cached working sheets. Heavy engines run only
   for the active sheet that needs them (or for the 3D sheet). */
(function(root){
'use strict';
const app=root.planApp;
const P=root.ProjectModel?.prototype;
const clone=v=>JSON.parse(JSON.stringify(v));
const calculated=new Map();
function rawStories(model=app.model){
 const foundationIds=new Set(['foundations']);
 try{for(const id of root.PBPGeometry?.foundationIds?.(model)||[])foundationIds.add(id);}catch(_){}
 return (model.levels||[]).filter(l=>!l.autoFloor&&!foundationIds.has(l.id)&&l.id!=='roof'&&!/^toiture$/i.test(l.name||'')).sort((a,b)=>Number(a.elevation)-Number(b.elevation));
}
function floorConfigs(model=app.model){
 const rows=model.buildingDesign?.floors;
 return Array.isArray(rows)?rows.filter(f=>f&&f.enabled!==false&&f.id):[];
}
function sheets(model=app.model){
 const out=rawStories(model).map((l,i)=>({id:'story:'+l.id,kind:'story',levelId:l.id,label:l.name||('Niveau '+(i+1)),icon:'▱',order:10+i}));
 for(const [i,f] of floorConfigs(model).entries()){
  const upper=(model.levels||[]).find(l=>l.id===f.aboveId),lower=(model.levels||[]).find(l=>l.id===f.belowId);
  out.push({id:'floor:'+f.id,kind:'floor',floorId:f.id,levelId:f.id,label:'Solivage '+(upper?.name||lower?.name||i+1),subtitle:(lower?.name&&upper?.name)?lower.name+' → '+upper.name:'',icon:'▥',order:100+i});
 }
 out.push({id:'foundations',kind:'foundations',levelId:(model.levels||[]).some(l=>l.id==='foundations')?'foundations':rawStories(model)[0]?.id,label:'Fondations',icon:'▰',order:200});
 out.push({id:'roof',kind:'roof',levelId:(model.levels||[]).some(l=>l.id==='roof')?'roof':rawStories(model).at(-1)?.id,label:'Toiture / charpente',icon:'⌂',order:210});
 out.push({id:'3d',kind:'3d',levelId:null,label:'Vue 3D',icon:'◇',order:300});
 return out.sort((a,b)=>a.order-b.order);
}
function fallbackId(model=app.model){
 const active=model.sheetState?.activeId;if(active&&sheets(model).some(s=>s.id===active))return active;
 const level=model.activeLevelId,story=sheets(model).find(s=>s.kind==='story'&&s.levelId===level);return story?.id||sheets(model)[0]?.id||'3d';
}
function active(model=app.model){const id=fallbackId(model);return sheets(model).find(s=>s.id===id)||sheets(model)[0];}
function setActive(id,model=app.model){
 if(!sheets(model).some(s=>s.id===id))return null;
 model.sheetState={...(model.sheetState||{}),activeId:id};root.dispatchEvent(new CustomEvent('pbp:sheet-change',{detail:{sheet:active(model)}}));return active(model);
}
function needs(engine,model=app.model){
 const s=active(model);if(!s)return true;if(s.kind==='3d')return true;
 if(engine==='building')return s.kind==='floor';
 if(engine==='structure')return s.kind==='3d';
 if(engine==='foundations')return s.kind==='foundations';
 if(engine==='roof')return s.kind==='roof';
 return false;
}
function revision(model=app.model){return Number(model?._pbpRevision)||0;}
function markCalculated(id=fallbackId(),model=app.model){calculated.set(id,revision(model));root.dispatchEvent(new CustomEvent('pbp:sheet-status',{detail:{id,status:'current'}}));}
function status(id,model=app.model){
 const s=sheets(model).find(x=>x.id===id);if(!s)return'unknown';if(s.kind==='story')return'current';
 const r=calculated.get(id);if(r===undefined)return'never';return r===revision(model)?'current':'stale';
}
function invalidateAll(){root.dispatchEvent(new CustomEvent('pbp:sheet-status',{detail:{status:'stale'}}));}
function emptyBuilding(){return{floors:[],elements:[],levels:[],quantities:{rows:[],issues:[]}};}
function emptyStructure(){return{floors:[],elements:[],foundation:{issues:[]},missing:[],globalNotice:''};}
function emptyFoundation(model=app.model){
 const settings=root.PBPFoundations?.settings?root.PBPFoundations.settings(model.foundationAutomation):{enabled:false};
 return{elements:[],issues:[],wallCount:0,totalLength:0,spanCount:0,padCount:0,maxSpan:0,depth:null,baseZ:null,topZ:null,settings,standards:{}};
}
function emptyRoof(model=app.model){
 const settings=root.PBPRoof?.settings?root.PBPRoof.settings(model.roofDesign):{enabled:false};
 return{settings,geometry:null,elements:[],issues:[],count:0,section:null};
}
if(P){
 const oldSnap=P.snapshot,oldRestore=P.restore;
 P.snapshot=function(){const d=JSON.parse(oldSnap.call(this));d.sheetState=clone(this.sheetState||{activeId:fallbackId(this)});return JSON.stringify(d);};
 P.restore=function(text){const d=JSON.parse(text);oldRestore.call(this,text);this.sheetState=clone(d.sheetState||{});calculated.clear();};
}
const api={version:'0.16.16',sheets,rawStories,floorConfigs,active,setActive,needs,revision,status,markCalculated,invalidateAll,emptyBuilding,emptyStructure,emptyFoundation,emptyRoof,getCalculatedRevision:id=>calculated.get(id)};
root.PBPSheets=api;root.PBPSheetsReady=true;
})(window);
