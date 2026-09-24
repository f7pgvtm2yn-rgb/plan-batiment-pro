/* v0.10.11 — dynamic wall-based seating, common and longitudinal rims.
   Geometry + existing partial C24 comparison; NOT an execution detail. */
(function(root){
'use strict';
const MIN_SEAT=.05, EDGE_CLEARANCE=.005, EPS=1e-7;
function seatForWidth(width){
 const w=Number(width);if(!Number.isFinite(w)||w<=0)return null;
 return Math.max(MIN_SEAT,w/2-EDGE_CLEARANCE);
}
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
 const walls=side.members||[],widths=walls.map(w=>value(w.thickness)).filter(w=>w>0);
 const masonry=walls.length>0&&walls.every(w=>['wallExterior','wallBearing'].includes(w.type));
 const composed=walls.some(w=>{const p=spec(model,w);return ['inside','outside','insulation'].some(k=>value(p[k])>0)|| (value(p.core)>0&&Math.abs(value(p.core)/1000-value(w.thickness))>.002);});
 const uniform=widths.length>0&&Math.max(...widths)-Math.min(...widths)<.001;
 const type=[...new Set(walls.map(w=>spec(model,w).type||'unknown'))];
 return {walls,width:widths.length?Math.min(...widths):null,maxWidth:widths.length?Math.max(...widths):null,masonry,composed,uniform,material:type.length===1?type[0]:'unknown'};
}
function sidePieces(s){
 const out=[];
 for(const w of s.walls||[]){
  const width=value(w.thickness),L=dist(w.a,w.b);if(!(width>0)||L<=EPS)continue;
  const t1=dot(sub(w.a,s.p),s.u),t2=dot(sub(w.b,s.p),s.u),low=Math.max(0,Math.min(t1,t2)),high=Math.min(s.L,Math.max(t1,t2));
  if(high-low<=.004)continue;
  const material=w.materialSpec?.type||s.material||'unknown';
  out.push({wall:w,width,low,high,a:add(s.p,mul(s.u,low)),b:add(s.p,mul(s.u,high)),material});
 }
 return out.sort((a,b)=>a.low-b.low);
}
function widthAtPoint(s,p){
 const t=dot(sub(p,s.p),s.u),hits=(s.pieces||[]).filter(x=>t>=x.low-.006&&t<=x.high+.006);
 if(!hits.length)return Number.isFinite(s.width)?s.width:null;
 return Math.min(...hits.map(x=>x.width));
}
function materialAtPoint(s,p){
 const t=dot(sub(p,s.p),s.u),x=(s.pieces||[]).find(x=>t>=x.low-.006&&t<=x.high+.006);return x?.material||s.material||'unknown';
}
function overlapSegment(a,b){
 if(dot(a.n,b.n)>-.99999||Math.abs(cross(sub(b.p,a.p),a.u))>.004)return null;
 const low=Math.max(0,Math.min(dot(sub(b.p,a.p),a.u),dot(sub(b.q,a.p),a.u)));
 const high=Math.min(a.L,Math.max(dot(sub(b.p,a.p),a.u),dot(sub(b.q,a.p),a.u)));
 if(high-low<=.004)return null;
 return {low,high,a:add(a.p,mul(a.u,low)),b:add(a.p,mul(a.u,high))};
}
function oppositeOverlap(a,b){return !!overlapSegment(a,b);}
function calculate(model,c,r,G,S){
 if(c.system!=='wood'||c.rimAuto===false)return r;
 r.rim={minSeat:MIN_SEAT,edgeClearance:EDGE_CLEARANCE,seatRule:'max(5 cm ; mur/2 − 0,5 cm)',entries:[],bays:[],commonRims:[],longitudinal:[],applied:false,validForConstruction:false};
 if(!r.section||!Number.isFinite(r.required)||!r.bays?.length)return r;
 const faces=G.faces(model,c.belowId,S).faces.filter(f=>f.rectangle);
 if(faces.length!==r.bays.length)return r;
 const issue=(code,text,error=false)=>{if(!r.issues.some(i=>i.code===code))r.issues.push({code,text,severity:error?'error':'warning'});};
 const fail=(code,text)=>{issue(code,text,true);r.complete=false;r.elements=[];r.count=0;return r;};
 const data=faces.map((face,index)=>{
  const choices=[0,1].map(i=>({i,span:dist(face.points[i],face.points[(i+3)%4])})).sort((a,b)=>a.span-b.span||a.i-b.i);
  const autoDir=Number(r.orientation?.directions?.[index]),direction=(autoDir===0||autoDir===1)?autoDir:choices[c.invert?1:0].i;
  const sides=face.sides.map((s,j)=>{const x={...line(s.a,s.b),...wallInfo(model,s),face:index,side:j,bearing:j===direction||j===(direction+2)%4,shared:false};x.pieces=sidePieces(x);return x;});
  return {face,index,direction,sides};
 });
 const all=data.flatMap(d=>d.sides);
 if(!all.some(s=>s.masonry&&(s.pieces||[]).some(p=>p.width>MIN_SEAT+EPS)))return r;
 const sharedBearing=[];
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const a=all[i],b=all[j],overlap=a.face===b.face?null:overlapSegment(a,b);if(!overlap)continue;
  a.shared=b.shared=true;
  if(a.bearing&&b.bearing&&a.masonry&&b.masonry){
   const cuts=[overlap.low,overlap.high];
   for(const p of a.pieces||[])if(p.high>overlap.low+EPS&&p.low<overlap.high-EPS){cuts.push(Math.max(overlap.low,p.low),Math.min(overlap.high,p.high));}
   for(const p of b.pieces||[]){const aa=dot(sub(p.a,a.p),a.u),bb=dot(sub(p.b,a.p),a.u);if(Math.max(aa,bb)>overlap.low+EPS&&Math.min(aa,bb)<overlap.high-EPS){cuts.push(Math.max(overlap.low,Math.min(aa,bb)),Math.min(overlap.high,Math.max(aa,bb)));}}
   const xs=[...new Set(cuts.map(x=>+x.toFixed(8)))].sort((x,y)=>x-y);
   for(let k=0;k<xs.length-1;k++){if(xs[k+1]-xs[k]<=.004)continue;const midp=add(a.p,mul(a.u,(xs[k]+xs[k+1])/2)),wa=widthAtPoint(a,midp),wb=widthAtPoint(b,midp);if(!(wa>MIN_SEAT&&wb>MIN_SEAT))continue;
    const wallWidth=Math.min(wa,wb),seatA=seatForWidth(wallWidth),seatB=seatForWidth(wallWidth),width=wallWidth-seatA-seatB;
    if(width<-EPS)return fail('rim-double-bearing','Mur trop étroit pour deux appuis opposés respectant le minimum de 5 cm.');
    sharedBearing.push({a,b,overlap:{low:xs[k],high:xs[k+1],a:add(a.p,mul(a.u,xs[k])),b:add(a.p,mul(a.u,xs[k+1]))},wallWidth,width:Math.max(0,width),seatA,seatB,material:materialAtPoint(a,midp)===materialAtPoint(b,midp)?materialAtPoint(a,midp):'unknown'});
   }
  }
  if(a.bearing!==b.bearing)issue('rim-mixed-directions','Une travée porte sur cet appui partagé tandis que la voisine lui est parallèle : le solivage est conservé et la rive longitudinale est traitée du côté parallèle.');
 }
 let eligible=0;
 for(const d of data){
  const offsets=[],outer=[];d.rims=[];
  for(const s of d.sides){
   const localEligible=s.masonry&&(s.pieces||[]).some(p=>p.width>MIN_SEAT+EPS),candidate=s.masonry&&s.uniform&&s.width>MIN_SEAT+EPS;
   if(localEligible&&s.composed)return fail('rim-core-location','Mur composé avec isolation ou parements : la position du cœur porteur n’est pas définie. L’appui est calculé sur l’épaisseur porteuse connue seulement.');
   if(s.masonry&&!s.uniform)issue('rim-variable-width','Épaisseurs différentes sur un même côté : appuis et rives calculés automatiquement par portions de murs.');
   if(s.bearing&&!localEligible)issue('rim-narrow','Portion de mur trop étroite pour assurer l’appui minimal de 5 cm sans connecteur ni sabot.');
   s.seat=candidate?seatForWidth(s.width):null;
   // A variable-width side remains on its axis for the coarse polygon; each joist end
   // is then adjusted locally to the actual wall thickness. This keeps the section check conservative.
   s.seated=candidate&&(s.bearing||!s.shared);
   s.variableBearing=s.bearing&&s.masonry&&!s.uniform&&localEligible;
   s.longitudinal=!s.bearing&&s.masonry&&(s.pieces||[]).length>0;
   offsets.push(s.seated?s.width/2-s.seat:0);
   outer.push(s.seated&&!s.shared?-s.width/2:offsets[offsets.length-1]);
   if((s.seated||s.variableBearing)&&s.bearing)eligible++;
   if((s.seated||localEligible)&&!s.shared)d.rims.push(s);
  }
  d.inner=offsetPolygon(d.face.points,offsets);d.outer=offsetPolygon(d.face.points,outer);
  if(area(d.inner)<.04)return fail('rim-no-space','Les appuis et rives ne laissent plus de place au solivage.');
  const j=d.direction;d.a=d.inner[j];d.b=d.inner[(j+1)%4];d.opposite=d.inner[(j+3)%4];d.width=dist(d.a,d.b);d.cut=dist(d.a,d.opposite);
  d.calcSpan=Math.max(r.bays[d.index].geometry.L,d.cut);
 }
 if(!eligible&&!data.some(d=>d.rims.length)&&!sharedBearing.length&&!data.some(d=>d.sides.some(s=>s.longitudinal)))return r;
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
   let a=add(d.a,mul(along,p.b/2000+k*p.spacing)),b=add(a,across);const sa=d.sides[j],sb=d.sides[(j+2)%4];
   if(sa.variableBearing){const w=widthAtPoint(sa,a),seat=seatForWidth(w);if(seat!==null&&w>seat+EPS)a=add(a,mul(sa.n,w/2-seat));}
   if(sb.variableBearing){const w=widthAtPoint(sb,b),seat=seatForWidth(w);if(seat!==null&&w>seat+EPS)b=add(b,mul(sb.n,w/2-seat));}
   if(c.enabled&&r.complete)r.elements.push({...common,id:c.id+':seated:'+d.index+':'+k,type:'beam',role:'joists',floorRole:'joist',a,b,thickness:p.b/1000,height:p.h/1000,zBase:r.sourceTop,bearingDetail:'dynamic-half-minus-5mm-min-50mm'});
   if(c.enabled&&r.complete)r.count++;
  }
  // Longitudinal rim joist: when joists run parallel to a wall, place one rim joist
  // along that wall on the inside of the bay. Shared walls get one on each relevant side.
  for(const s of d.sides.filter(s=>s.longitudinal)){
   let pi=0;for(const piece of s.pieces||[]){
    const inset=(piece.width+p.b/1000)/2,ra=add(piece.a,mul(s.n,inset)),rb=add(piece.b,mul(s.n,inset));if(dist(ra,rb)<=.05)continue;
    const entry={wallIds:[piece.wall.id],length:dist(ra,rb),thickness:p.b/1000,height:p.h/1000,wallWidth:piece.width,face:d.index,side:s.side,shared:s.shared};
    r.rim.longitudinal.push(entry);
    if(c.enabled&&r.complete)r.elements.push({...common,id:c.id+':rim-long:'+d.index+':'+s.side+':'+pi++,type:'beam',role:'rimJoist',floorRole:'rimJoist',a:ra,b:rb,thickness:p.b/1000,height:p.h/1000,zBase:r.sourceTop,sourceWallIds:entry.wallIds,nonLoadBearing:false});
   }
  }
  if(c.enabled&&r.complete)for(const l of r.layers.filter(l=>l.role!=='joists')){
   r.elements.push({...common,id:c.id+':seated:'+d.index+':'+l.role,type:'slab',role:l.role,polygon:l.z>=r.sourceTop-EPS?d.inner:d.face.points,zBase:l.z,height:l.h,void:!!l.void,hiddenLayer:c.showAllLayers===false&&!['panel','concrete'].includes(l.role)});
  }
  for(const s of d.rims){
   let pi=0;for(const piece of s.pieces||[]){const seat=seatForWidth(piece.width);if(seat===null||piece.width<seat-EPS)continue;
    const outerA=add(piece.a,mul(s.n,-piece.width/2)),outerB=add(piece.b,mul(s.n,-piece.width/2)),innerA=add(piece.a,mul(s.n,piece.width/2-seat)),innerB=add(piece.b,mul(s.n,piece.width/2-seat));
    const polygon=[outerA,outerB,innerB,innerA],width=Math.max(0,piece.width-seat),material=piece.wall.materialSpec?.type||s.material||'unknown';
    const entry={wallIds:[piece.wall.id],width,wallWidth:piece.width,seat,height:r.required,material,area:area(polygon),split:!s.uniform};r.rim.entries.push(entry);
    if(c.enabled&&r.complete&&width>EPS)r.elements.push({...common,id:c.id+':rim:'+d.index+':'+s.side+':'+pi++,type:'slab',role:'rim',polygon,zBase:r.sourceTop,height:r.required,thickness:width,sourceWallIds:entry.wallIds,rimMaterial:material,nonLoadBearing:true,materialSpec:{type:material}});
   }
  }
 }
 // One central closure for two joist fields bearing face-to-face on the same wall.
 for(let i=0;i<sharedBearing.length;i++){
  const x=sharedBearing[i],n=x.a.n,half=x.width/2;
  const polygon=x.width>EPS?[add(x.overlap.a,mul(n,-half)),add(x.overlap.b,mul(n,-half)),add(x.overlap.b,mul(n,half)),add(x.overlap.a,mul(n,half))]:[];
  const entry={wallIds:[...new Set([...x.a.walls,...x.b.walls].map(w=>w.id))],width:x.width,wallWidth:x.wallWidth,seatA:x.seatA,seatB:x.seatB,seatCount:2,height:r.required,material:x.material,area:polygon.length?area(polygon):0,shared:true};
  r.rim.entries.push(entry);r.rim.commonRims.push(entry);
  if(c.enabled&&r.complete&&x.width>EPS)r.elements.push({...common,id:c.id+':rim-common:'+i,type:'slab',role:'rim',rimKind:'shared',polygon,zBase:r.sourceTop,height:r.required,thickness:x.width,sourceWallIds:entry.wallIds,rimMaterial:x.material,nonLoadBearing:true,materialSpec:{type:x.material}});
 }
 const sizes=[...new Set(r.rim.entries.map(e=>e.seatCount===2?(e.wallWidth*100).toFixed(1)+' − '+((e.seatA||0)*100).toFixed(1)+' − '+((e.seatB||0)*100).toFixed(1)+' = '+(e.width*100).toFixed(1)+' cm':(e.wallWidth*100).toFixed(1)+' − '+((e.seat||0)*100).toFixed(1)+' = '+(e.width*100).toFixed(1)+' cm'))];
 if(sizes.length)issue('rim-result','Rives calculées automatiquement : '+sizes.join(' ; ')+'. Hauteur : '+(r.required*100).toFixed(1)+' cm, au-dessus des murs inférieurs.');
 if(r.rim.commonRims.length)issue('rim-common','Deux solivages face à face : '+r.rim.commonRims.length+' rive(s) centrale(s) recalculée(s) avec l’appui dynamique de chaque côté.');
 if(r.rim.longitudinal.length)issue('rim-longitudinal','Rives longitudinales : '+r.rim.longitudinal.length+' rive(s) bois ajoutée(s) le long des murs parallèles au solivage.');
 issue('rim-scope','Appui automatique = max(5 cm ; épaisseur du mur / 2 − 0,5 cm). Aucun connecteur ou sabot n’est pris en compte dans cette version. Appuis, écrasement, humidité et fixations restent à justifier.');
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
  q.rows.push(...grouped.values());
  const long=new Map();
  for(const r of rs)if(r.complete)for(const e of r.elements||[])if(e.role==='rimJoist'&&e.a&&e.b){
   const key=e.levelId+'|rimJoist',L=dist(e.a,e.b),V=L*value(e.thickness)*value(e.height);
   if(!long.has(key))long.set(key,{level:r.config.name||r.level?.name||e.levelId,material:'bois de rive',label:'Rives longitudinales',unit:'m',quantity:0,note:'Longueur brute ; assemblages et pertes non inclus'});
   long.get(key).quantity+=L;
   const vk=key+'|m3';if(!long.has(vk))long.set(vk,{level:r.config.name||r.level?.name||e.levelId,material:'bois de rive',label:'Rives longitudinales',unit:'m³',quantity:0,note:'Volume brut'});
   long.get(vk).quantity+=V;
  }
  q.rows.push(...long.values());return q;
 };
 B.report=(m,g=G,s=S,f=F)=>{
  const base=report(m,g,s,f);base.floors=base.floors.map(r=>calculate(m,r.config,r,g,s));
  base.elements=base.floors.flatMap(r=>r.elements);base.levels=base.floors.flatMap(r=>r.level?[r.level]:[]);base.quantities=B.quantities(m,base.floors,f);return base;
 };
}
const api={MIN_SEAT,EDGE_CLEARANCE,seatForWidth,calculate,install,offsetPolygon,area,sidePieces,widthAtPoint,getLastPreview:()=>lastPreview};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root){root.PBPRims=api;if(root.PBPBuilding&&root.PBPGeometry&&root.PBPStructure&&root.PBPFoundations)install(root.PBPBuilding,root.PBPGeometry,root.PBPStructure,root.PBPFoundations);}
})(typeof window!=='undefined'?window:globalThis);
