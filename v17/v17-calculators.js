/* Plan Bâtiment Pro v17 — explicit, lazy calculators. No prototype patching. */
(function(root){
'use strict';
const G=root.PBPGeometry,S=root.PBPStructure,F=root.PBPFoundations,B=root.PBPBuilding,R=root.PBPRoof,Z=root.PBPSpaces,C=root.PBPCoverage;
const clone=v=>JSON.parse(JSON.stringify(v));
const warn=(text,code='v17')=>({severity:'warning',text,code});
const err=(text,code='v17')=>({severity:'error',text,code});

function floorConfig(model,id){
  const rows=B.settings(model.buildingDesign).floors||[];
  return rows.find(x=>x.id===id)||rows.find(x=>'floor:'+x.id===id)||null;
}
function scopedFloorGeometry(model,c){
  if(!C||!Z)return{geometry:G,coverage:null,blank:null};
  const data=Z.zones(model,c.belowId,'structure',G,S),pick=Z.resolve(data.rows,c.coverageZones);
  if(pick.missing.length&&data.rows.length===1&&(c.assistant===true||c.coverageFollowWalls!==false)){
    const followed=Z.resolve(data.rows,{mode:'all',ids:[]});
    const scoped=G;
    return{geometry:scoped,coverage:{data,pick:followed,followed:true},blank:null};
  }
  if(pick.missing.length)return{geometry:G,coverage:{data,pick},blank:C.blankFloor(model,c,'Le contour des zones choisies a changé. Resélectionnez les zones.')};
  if(pick.selection.mode==='selected'&&!pick.chosen.length)return{geometry:G,coverage:{data,pick},blank:C.blankFloor(model,c,'Toutes les zones sont volontairement laissées sans plancher.',true)};
  const scoped=pick.selection.mode==='all'?G:{...G,faces:(m,id,s)=>id===c.belowId?{faces:pick.chosen.map(x=>x.face),issues:data.issues}:G.faces(m,id,s)};
  return{geometry:scoped,coverage:{data,pick},blank:null};
}
function attachCoverage(model,c,r,coverage){
  if(!coverage||!C)return r;
  const {data,pick}=coverage,chosen=new Set(pick.chosen.map(x=>x.id)),omitted=data.rows.filter(x=>!chosen.has(x.id));
  if(coverage.followed)r.issues.push(warn('La zone unique de solivage a suivi automatiquement le nouveau contour des murs.','follow-walls'));
  if(pick.selection.mode==='selected'&&C.aboveVoid(model,c,omitted,S)){
    r.complete=false;r.elements=[];r.count=0;
    r.issues.push(err('Une charge porteuse existe au-dessus d’une zone laissée vide. Reprise à dimensionner.','load-above-void'));
  }
  r.zoneCoverage={totalArea:pick.totalArea,selectedArea:pick.selectedArea,excludedArea:Math.max(0,pick.totalArea-pick.selectedArea),ids:pick.chosen.map(x=>x.id),names:pick.chosen.map(x=>x.name),missing:pick.missing};
  return r;
}
function floor(model,id){
  const c=floorConfig(model,id);if(!c)throw Error('Configuration de plancher introuvable.');
  const scope=scopedFloorGeometry(model,c);let r=scope.blank;
  if(!r){
    r=B.floorReport(model,c,scope.geometry,S);
    if(root.PBPRims)r=root.PBPRims.calculate(model,c,r,scope.geometry,S);
    if(root.PBPJoistCoverage)r=root.PBPJoistCoverage.augment(model,c,r,scope.geometry,S);
    r=attachCoverage(model,c,r,scope.coverage);
  }
  if(root.PBPOpeningFraming)r=root.PBPOpeningFraming.process(model,c,r,B);
  if(root.PBPBlocking)r=root.PBPBlocking.process(model,c,r,B);
  if(root.PBPFloorDetails)r=root.PBPFloorDetails.process(model,c,r,B,S);
  r.v17Engine=true;return r;
}
function foundations(model){
  const pre=S.foundation(model),r=F.compute({...model,foundationAutomation:pre.effective});
  if(r.settings?.enabled)r.issues=[...(r.issues||[]),...(pre.issues||[])];
  r.v17Engine=true;return r;
}
function roof(model){
  if(Array.isArray(model.roofDesign?.groups)&&C?.roofGroups){
    const groups=C.roofGroups(model.roofDesign,R).map(cfg=>C.roofGroupReport(model,cfg,G,S,R)),active=groups.filter(x=>x.settings.enabled),issues=active.flatMap(x=>(x.issues||[]).map(i=>({...i,text:x.settings.name+' : '+i.text}))),seen=new Map();
    for(const rr of active)for(const id of rr.zoneCoverage?.ids||[]){
      const k=rr.settings.supportLevelId+'|'+id;
      if(seen.has(k)){issues.push(err('Deux toitures couvrent la même zone : '+seen.get(k)+' / '+rr.settings.name,'roof-overlap'));rr.elements=[];rr.complete=false;}
      else seen.set(k,rr.settings.name);
    }
    return{settings:{...R.settings(model.roofDesign),enabled:active.length>0},groups,issues,elements:active.flatMap(x=>x.elements||[]),count:active.reduce((n,x)=>n+(x.count||0),0),section:active.length===1?active[0].section:null,complete:active.length>0&&active.every(x=>x.complete)&&!issues.some(i=>i.severity==='error'),geometry:active.some(x=>x.geometry)?{zones:active.flatMap(x=>x.geometry?.zones||[])}:null,v17Engine:true};
  }
  const r=R.report(model,G,S);r.v17Engine=true;return r;
}
function rooms(model,levelId){return Z.rooms(model,levelId,G);}
function quantities(model,floorResults,foundationResult){
  try{return B.quantities(model,floorResults||[],F);}
  catch(e){
    const rows=[];for(const r of floorResults||[]){const name=r.config?.name||r.level?.name||'Plancher';for(const el of r.elements||[]){if(!el.a||!el.b)continue;const L=Math.hypot(el.b.x-el.a.x,el.b.y-el.a.y);if(['joists','rimJoist','blocking','panelJointSupport'].includes(el.role))rows.push({level:name,material:'bois',label:el.role,unit:'m',quantity:L});}}
    return{rows,issues:[warn('Métré simplifié utilisé : '+e.message)]};
  }
}
root.PBPV17Calc={floor,foundations,roof,rooms,quantities,floorConfig,clone,version:'17.0.0'};
})(window);