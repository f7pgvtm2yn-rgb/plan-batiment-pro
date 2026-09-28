/* Plan Bâtiment Pro v0.17.0 Clean Core — explicit calculation adapters.
   No prototype patching. Existing calculation engines are composed here in one fixed pipeline. */
(function(root){
'use strict';
const G=root.PBPGeometry,S=root.PBPStructure,F=root.PBPFoundations,B=root.PBPBuilding,R=root.PBPRoof,Z=root.PBPSpaces,C=root.PBPCoverage;
const clone=v=>JSON.parse(JSON.stringify(v));
function issue(text,severity='warning',code='clean'){return{text,severity,code};}

function floorConfig(model,id){
 const rows=B?.settings(model.buildingDesign)?.floors||[];
 return rows.find(x=>x.id===id)||rows.find(x=>'floor:'+x.id===id)||null;
}
function selectedGeometry(model,c){
 if(!C||!Z||!c)return{geometry:G,coverage:null,blank:null};
 const d=Z.zones(model,c.belowId,'structure',G,S);let pick=Z.resolve(d.rows,c.coverageZones),followed=false;
 // Clean Core: a single automatic floor zone follows a moved exterior wall.
 // There is no ambiguity when exactly one closed structural zone exists.
 if(pick.missing.length&&d.rows.length===1&&(c.assistant===true||c.coverageFollowWalls!==false)){
   pick=Z.resolve(d.rows,{mode:'all',ids:[]});followed=true;
 }
 if(pick.missing.length)return{geometry:G,coverage:{data:d,pick},blank:C.blankFloor(model,c,'Le contour de '+pick.missing.length+' zone(s) choisie(s) a changé. Resélectionnez les zones : aucun remplacement automatique.')};
 if(pick.selection.mode==='selected'&&!pick.chosen.length)return{geometry:G,coverage:{data:d,pick},blank:C.blankFloor(model,c,'Toutes les zones sont volontairement laissées sans plancher. Aucun plafond horizontal ni solive de plancher n’est généré.',true)};
 const scoped=pick.selection.mode==='all'?G:{...G,faces:(mm,id,ss)=>id===c.belowId?{faces:pick.chosen.map(x=>x.face),issues:d.issues}:G.faces(mm,id,ss)};
 return{geometry:scoped,coverage:{data:d,pick,followed},blank:null};
}
function attachCoverage(model,c,r,coverage){
 if(!coverage||!C||!Z)return r;
 const {data:d,pick}=coverage,chosenIds=new Set(pick.chosen.map(x=>x.id)),omitted=d.rows.filter(x=>!chosenIds.has(x.id));if(coverage.followed)r.issues.push(issue('Contour du RDC modifié : la zone unique de solivage a suivi automatiquement les nouveaux murs.','warning','coverage-follow-walls'));
 if(pick.selection.mode==='selected'&&C.aboveVoid(model,c,omitted,S)){
   r.complete=false;r.elements=[];r.count=0;r.issues.push(issue('Mur porteur, poutre ou poteau au-dessus d’une zone laissée vide : justifier sa reprise avant de retirer le plancher.','error','load-above-void'));
 }
 r.zoneCoverage={totalArea:pick.totalArea,selectedArea:pick.selectedArea,excludedArea:Math.max(0,pick.totalArea-pick.selectedArea),ids:pick.chosen.map(x=>x.id),names:pick.chosen.map(x=>x.name),missing:pick.missing};
 if(pick.selection.mode==='selected'){
   r.coverage={...(r.coverage||{}),totalArea:pick.selectedArea,coveredArea:r.complete?pick.selectedArea:0,missingArea:r.complete?0:pick.selectedArea};
   if(r.zoneCoverage.excludedArea>1e-6)r.issues.push(issue(r.zoneCoverage.excludedArea.toFixed(2)+' m² sur axes laissés volontairement sans plancher. Appuis de bord, garde-corps et stabilité restent à vérifier.','warning','intentional-void'));
 }
 return r;
}
function floor(model,id){
 if(!B||!G||!S)throw Error('Moteur de solivage indisponible.');
 const c=floorConfig(model,id);if(!c)throw Error('Configuration de plancher introuvable.');
 const scope=selectedGeometry(model,c);let r;
 if(scope.blank)r=scope.blank;
 else{
   r=B.floorReport(model,c,scope.geometry,S);
   if(root.PBPRims)r=root.PBPRims.calculate(model,c,r,scope.geometry,S);
   if(root.PBPJoistCoverage)r=root.PBPJoistCoverage.augment(model,c,r,scope.geometry,S);
   r=attachCoverage(model,c,r,scope.coverage);
 }
 if(root.PBPOpeningFraming)r=root.PBPOpeningFraming.process(model,c,r,B);
 if(root.PBPBlocking)r=root.PBPBlocking.process(model,c,r,B);
 if(root.PBPFloorDetails)r=root.PBPFloorDetails.process(model,c,r,B,S);
 r.cleanEngine='0.17.0';return r;
}
function foundations(model){
 if(!F||!S)throw Error('Moteur de fondations indisponible.');
 const prestudy=S.foundation(model),r=F.compute({...model,foundationAutomation:prestudy.effective});
 if(r.settings?.enabled)r.issues=[...(r.issues||[]),...(prestudy.issues||[])];
 r.cleanEngine='0.17.0';return r;
}
function roof(model){
 if(!R)return{settings:{enabled:false},elements:[],issues:[],count:0,complete:false,cleanEngine:'0.17.0'};
 if(Array.isArray(model.roofDesign?.groups)&&C){
   const groups=C.roofGroups(model.roofDesign,R).map(c=>C.roofGroupReport(model,c,G,S,R)),active=groups.filter(x=>x.settings.enabled),issues=active.flatMap(x=>(x.issues||[]).map(i=>({...i,text:x.settings.name+' : '+i.text}))),seen=new Map();
   for(const rr of active)for(const id of rr.zoneCoverage?.ids||[]){const k=rr.settings.supportLevelId+'|'+id;if(seen.has(k)){issues.push(issue('Deux toitures couvrent la même zone au même niveau : '+seen.get(k)+' / '+rr.settings.name+'.','error','roof-overlap'));rr.elements=[];rr.complete=false;}else seen.set(k,rr.settings.name);}
   return{settings:{...R.settings(model.roofDesign),enabled:active.length>0},groups,issues,elements:active.flatMap(x=>x.elements||[]),count:active.reduce((n,x)=>n+(x.count||0),0),section:active.length===1?active[0].section:null,complete:active.length>0&&active.every(x=>x.complete)&&!issues.some(i=>i.severity==='error'),geometry:active.some(x=>x.geometry)?{zones:active.flatMap(x=>x.geometry?.zones||[])}:null,validForConstruction:false,cleanEngine:'0.17.0'};
 }
 const r=R.report(model,G,S);r.cleanEngine='0.17.0';return r;
}
function quantities(model,results){
 const rows=[];
 for(const [id,r] of results||[]){
   if(id.startsWith('floor:')&&r?.complete){
     const level=r.config?.name||r.level?.name||id;
     const timber=(r.elements||[]).filter(e=>e.a&&e.b&&['joists','rimJoist','blocking','panelJointSupport'].includes(e.role));
     const byRole=new Map();
     for(const e of timber){const k=e.role,L=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),v=L*Number(e.thickness||0)*Number(e.height||0);const x=byRole.get(k)||{count:0,length:0,volume:0};x.count++;x.length+=L;x.volume+=v;byRole.set(k,x);}
     for(const [role,x] of byRole)rows.push({level,material:'bois',label:{joists:'Solives',rimJoist:'Rives',blocking:'Entretoises',panelJointSupport:'Supports panneaux'}[role]||role,count:x.count,length:x.length,volume:x.volume});
   }
 }
 return rows;
}
root.PBPCleanCalc={floor,foundations,roof,quantities,clone,version:'0.17.0'};
})(window);
