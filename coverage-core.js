/* v0.13.0 — Selection BEFORE calculation, plus independent roof groups.
   Geometry and inherited preliminary checks only; no invented bearing support. */
(function(root){
'use strict';
const Z=root.PBPSpaces,clone=x=>JSON.parse(JSON.stringify(x)),finite=x=>typeof x==='number'&&Number.isFinite(x);
const warn=(text,code='zones')=>({severity:'warning',text,code}),error=(text,code='zones')=>({severity:'error',text,code});
function blankFloor(m,c,text,ok=false){const below=m.levels.find(l=>l.id===c.belowId),above=m.levels.find(l=>l.id===c.aboveId),z=Number(below?.elevation)+Number(below?.height);return{config:c,issues:[ok?warn(text):error(text)],elements:[],layers:[],bays:[],count:0,area:0,complete:ok,validForConstruction:false,empty:ok,sourceTop:z,top:Number(above?.elevation),bottom:z,required:0,requiredTop:z,totalThickness:0,available:Number(above?.elevation)-z,gap:Number(above?.elevation)-z,level:below&&above?{id:c.id,name:c.name||'Zone sans plancher',kind:'floor',autoFloor:true,belowId:c.belowId,aboveId:c.aboveId,elevation:z,height:0}:null};}
function strictInside(p,ps){if(!Z.inside(p,ps))return false;return ps.every((a,i)=>{const v=Z.sub(ps[(i+1)%ps.length],a),t=Math.max(0,Math.min(1,Z.dot(Z.sub(p,a),v)/(Z.dot(v,v)||1)));return Z.dist(p,Z.add(a,Z.mul(v,t)))>.004;});}
function segmentInside(a,b,ps){const v=Z.sub(b,a),cuts=[0,1];for(let i=0;i<ps.length;i++){const p=ps[i],w=Z.sub(ps[(i+1)%ps.length],p),den=Z.cross(v,w);if(Math.abs(den)<1e-10)continue;const t=Z.cross(Z.sub(p,a),w)/den,u=Z.cross(Z.sub(p,a),v)/den;if(t>=0&&t<=1&&u>=0&&u<=1)cuts.push(t);}cuts.sort((a,b)=>a-b);for(let i=0;i<cuts.length-1;i++)if(strictInside(Z.add(a,Z.mul(v,(cuts[i]+cuts[i+1])/2)),ps))return true;return false;}
function aboveVoid(m,c,omitted,S){return (m.elements||[]).filter(e=>e.mode==='construction'&&!e.generator&&e.levelId===c.aboveId&&(S.isSupport(e)||e.type==='column')).some(e=>omitted.some(row=>{const ps=row.face.points;if(e.a&&e.b)return segmentInside(e.a,e.b,ps);if(!Z.point({x:e.x,y:e.y}))return false;const w=Number(e.width)||0,d=Number(e.depth)||0,box=[{x:e.x-w/2,y:e.y-d/2},{x:e.x+w/2,y:e.y-d/2},{x:e.x+w/2,y:e.y+d/2},{x:e.x-w/2,y:e.y+d/2}];return strictInside({x:e.x,y:e.y},ps)||box.some((p,i)=>strictInside(p,ps)||segmentInside(p,box[(i+1)%4],ps))||ps.some(p=>strictInside(p,box));}));}
function installFloor(B,G,S,F){
 if(B.zoneSelectionInstalled)return;B.zoneSelectionInstalled=true;const original=B.floorReport;
 B.floorReport=function(m,c,g=G,s=S){
  const d=Z.zones(m,c.belowId,'structure',g,s),pick=Z.resolve(d.rows,c.coverageZones);
  let r;
  if(pick.missing.length)r=blankFloor(m,c,'Le contour de '+pick.missing.length+' zone(s) choisie(s) a changé. Resélectionnez les zones : aucun remplacement automatique.');
  else if(pick.selection.mode==='selected'&&!pick.chosen.length)r=blankFloor(m,c,'Toutes les zones sont volontairement laissées sans plancher. Aucun plafond horizontal ni solive de plancher n’est généré.',true);
  else{
   // The same scoped geometry object goes through Building, Rims AND Coverage.
   // Filtering only the final drawing would leave wrong sections, quantities and slabs.
   const scoped=pick.selection.mode==='all'?g:{...g,faces:(mm,id,ss)=>id===c.belowId?{faces:pick.chosen.map(x=>x.face),issues:d.issues}:g.faces(mm,id,ss)};
   r=original(m,c,scoped,s);
  }
  const chosenIds=new Set(pick.chosen.map(x=>x.id)),omitted=d.rows.filter(x=>!chosenIds.has(x.id));
  if(pick.selection.mode==='selected'&&aboveVoid(m,c,omitted,s)){r.complete=false;r.elements=[];r.count=0;r.issues.push(error('Mur porteur, poutre ou poteau au-dessus d’une zone laissée vide : justifier sa reprise avant de retirer le plancher.','load-above-void'));}
  r.zoneCoverage={totalArea:pick.totalArea,selectedArea:pick.selectedArea,excludedArea:Math.max(0,pick.totalArea-pick.selectedArea),ids:pick.chosen.map(x=>x.id),names:pick.chosen.map(x=>x.name),missing:pick.missing};
  if(pick.selection.mode==='selected'){
   r.coverage={...(r.coverage||{}),totalArea:pick.selectedArea,coveredArea:r.complete?pick.selectedArea:0,missingArea:r.complete?0:pick.selectedArea};
   if(r.zoneCoverage.excludedArea>1e-6)r.issues.push(warn(r.zoneCoverage.excludedArea.toFixed(2)+' m² sur axes laissés volontairement sans plancher. Appuis de bord, garde-corps et stabilité restent à vérifier.','intentional-void'));
  }
  return r;
 };
 // Existing report implementations close over their old floorReport. Use the public,
 // now-scoped calculation so preview, saved plan, 3D and quantities remain identical.
 B.report=function(m,g=G,s=S,f=F){const seen=new Set(),floors=B.settings(m.buildingDesign).floors.filter(c=>c.enabled).map(c=>{if(seen.has(c.aboveId))return blankFloor(m,c,'Deux planchers automatiques visent le même niveau supérieur.');seen.add(c.aboveId);return B.floorReport(m,c,g,s);});return{floors,elements:floors.flatMap(r=>r.elements||[]),levels:floors.flatMap(r=>r.level?[r.level]:[]),quantities:B.quantities(m,floors,f)};};
}
function roofGroups(input,R=root.PBPRoof){
 const base=R.settings(input),rows=Array.isArray(input?.groups)?input.groups:[{...base,id:'roof-existing',name:'Toiture 1',basis:'exterior',coverageZones:{mode:'all',ids:[]}}];
 return rows.slice(0,40).map((x,i)=>({...R.settings({...base,...x}),groups:undefined,id:String(x.id||'roof-'+i).slice(0,80),name:String(x.name||'Toiture '+(i+1)).trim().slice(0,80),basis:x.basis==='exterior'?'exterior':'structure',supportLevelId:String(x.supportLevelId||base.supportLevelId),coverageZones:Z.selection(x.coverageZones)}));
}
function roofSettings(input,R=root.PBPRoof){return{...R.settings(input),schema:2,groups:roofGroups(input,R)};}
function rectangleUnion(rows){
 if(rows.length<2||rows.some(r=>!r.face.rectangle))return rows.map(r=>r.face);
 const f=rows[0].face,p0=f.points[0],u0=Z.sub(f.points[1],p0),len=Math.hypot(u0.x,u0.y),u=Z.mul(u0,1/len),v={x:-u.y,y:u.x};
 const local=p=>({x:Z.dot(Z.sub(p,p0),u),y:Z.dot(Z.sub(p,p0),v)}),pts=rows.flatMap(r=>r.face.points.map(local));
 const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y)),a=(maxX-minX)*(maxY-minY),total=rows.reduce((n,r)=>n+r.area,0);
 if(Math.abs(a-total)>1e-5*Math.max(1,a))return rows.map(r=>r.face);
 const wp=(x,y)=>Z.add(p0,Z.add(Z.mul(u,x),Z.mul(v,y))),points=[wp(minX,minY),wp(maxX,minY),wp(maxX,maxY),wp(minX,maxY)];
 const sides=points.map((a,i)=>{const b=points[(i+1)%4],ab=Z.sub(b,a),L=Math.hypot(ab.x,ab.y),members=new Map();for(const row of rows)for(const s of row.face.sides){if(Math.abs(Z.cross(Z.sub(s.a,a),ab))/L>.004||Math.abs(Z.cross(Z.sub(s.b,a),ab))/L>.004)continue;for(const w of s.members)members.set(w.id,w);}return{a,b,members:[...members.values()]};});
 if(sides.some(s=>!s.members.length))return rows.map(r=>r.face);
 return[{points,sides,rectangle:true,area:a}];
}
function roofGroupReport(m,s,G,S,R){
 const out={settings:s,issues:[],elements:[],section:null,count:0,geometry:null,complete:false,validForConstruction:false,geometryComplete:false};
 if(!s.enabled)return out;
 const level=m.levels.find(l=>l.id===s.supportLevelId);if(!level){out.issues.push(error('Niveau d’appui absent. Aucun autre niveau n’est choisi à sa place.'));return out;}
 const d=Z.zones(m,s.supportLevelId,s.basis,G,S),pick=Z.resolve(d.rows,s.coverageZones);out.zoneCoverage={selectedArea:pick.selectedArea,excludedArea:pick.totalArea-pick.selectedArea,totalArea:pick.totalArea,ids:pick.chosen.map(r=>r.id)};
 if(pick.missing.length){out.issues.push(error('Contour modifié : resélectionnez les zones de '+s.name+'.'));return out;}
 if(!pick.chosen.length){out.issues.push(warn('Aucune zone sélectionnée pour '+s.name+'.'));return out;}
 if(!finite(s.slopeDeg)||s.slopeDeg<5||s.slopeDeg>70||!finite(s.overhang)||s.overhang<0||s.overhang>2||!finite(s.rafterSpacing)||s.rafterSpacing<.2||s.rafterSpacing>1.2||!finite(s.deadLoad)||s.deadLoad<0||!finite(s.b)||!finite(s.h)||s.b<=0||s.h<=0){out.issues.push(error('Pente, débord, entraxe, charges ou section hors du domaine de cet aperçu.'));return out;}
 const faces=rectangleUnion(pick.chosen);if(faces.some(f=>!f.rectangle)){out.issues.push(error('Zone non rectangulaire : choisissez des travées porteuses rectangulaires ou créez plusieurs toitures. Aucun appui artificiel n’est créé.'));return out;}
 const pitch=s.slopeDeg*Math.PI/180,zones=[];
 for(const face of faces){
  const a=Z.dist(face.points[0],face.points[1]),b=Z.dist(face.points[1],face.points[2]),i=(a>=b?0:1)^(s.invert?1:0),p=face.points[i],q=face.points[(i+1)%4],o=face.points[(i+3)%4],ridgeLength=Z.dist(p,q),cross=Z.dist(p,o),u=Z.mul(Z.sub(q,p),1/ridgeLength),v=Z.mul(Z.sub(o,p),1/cross);
  const walls=[...face.sides[i].members,...face.sides[(i+2)%4].members],tops=walls.map(w=>(finite(w.zBase)?w.zBase:Number(level.elevation))+Number(w.height));
  if(!walls.length||walls.some(w=>!S.isSupport(w))||tops.some(t=>!finite(t))||Math.max(...tops)-Math.min(...tops)>.01){out.issues.push(error('Appuis opposés absents ou arases différentes dans '+s.name+'. Coordonnez les vrais murs ; aucune surélévation de support n’est inventée.'));return out;}
  const n=Math.max(1,Math.ceil(ridgeLength/s.rafterSpacing));zones.push({face,p,u,v,ridgeLength,cross,span:cross/2/Math.cos(pitch),rise:cross/2*Math.tan(pitch),eaveZ:tops[0],spacing:ridgeLength/n,n});
 }
 out.geometry={zones,maxSpan:Math.max(...zones.map(z=>z.span)),totalRidge:zones.reduce((n,z)=>n+z.ridgeLength,0),supportLevelId:s.supportLevelId};
 const snow=finite(s.snowLoad)&&s.snowLoad>=0,wind=finite(s.windPressure)&&s.windPressure>=0;
 if(!snow)out.issues.push(warn('Neige non renseignée : tracé de principe seulement, aucune section automatique validée.'));
 if(!wind)out.issues.push(warn('Vent non renseigné : soulèvement et assemblages non vérifiés.'));
 let section={b:s.b,h:s.h},checks=[];
 if(snow){
  const candidates=s.autoSection?[45,63,75,100,120].flatMap(b=>[120,145,170,195,220,245,270,300,340].filter(h=>h>=b&&h/b<=7).map(h=>({b,h}))):[section];candidates.sort((a,b)=>a.b*a.h-b.b*b.h||a.h-b.h);
  let found=null;for(const c of candidates){const cs=zones.map(z=>R.beamCheck(z.span,z.spacing,c.b,c.h,s.deadLoad,s.snowLoad));if(cs.every(c=>c.screened)){found=c;checks=cs;break;}}
  if(found){section=found;out.section=section;}else out.issues.push(error('Aucune section d’essai disponible ne satisfait le comparateur hérité pour les zones retenues.'));
 }
 const target=m.levels.find(l=>l.id==='roof')||m.levels.find(l=>/^toiture$/i.test(l.name||'')),levelId=target?.id||s.supportLevelId;
 const common={generator:R.TAG,mode:'construction',levelId,type:'slopedBeam',role:'rafters',width:section.b/1000,height:section.h/1000,locked:true,designStatus:out.section?'prestudy':'geometry-only',roofGroupId:s.id,sourceLevelId:s.supportLevelId};
 zones.forEach((z,zi)=>{
  const wp=(x,y,alt)=>({...Z.add(z.p,Z.add(Z.mul(z.u,x),Z.mul(z.v,y))),z:alt});
  for(let k=0;k<=z.n;k++){const x=k*z.spacing,mid=wp(x,z.cross/2,z.eaveZ+z.rise),tailZ=z.eaveZ-s.overhang*Math.tan(pitch);out.elements.push({...common,id:R.TAG+':'+s.id+':'+zi+':a:'+k,a:wp(x,-s.overhang,tailZ),b:mid},{...common,id:R.TAG+':'+s.id+':'+zi+':b:'+k,a:wp(x,z.cross+s.overhang,tailZ),b:mid});out.count+=2;}
  // This is a ridge POSITION guide, not a made-up load-bearing ridge beam.
  out.elements.push({...common,id:R.TAG+':'+s.id+':ridge:'+zi,role:'ridge',width:.025,height:.025,visualGuide:true,designStatus:'guide-non-porteur',a:wp(-s.overhang,z.cross/2,z.eaveZ+z.rise),b:wp(z.ridgeLength+s.overhang,z.cross/2,z.eaveZ+z.rise)});
 });
 out.geometryComplete=true;out.complete=!!out.section&&!out.issues.some(i=>i.severity==='error');out.checks=checks;
 out.issues.push(warn('Faîtage représenté comme repère : sa poutre et ses appuis ne sont pas dimensionnés. En plafond cathédrale, aucun entrait ni contreventement n’est supprimé automatiquement. Poussées, stabilité, assemblages et raccords restent à étudier.'));
 if(zones.length>1)out.issues.push(warn('Plusieurs volumes dans cette toiture : noues, arêtiers, raccords et collisions restent à traiter.'));
 return out;
}
function installRoof(R,G,S){if(R.zoneGroupsInstalled)return;R.zoneGroupsInstalled=true;const legacy=R.report;
 R.report=function(m,g=G,s=S){if(!Array.isArray(m.roofDesign?.groups))return legacy(m,g,s);const groups=roofGroups(m.roofDesign,R).map(c=>roofGroupReport(m,c,g,s,R)),active=groups.filter(r=>r.settings.enabled),issues=active.flatMap(r=>r.issues.map(i=>({...i,text:r.settings.name+' : '+i.text}))),seen=new Map();
  for(const r of active)for(const id of r.zoneCoverage?.ids||[]){const k=r.settings.supportLevelId+'|'+id;if(seen.has(k)){issues.push(error('Deux toitures couvrent la même zone au même niveau : '+seen.get(k)+' / '+r.settings.name+'.'));r.elements=[];r.complete=false;}else seen.set(k,r.settings.name);}
  return{settings:{...R.settings(m.roofDesign),enabled:active.length>0},groups,issues,elements:active.flatMap(r=>r.elements),count:active.reduce((n,r)=>n+r.count,0),section:active.length===1?active[0].section:null,complete:active.length>0&&active.every(r=>r.complete)&&!issues.some(i=>i.severity==='error'),geometry:active.some(r=>r.geometry)?{zones:active.flatMap(r=>r.geometry?.zones||[])}:null,validForConstruction:false};
 };
}
const api={blankFloor,aboveVoid,installFloor,roofGroups,roofSettings,rectangleUnion,roofGroupReport,installRoof};
if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root){root.PBPCoverage=api;if(root.PBPBuilding&&root.PBPGeometry&&root.PBPStructure&&root.PBPFoundations)installFloor(root.PBPBuilding,root.PBPGeometry,root.PBPStructure,root.PBPFoundations);if(root.PBPRoof&&root.PBPGeometry&&root.PBPStructure)installRoof(root.PBPRoof,root.PBPGeometry,root.PBPStructure);}
})(typeof window!=='undefined'?window:globalThis);
