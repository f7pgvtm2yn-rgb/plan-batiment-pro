/* v0.10.2 — project-specific 200 mm seating and automatic closure.
   Geometry + existing partial C24 comparison; NOT an execution detail. */
(function(root){
'use strict';
const SEAT=.20, MIN_WALL=.30, EPS=1e-7;
let lastPreview=null;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),mul=(a,t)=>({x:a.x*t,y:a.y*t});
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const area=p=>Math.abs(p.reduce((s,a,i)=>s+cross(a,p[(i+1)%p.length]),0)/2);
const value=(v,f=0)=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):f;
const materialName=t=>({concrete:'béton',brick:'maçonnerie brique',block:'maçonnerie parpaing',timber:'bois de fermeture'})[t]||'matériau à préciser';
function line(p,q){const L=dist(p,q),u=mul(sub(q,p),1/L);return {p,q,u,n:{x:-u.y,y:u.x},L};}
function intersect(a,b){const den=cross(a.u,b.u);if(Math.abs(den)<1e-9)throw Error('Raccord de rive indéterminé.');return add(a.p,mul(a.u,cross(sub(b.p,a.p),b.u)/den));}
function offsetPolygon(points,offsets){const ls=points.map((p,i)=>{const l=line(p,points[(i+1)%points.length]);return {...l,p:add(p,mul(l.n,offsets[i]))};});return ls.map((l,i)=>intersect(ls[(i+ls.length-1)%ls.length],l));}
function spec(model,w){return w.materialSpec||model.buildingDesign?.materials?.[w.levelId]||{};}
function wallInfo(model,side){
 const walls=side.members||[],widths=walls.map(w=>value(w.thickness));
 const masonry=walls.length>0&&walls.every(w=>['wallExterior','wallBearing'].includes(w.type));
 const composed=walls.some(w=>{const p=spec(model,w);return ['inside','outside','insulation'].some(k=>value(p[k])>0)|| (value(p.core)>0&&Math.abs(value(p.core)/1000-value(w.thickness))>.002);});
 const uniform=widths.length>0&&Math.max(...widths)-Math.min(...widths)<.001;
 const type=[...new Set(walls.map(w=>spec(model,w).type||'unknown'))];
 return {walls,width:uniform?widths[0]:null,masonry,composed,uniform,material:type.length===1?type[0]:'unknown'};
}
function oppositeOverlap(a,b){
 if(dot(a.n,b.n)>-.99999||Math.abs(cross(sub(b.p,a.p),a.u))>.004)return false;
 const low=Math.max(0,Math.min(dot(sub(b.p,a.p),a.u),dot(sub(b.q,a.p),a.u)));
 const high=Math.min(a.L,Math.max(dot(sub(b.p,a.p),a.u),dot(sub(b.q,a.p),a.u)));
 return high-low>.004;
}
function calculate(model,c,r,G,S){
 if(c.system!=='wood'||c.rimAuto===false)return r;
 r.rim={seat:SEAT,minWall:MIN_WALL,entries:[],bays:[],applied:false,validForConstruction:false};
 if(!r.section||!Number.isFinite(r.required)||!r.bays?.length)return r;
 const faces=G.faces(model,c.belowId,S).faces.filter(f=>f.rectangle);
 if(faces.length!==r.bays.length)return r;
 const issue=(code,text,error=false)=>{if(!r.issues.some(i=>i.code===code))r.issues.push({code,text,severity:error?'error':'warning'});};
 const fail=(code,text)=>{issue(code,text,true);r.complete=false;r.elements=[];r.count=0;return r;};
 const data=faces.map((face,index)=>{
  const choices=[0,1].map(i=>({i,span:dist(face.points[i],face.points[(i+3)%4])})).sort((a,b)=>a.span-b.span||a.i-b.i);
  const direction=choices[c.invert?1:0].i;
  const sides=face.sides.map((s,j)=>({...line(s.a,s.b),...wallInfo(model,s),face:index,side:j,bearing:j===direction||j===(direction+2)%4,shared:false}));
  return {face,index,direction,sides};
 });
 const all=data.flatMap(d=>d.sides);
 if(!all.some(s=>s.masonry&&s.uniform&&s.width>MIN_WALL+EPS))return r;
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const a=all[i],b=all[j];if(a.face===b.face||!oppositeOverlap(a,b))continue;
  a.shared=b.shared=true;
  if(a.bearing&&b.bearing&&a.masonry&&b.masonry&&a.width>MIN_WALL&&b.width>MIN_WALL&&Math.min(a.width,b.width)<2*SEAT-EPS)
   return fail('rim-double-bearing','Deux travées prennent appui de part et d’autre du même mur : 2 × 20 cm dépassent sa largeur. Liaison, décalage des solives ou continuité à étudier ; aucune superposition forcée.');
  if(a.bearing!==b.bearing)return fail('rim-mixed-directions','Deux travées voisines abordent le même appui dans des sens différents : raccord particulier à étudier avant de générer les rives.');
 }
 let eligible=0;
 for(const d of data){
  const offsets=[],outer=[];d.rims=[];
  for(const s of d.sides){
   const candidate=s.masonry&&s.uniform&&s.width>MIN_WALL+EPS;
   if(candidate&&s.composed)return fail('rim-core-location','Mur composé avec isolation ou parements : la position du cœur porteur n’est pas définie. Les 20 cm d’appui ne sont pas pris dans l’isolation ; rive suspendue sur ce plancher.');
   if(s.masonry&&!s.uniform)return fail('rim-variable-width','Épaisseurs différentes sur un même côté de travée : scinder le côté en appuis distincts avant le calcul des rives.');
   if(s.bearing&&!candidate){
    issue('rim-narrow','Appui de 20 cm et rive automatique non appliqués aux murs de 30 cm ou moins ni aux poutres. Le détail d’appui de ces éléments reste à définir.');
   }
   s.seated=candidate&&(s.bearing||!s.shared);
   offsets.push(s.seated?s.width/2-SEAT:0);
   outer.push(s.seated&&!s.shared?-s.width/2:offsets[offsets.length-1]);
   if(s.seated&&s.bearing)eligible++;
   if(s.seated&&!s.shared)d.rims.push(s);
  }
  d.inner=offsetPolygon(d.face.points,offsets);d.outer=offsetPolygon(d.face.points,outer);
  if(area(d.inner)<.04)return fail('rim-no-space','Les appuis et rives ne laissent plus de place au solivage.');
  const j=d.direction;d.a=d.inner[j];d.b=d.inner[(j+1)%4];d.opposite=d.inner[(j+3)%4];d.width=dist(d.a,d.b);d.cut=dist(d.a,d.opposite);
  d.calcSpan=Math.max(r.bays[d.index].geometry.L,d.cut);
 }
 if(!eligible&&!data.some(d=>d.rims.length))return r;
 // Never remove an existing structural guard. Only the height shortage can
 // be addressed by the wizard's explicit altitude-coordination option.
 const heightIssue=i=>/^Épaisseur disponible insuffisante/.test(i.text||'');
 const baseErrors=r.issues.filter(i=>i.severity==='error'&&!heightIssue(i));
 if(baseErrors.length||r.bays.some(b=>b.blocked||!b.check?.screened))return r;
 function trial(b,h){
  const plans=[];
  for(const d of data){
   const remaining=d.width-b/1000;if(remaining<=.01||d.calcSpan>8)return null;
   const f=r.bays[d.index].floor,target=value(f.spacing,.4),n=Math.max(1,Math.ceil(remaining/target));if(n>250)return null;
   const spacing=remaining/n,loadSpacing=Math.max(spacing,r.bays[d.index].spacing);
   const check=S.beamCheck(f,d.calcSpan,loadSpacing,b,h);if(!check.screened)return null;
   plans.push({d,b,h,n,spacing,check});
  }return plans;
 }
 const original={...r.section},candidates=[];
 for(const b of [...new Set([original.b,45,63,75,100,120])])for(const h of [...new Set([original.h,145,170,195,220,245,270,300,340,400])])
  if(b>=original.b&&h>=original.h&&h>=b&&h/b<=6)candidates.push({b,h});
 candidates.sort((a,b)=>a.b*a.h-b.b*b.h||a.h-b.h);
 let selected=null,plans=null;for(const s of candidates){const p=trial(s.b,s.h);if(p){selected=s;plans=p;break;}}
 if(!selected)return fail('rim-section','Aucune section d’essai ne satisfait le comparateur avec la longueur totale et les appuis représentés. Faire étudier une autre section ou un appui supplémentaire.');
 const delta=(selected.h-original.h)/1000;
 r.section=selected;r.required+=delta;r.requiredTop+=delta;r.totalThickness+=delta;r.gap=r.top-r.requiredTop;
 r.layers=r.layers.filter(l=>l.role!=='reserve').map(l=>l.role==='joists'?{...l,h:selected.h/1000}:l.z>=r.sourceTop+original.h/1000-EPS?{...l,z:l.z+delta}:l);
 if(r.gap>EPS)r.layers.push({role:'reserve',name:'Réserve non affectée',z:r.requiredTop,h:r.gap,void:true});
 r.issues=r.issues.filter(i=>!heightIssue(i)&&!/^Réserve non affectée/.test(i.text||''));
 if(r.gap< -EPS)issue('rim-height','Épaisseur disponible insuffisante de '+(-r.gap*100).toFixed(1)+' cm : coordonner le niveau supérieur. Aucun matériau n’est comprimé pour rentrer.',true);
 if(r.gap>.001)issue('rim-reserve','Réserve non affectée de '+(r.gap*100).toFixed(1)+' cm : la rive s’arrête au haut de la composition, sans combler ce vide arbitrairement.');
 r.complete=r.gap>=-EPS;r.rim.applied=true;r.rim.height=r.required;r.rim.originalSection=original;
 r.axisArea=r.area;r.area=data.reduce((n,d)=>n+area(d.inner),0);r.elements=[];r.count=0;
 const common={generator:'pbp-building-v09',assemblyId:c.id,levelId:c.id,mode:'construction',locked:true,designStatus:'prestudy'};
 for(const p of plans){
  const d=p.d,j=d.direction,along=mul(sub(d.b,d.a),1/d.width),across=sub(d.opposite,d.a),old=r.bays[d.index];
  old.cutLength=d.cut;old.calculationSpan=d.calcSpan;old.spacing=p.spacing;old.count=p.n+1;old.check=p.check;old.suggestion=p.check;
  old.area=area(d.inner);old.G=S.mass(old.floor)+(p.n+1)*d.cut/old.area*420*9.80665/1000*(p.b/1000)*(p.h/1000);
  old.massKg=old.G*1000/9.80665;old.permanentTotal=old.area*old.G;old.variableTotal=old.area*Number(old.floor.q);
  old.lineG=old.G*d.calcSpan/2;old.lineQ=Number(old.floor.q)*d.calcSpan/2;
  old.totalThickness=r.totalThickness;old.baseZ=r.sourceTop;old.clearHeight=r.clearHeight;old.elements=[];
  r.rim.bays.push({cutLength:d.cut,axisSpan:old.geometry.L,comparisonSpan:d.calcSpan,spacing:p.spacing,count:p.n+1});
  for(let k=0;k<=p.n;k++){
   const a=add(d.a,mul(along,p.b/2000+k*p.spacing)),b=add(a,across);
   if(c.enabled&&r.complete)r.elements.push({...common,id:c.id+':seated:'+d.index+':'+k,type:'beam',role:'joists',floorRole:'joist',a,b,thickness:p.b/1000,height:p.h/1000,zBase:r.sourceTop,bearingDetail:'project-200mm'});
   if(c.enabled&&r.complete)r.count++;
  }
  if(c.enabled&&r.complete)for(const l of r.layers.filter(l=>l.role!=='joists')){
   r.elements.push({...common,id:c.id+':seated:'+d.index+':'+l.role,type:'slab',role:l.role,polygon:l.z>=r.sourceTop-EPS?d.inner:d.face.points,zBase:l.z,height:l.h,void:!!l.void,hiddenLayer:c.showAllLayers===false&&!['panel','concrete'].includes(l.role)});
  }
  for(const s of d.rims){
   const i=s.side,k=(i+1)%4,polygon=[d.outer[i],d.outer[k],d.inner[k],d.inner[i]],width=s.width-SEAT;
   const entry={wallIds:s.walls.map(w=>w.id),width,wallWidth:s.width,seat:SEAT,height:r.required,material:s.material,area:area(polygon)};r.rim.entries.push(entry);
   if(c.enabled&&r.complete)r.elements.push({...common,id:c.id+':rim:'+d.index+':'+i,type:'slab',role:'rim',polygon,zBase:r.sourceTop,height:r.required,thickness:width,sourceWallIds:entry.wallIds,rimMaterial:s.material,nonLoadBearing:true,materialSpec:{type:s.material}});
  }
 }
 const sizes=[...new Set(r.rim.entries.map(e=>(e.wallWidth*100).toFixed(1)+' − 20 = '+(e.width*100).toFixed(1)+' cm'))];
 if(sizes.length)issue('rim-result','Rives calculées automatiquement : '+sizes.join(' ; ')+'. Hauteur : '+(r.required*100).toFixed(1)+' cm, au-dessus des murs inférieurs.');
 issue('rim-scope','Appui de 20 cm et seuil de mur > 30 cm : paramètres de ce projet, pas règle normative universelle. Appuis, écrasement, humidité et fixations restent à justifier.');
 issue('rim-loads','Rive de fermeture portée par le mur inférieur, non déclarée porteuse. Son poids et ses liaisons doivent être repris dans l’étude des murs et fondations ; aucune descente de charges automatique.');
 if(r.rim.entries.some(e=>e.material==='unknown'))issue('rim-material','Matériau de rive non renseigné : seul son volume géométrique est quantifié.');
 return r;
}
function install(B,G,S,F){
 if(B.rimExtensionInstalled)return;B.rimExtensionInstalled=true;
 const floor=B.floorReport,report=B.report,quantities=B.quantities;
 B.floorReport=(m,c,g=G,s=S)=>{const r=calculate(m,c,floor(m,c,g,s),g,s);lastPreview=r;return r;};
 B.quantities=(m,rs,f=F)=>{
  const q=quantities(m,rs,f);q.rows=q.rows.filter(x=>x.material!=='rim');
  const grouped=new Map();
  for(const r of rs)if(r.complete)for(const e of r.elements||[])if(e.role==='rim'){
   const material=materialName(e.rimMaterial),key=[e.levelId,material].join('|');
   if(!grouped.has(key))grouped.set(key,{level:r.config.name||r.level?.name||e.levelId,material,label:'Rives de fermeture automatiques',unit:'m³',quantity:0,note:'Volume de fermeture ; poids, produit, joints et résistance non calculés'});
   grouped.get(key).quantity+=area(e.polygon)*e.height;
  }
  q.rows.push(...grouped.values());return q;
 };
 B.report=(m,g=G,s=S,f=F)=>{
  const base=report(m,g,s,f);base.floors=base.floors.map(r=>calculate(m,r.config,r,g,s));
  base.elements=base.floors.flatMap(r=>r.elements);base.levels=base.floors.flatMap(r=>r.level?[r.level]:[]);base.quantities=B.quantities(m,base.floors,f);return base;
 };
}
const api={SEAT,MIN_WALL,calculate,install,offsetPolygon,area,getLastPreview:()=>lastPreview};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root){root.PBPRims=api;if(root.PBPBuilding&&root.PBPGeometry&&root.PBPStructure&&root.PBPFoundations)install(root.PBPBuilding,root.PBPGeometry,root.PBPStructure,root.PBPFoundations);}
})(typeof window!=='undefined'?window:globalThis);

