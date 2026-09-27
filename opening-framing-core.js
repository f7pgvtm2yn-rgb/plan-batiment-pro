/* Plan Bâtiment Pro v0.16.7 — automatic framing around floor openings.
   Generates geometry and quantity impacts. Header/trimmer sizing, doubling and connections remain to be structurally justified. */
(function(root){
'use strict';
const EPS=1e-7,MIN_SEG=.03;
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),mul=(a,t)=>({x:a.x*t,y:a.y*t});
const dot=(a,b)=>a.x*b.x+a.y*b.y,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),unit=v=>{const L=Math.hypot(v.x,v.y);return L>EPS?mul(v,1/L):null;};
const area=p=>Math.abs((p||[]).reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-b.x*a.y;},0)/2);
const point=(x,y)=>({x,y});
function openingRect(o){
 const w=Number(o?.width),d=Number(o?.depth),x=Number(o?.x),y=Number(o?.y),a=Number(o?.rotation||0)*Math.PI/180;
 if(!(w>.03&&d>.03)||![x,y,a].every(Number.isFinite))return null;
 const u={x:Math.cos(a),y:Math.sin(a)},v={x:-u.y,y:u.x},c={x,y},hx=w/2,hy=d/2;
 const corners=[add(c,add(mul(u,-hx),mul(v,-hy))),add(c,add(mul(u,hx),mul(v,-hy))),add(c,add(mul(u,hx),mul(v,hy))),add(c,add(mul(u,-hx),mul(v,hy)))];
 return{c,u,v,hx,hy,corners};
}
function local(rect,p){const q=sub(p,rect.c);return{x:dot(q,rect.u),y:dot(q,rect.v)};}
function world(rect,p){return add(rect.c,add(mul(rect.u,p.x),mul(rect.v,p.y)));}
function segmentInsideInterval(a,b,rect,clearance=0){
 const A=local(rect,a),B=local(rect,b),dx=B.x-A.x,dy=B.y-A.y,x0=-rect.hx-clearance,x1=rect.hx+clearance,y0=-rect.hy-clearance,y1=rect.hy+clearance;
 let lo=0,hi=1;
 const bounds=[[-dx,A.x-x0],[dx,x1-A.x],[-dy,A.y-y0],[dy,y1-A.y]];
 for(const [p,q] of bounds){
  if(Math.abs(p)<1e-12){if(q<0)return null;continue;}
  const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
 }
 return{lo:Math.max(0,lo),hi:Math.min(1,hi)};
}
function cutSegment(e,rect,clearance=0){
 const hit=segmentInsideInterval(e.a,e.b,rect,clearance);if(!hit)return[{a:{...e.a},b:{...e.b}}];
 const d=sub(e.b,e.a),rows=[];
 if(hit.lo>EPS){const b=add(e.a,mul(d,hit.lo));if(dist(e.a,b)>=MIN_SEG)rows.push({a:{...e.a},b});}
 if(hit.hi<1-EPS){const a=add(e.a,mul(d,hit.hi));if(dist(a,e.b)>=MIN_SEG)rows.push({a,b:{...e.b}});}
 return rows;
}
function clipHalf(poly,rect,axis,limit,less){
 if(!Array.isArray(poly)||poly.length<3)return[];
 const coord=p=>{const q=sub(p,rect.c);return dot(q,axis);},inside=p=>less?coord(p)<=limit+EPS:coord(p)>=limit-EPS,out=[];
 for(let i=0;i<poly.length;i++){
  const A=poly[i],B=poly[(i+1)%poly.length],ia=inside(A),ib=inside(B),va=coord(A),vb=coord(B);
  if(ia)out.push({...A});
  if(ia!==ib&&Math.abs(vb-va)>EPS){const t=(limit-va)/(vb-va);out.push({x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t});}
 }
 return out;
}
function clipRect(poly,r){
 let p=clipHalf(poly,r,r.u,-r.hx,false);p=clipHalf(p,r,r.u,r.hx,true);p=clipHalf(p,r,r.v,-r.hy,false);p=clipHalf(p,r,r.v,r.hy,true);return p;
}
function subtractRect(poly,r){
 if(!Array.isArray(poly)||poly.length<3)return[];
 const overlap=clipRect(poly,r);if(area(overlap)<1e-7)return[poly.map(p=>({...p}))];
 const left=clipHalf(poly,r,r.u,-r.hx,true),right=clipHalf(poly,r,r.u,r.hx,false);
 let middle=clipHalf(poly,r,r.u,-r.hx,false);middle=clipHalf(middle,r,r.u,r.hx,true);
 const bottom=clipHalf(middle,r,r.v,-r.hy,true),top=clipHalf(middle,r,r.v,r.hy,false);
 return[left,right,bottom,top].filter(p=>p.length>=3&&area(p)>1e-6);
}
function applies(o,c){
 return o?.mode==='construction'&&o.type==='opening'&&o.openingFraming==='auto'&&(
  o.linkedFloorId===c.id||o.levelId===c.id||o.targetLevelId===c.aboveId||(o.levelId===c.aboveId&&!o.linkedFloorId)
 );
}
function beamBasis(elements){
 const rows=elements.filter(e=>e.role==='joists'&&e.a&&e.b&&!e.openingFraming);
 for(const e of rows){const u=unit(sub(e.b,e.a));if(u)return{u,v:{x:-u.y,y:u.x},rows};}
 return null;
}
function projectionRange(points,axis){const xs=points.map(p=>dot(p,axis));return{min:Math.min(...xs),max:Math.max(...xs)};}
function pFrom(uv,u,v){return add(mul(u,uv.u),mul(v,uv.v));}
function overlapsOpening(e,r,clearance=0){return !!(e?.a&&e?.b&&segmentInsideInterval(e.a,e.b,r,clearance));}
function cutSlabElement(e,rect,openingId){
 const pieces=subtractRect(e.polygon,rect);if(pieces.length===1&&Math.abs(area(pieces[0])-area(e.polygon))<1e-7)return[e];
 return pieces.map((polygon,i)=>({...e,id:e.id+':opening:'+openingId+':'+i,polygon,cutByOpening:openingId}));
}
function process(model,c,r,B){
 if(!r||c.system!=='wood'||!r.complete||!Array.isArray(r.elements))return r;
 const openings=(model.elements||[]).filter(o=>applies(o,c));if(!openings.length)return r;
 r.openingFraming=r.openingFraming||{openings:[],generated:0,cutJoists:0,cutLayers:0,validForConstruction:false};
 const issue=(code,text,severity='warning')=>{if(!r.issues.some(i=>i.code===code))r.issues.push({code,text,severity});};
 for(const o of openings){
  const rect=openingRect(o);if(!rect){issue('opening-geometry','Trémie ignorée : largeur, profondeur ou position invalide.','error');r.complete=false;continue;}
  const basis=beamBasis(r.elements);if(!basis){issue('opening-no-joists','Trémie détectée mais aucun solivage exploitable n’a été trouvé pour créer le chevêtre.','error');r.complete=false;continue;}
  const {u,v}=basis,b=Number(r.section?.b)/1000||Number(basis.rows[0]?.thickness)||.063,h=Number(r.section?.h)/1000||Number(basis.rows[0]?.height)||.2;
  const clear=b/2,opU=projectionRange(rect.corners,u),opV=projectionRange(rect.corners,v);
  const affected=basis.rows.filter(e=>overlapsOpening(e,rect,clear));
  const reference=affected[0]||basis.rows.reduce((best,e)=>{const mid=mul(add(e.a,e.b),.5),d=dist(mid,rect.c);return !best||d<best.d?{e,d}:best;},null)?.e;
  if(!reference){issue('opening-no-reference','Impossible de déterminer la travée de référence de la trémie.','error');r.complete=false;continue;}
  const span=projectionRange([reference.a,reference.b],u),leftV=opV.min-b/2,rightV=opV.max+b/2,headU=opU.min-b/2,tailU=opU.max+b/2;
  if(headU<span.min-.02||tailU>span.max+.02)issue('opening-support-edge','La trémie atteint ou dépasse un appui de la travée : le chevêtre généré reste schématique et le détail d’appui doit être étudié.');
  const next=[];let cutCount=0,layerCount=0;
  for(const e of r.elements){
   if(e.role==='joists'&&e.a&&e.b&&!e.openingFraming){
    const pieces=cutSegment(e,rect,clear);
    if(pieces.length===1&&dist(pieces[0].a,e.a)<1e-8&&dist(pieces[0].b,e.b)<1e-8){next.push(e);continue;}
    cutCount++;
    pieces.forEach((seg,i)=>next.push({...e,id:e.id+':opening:'+o.id+':'+i,a:seg.a,b:seg.b,floorRole:'joistSegment',cutByOpening:o.id}));
    continue;
   }
   if(e.type==='slab'&&Array.isArray(e.polygon)&&!e.void){
    const rows=cutSlabElement(e,rect,o.id);if(rows.length!==1||rows[0]!==e)layerCount++;next.push(...rows);continue;
   }
   next.push(e);
  }
  const common={generator:B.TAG,assemblyId:c.id,levelId:c.id,mode:'construction',locked:true,designStatus:'prestudy',role:'joists',type:'beam',thickness:b,height:h,zBase:r.sourceTop,openingFraming:true,openingId:o.id};
  const frame=[
   {...common,id:c.id+':opening:'+o.id+':trimmer-a',floorRole:'openingTrimmer',openingMember:'trimmer',a:pFrom({u:span.min,v:leftV},u,v),b:pFrom({u:span.max,v:leftV},u,v)},
   {...common,id:c.id+':opening:'+o.id+':trimmer-b',floorRole:'openingTrimmer',openingMember:'trimmer',a:pFrom({u:span.min,v:rightV},u,v),b:pFrom({u:span.max,v:rightV},u,v)},
   {...common,id:c.id+':opening:'+o.id+':header-a',floorRole:'openingHeader',openingMember:'header',a:pFrom({u:headU,v:leftV},u,v),b:pFrom({u:headU,v:rightV},u,v)},
   {...common,id:c.id+':opening:'+o.id+':header-b',floorRole:'openingHeader',openingMember:'header',a:pFrom({u:tailU,v:leftV},u,v),b:pFrom({u:tailU,v:rightV},u,v)}
  ];
  const voidZ=Number.isFinite(Number(r.bottom))?Number(r.bottom):Number(r.sourceTop),voidTop=Number.isFinite(Number(r.requiredTop))?Number(r.requiredTop):Number(r.sourceTop)+h;
  next.push(...frame,{generator:B.TAG,assemblyId:c.id,levelId:c.id,mode:'construction',locked:true,designStatus:'geometry-only',id:c.id+':opening:'+o.id+':void',type:'slab',role:'openingVoid',polygon:rect.corners.map(p=>({...p})),zBase:voidZ,height:Math.max(.01,voidTop-voidZ),void:true,openingFraming:true,openingId:o.id});
  r.elements=next;r.count=r.elements.filter(e=>e.role==='joists'&&e.a&&e.b).length;
  r.openingFraming.openings.push({id:o.id,sourceLevelId:o.sourceLevelId,targetLevelId:o.targetLevelId,linkedFloorId:o.linkedFloorId,width:Number(o.width),depth:Number(o.depth),cutJoists:cutCount,cutLayers:layerCount,memberCount:frame.length});
  r.openingFraming.generated+=frame.length;r.openingFraming.cutJoists+=cutCount;r.openingFraming.cutLayers+=layerCount;
  issue('opening-framing','Trémie : '+cutCount+' solive(s) recoupée(s), couches de plancher évidées et chevêtre géométrique créé (2 solives d’enchevêtrure + 2 chevêtres). Sections, doublages, sabots et assemblages restent à justifier.');
 }
 return r;
}
function install(B){
 if(B.openingFramingInstalled)return;B.openingFramingInstalled=true;const base=B.floorReport;
 B.floorReport=(m,c,g,s)=>process(m,c,base(m,c,g,s),B);
}
const api={openingRect,segmentInsideInterval,cutSegment,clipHalf,clipRect,subtractRect,applies,beamBasis,process,install};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root){root.PBPOpeningFraming=api;if(root.PBPBuilding)install(root.PBPBuilding);root.PBPOpeningFramingReady=true;}
})(typeof window!=='undefined'?window:globalThis);
