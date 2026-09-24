/* v0.10.6 — complete automatic joist coverage for closed orthogonal faces.
   Extends the existing prestudy; does not invent supports or validate execution. */
(function(root){
'use strict';
const EPS=1e-7, TAG='pbp-building-v09';
const abs=x=>Math.abs(x), add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}), mul=(a,t)=>({x:a.x*t,y:a.y*t});
const candidateSections=()=>{const out=[];for(const b of [45,63,75,100,120])for(const h of [145,170,195,220,245,270,300,340,400])if(h>=b&&h/b<=6)out.push({b,h});return out.sort((a,b)=>a.b*a.h-b.b*b.h||a.h-b.h);};
function frame(face,G){
 const pts=face?.points||[];if(pts.length<4)return null;let first=null;
 for(let i=0;i<pts.length;i++){const e=G.sub(pts[(i+1)%pts.length],pts[i]),L=Math.hypot(e.x,e.y);if(L>.05){first={x:e.x/L,y:e.y/L};break;}}
 if(!first)return null;const v={x:-first.y,y:first.x};
 for(let i=0;i<pts.length;i++){const e=G.sub(pts[(i+1)%pts.length],pts[i]),L=Math.hypot(e.x,e.y);if(L<EPS)continue;const parallel=Math.min(abs(G.cross(e,first)),abs(G.cross(e,v)));if(parallel>1e-5*L)return null;}
 return {o:pts[0],u:first,v};
}
function localPolygon(face,dir,G){
 const f=frame(face,G);if(!f)return null;const crossAxis=dir===0?f.u:f.v,spanAxis=dir===0?f.v:f.u;
 return {f,crossAxis,spanAxis,pts:face.points.map(p=>{const d=G.sub(p,f.o);return{x:G.dot(d,crossAxis),y:G.dot(d,spanAxis)};})};
}
function intersections(pts,x){
 const ys=[];
 for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],dx=b.x-a.x;if(abs(dx)<1e-10)continue;
  if((a.x<=x&&b.x>x)||(b.x<=x&&a.x>x)){const t=(x-a.x)/dx;ys.push(a.y+t*(b.y-a.y));}
 }
 ys.sort((a,b)=>a-b);const out=[];for(let i=0;i+1<ys.length;i+=2)if(ys[i+1]-ys[i]>.02)out.push([ys[i],ys[i+1]]);return out;
}
function world(lp,x,y){return add(lp.f.o,add(mul(lp.crossAxis,x),mul(lp.spanAxis,y)));}
function planFace(face,dir,target,G){
 const lp=localPolygon(face,dir,G);if(!lp)return null;const xs=lp.pts.map(p=>p.x),min=Math.min(...xs),max=Math.max(...xs),width=max-min;if(width<.1)return null;
 const n=Math.max(1,Math.ceil(width/Math.max(.15,target||.4))),spacing=width/n,segments=[];let maxSpan=0,totalLength=0;
 const critical=[...new Set(xs.map(x=>+x.toFixed(8)))].sort((a,b)=>a-b);
 for(let i=0;i<critical.length-1;i++)if(critical[i+1]-critical[i]>.001){const x=(critical[i]+critical[i+1])/2;for(const [a,b] of intersections(lp.pts,x))maxSpan=Math.max(maxSpan,b-a);}
 for(let k=0;k<=n;k++){const x=min+spacing*k,sample=k===0?min+Math.min(1e-5,width/1000):k===n?max-Math.min(1e-5,width/1000):x;
  for(const [a,b] of intersections(lp.pts,sample)){segments.push({a:world(lp,x,a),b:world(lp,x,b),length:b-a});maxSpan=Math.max(maxSpan,b-a);totalLength+=b-a;}
 }
 return {dir,spacing,count:segments.length,maxSpan,totalLength,segments,area:abs(G.area(face.points)),face};
}
function preferredPlan(face,c,G){
 const a=planFace(face,0,Number(c.spacing)||.4,G),b=planFace(face,1,Number(c.spacing)||.4,G);if(!a||!b)return a||b;
 const short=a.maxSpan<=b.maxSpan?a:b,long=short===a?b:a;return c.invert?long:short;
}
function loadConfig(c){
 const density=Number(c.ravoirageDensity)||1800,insDensity=Number(c.insulationDensity)||30;
 return {...c,finishes:Number(c.finishes||0)+Math.max(0,Number(c.ravoirage||0))/1000*density*9.80665/1000+Math.max(0,Number(c.insulationThickness||0))/1000*insDensity*9.80665/1000};
}
function selectSection(r,plans,c,S){
 const req=[];for(const b of r.bays||[])if(b.geometry?.L&&b.floor)req.push({f:b.floor,L:b.geometry.L,spacing:b.spacing});
 const f=loadConfig(c);for(const p of plans)req.push({f,L:p.maxSpan,spacing:p.spacing});
 const floorB=r.section?.b||0,floorH=r.section?.h||0;
 for(const s of candidateSections())if(s.b>=floorB&&s.h>=floorH&&req.every(x=>S.beamCheck(x.f,x.L,x.spacing,s.b,s.h).screened))return s;return null;
}
function shiftForSection(r,next){
 const old=r.section;if(!old||!next||next.h<=old.h)return;
 const delta=(next.h-old.h)/1000,cut=r.sourceTop+old.h/1000-EPS;r.section={...next};r.required+=delta;r.requiredTop+=delta;r.totalThickness+=delta;r.gap-=delta;
 r.layers=(r.layers||[]).filter(l=>l.role!=='reserve').map(l=>l.role==='joists'?{...l,h:next.h/1000}:l.z>=cut?{...l,z:l.z+delta}:l);
 if(r.gap>EPS)r.layers.push({role:'reserve',name:'Réserve non affectée',z:r.requiredTop,h:r.gap,void:true});
 for(const e of r.elements||[]){if(e.role==='joists'){e.thickness=next.b/1000;e.height=next.h/1000;}else if(Number.isFinite(e.zBase)&&e.zBase>=cut)e.zBase+=delta;}
 r.issues=(r.issues||[]).filter(i=>!/^Épaisseur disponible insuffisante/.test(i.text||'')&&!/^Réserve non affectée/.test(i.text||''));
 if(r.gap<-EPS){r.issues.push({code:'coverage-height',text:'Épaisseur disponible insuffisante de '+(-r.gap*100).toFixed(1)+' cm après couverture complète : coordonner le niveau supérieur.',severity:'error'});r.complete=false;}
 else if(r.gap>.001)r.issues.push({code:'coverage-reserve',text:'Réserve non affectée de '+(r.gap*100).toFixed(1)+' cm après recalcul complet.',severity:'warning'});
}
function augment(model,c,r,G,S){
 if(!r||c.system!=='wood'||r.coverage?.engine==='v0106')return r;
 const detection=G.faces(model,c.belowId,S),all=detection.faces||[],rect=all.filter(f=>f.rectangle),irregular=all.filter(f=>!f.rectangle),totalArea=all.reduce((n,f)=>n+abs(f.area||G.area(f.points)),0);
 r.coverage={engine:'v0106',totalArea,coveredArea:rect.reduce((n,f)=>n+abs(f.area||G.area(f.points)),0),missingArea:0,rectangles:rect.length,automaticShapes:0,unsupportedShapes:0};
 if(!irregular.length){r.coverage.missingArea=Math.max(0,totalArea-r.coverage.coveredArea);return r;}
 const plans=[],unsupported=[];for(const face of irregular){const p=preferredPlan(face,c,G);if(!p||!Number.isFinite(p.maxSpan)||p.maxSpan<=.05)unsupported.push(face);else plans.push(p);}
 r.coverage.automaticShapes=plans.length;r.coverage.unsupportedShapes=unsupported.length;
 if(unsupported.length){const a=unsupported.reduce((n,f)=>n+abs(f.area||G.area(f.points)),0);r.coverage.missingArea=a;r.issues.push({code:'coverage-shape',text:unsupported.length+' zone(s) fermée(s) non orthogonale(s) restent hors du solivage automatique ('+a.toFixed(2)+' m²). Ajouter/ajuster les appuis ou faire étudier ces zones.',severity:'error'});r.complete=false;return r;}
 const section=selectSection(r,plans,c,S);if(!section){r.coverage.missingArea=plans.reduce((n,p)=>n+p.area,0);r.issues.push({code:'coverage-section',text:'Aucune section d’essai commune ne couvre toutes les zones supplémentaires détectées. Un appui ou une autre structure est nécessaire.',severity:'error'});r.complete=false;return r;}
 shiftForSection(r,section);if((r.issues||[]).some(i=>i.severity==='error')){r.coverage.missingArea=plans.reduce((n,p)=>n+p.area,0);return r;}
 const common={generator:TAG,assemblyId:c.id,levelId:c.id,mode:'construction',locked:true,designStatus:'prestudy'};let added=0;const cfg=loadConfig(c);
 for(let fi=0;fi<plans.length;fi++){const p=plans[fi],check=S.beamCheck(cfg,p.maxSpan,p.spacing,section.b,section.h);r.bays.push({floor:cfg,geometry:{L:p.maxSpan,area:p.area},spacing:p.spacing,count:p.segments.length,check,suggestion:check,direction:p.dir,faceIndex:rect.length+fi,irregular:true});
  if(c.enabled&&r.complete){for(let k=0;k<p.segments.length;k++){const s=p.segments[k];r.elements.push({...common,id:c.id+':full:'+fi+':'+k,type:'beam',role:'joists',floorRole:'joist',a:s.a,b:s.b,thickness:section.b/1000,height:section.h/1000,zBase:r.sourceTop,coverageFace:true});added++;}}
  if(c.enabled&&r.complete)for(const l of (r.layers||[]).filter(l=>l.role!=='joists'))r.elements.push({...common,id:c.id+':full:'+fi+':'+l.role,type:'slab',role:l.role,polygon:p.face.points,zBase:l.z,height:l.h,void:!!l.void,hiddenLayer:c.showAllLayers===false&&!['panel','concrete'].includes(l.role)});
 }
 r.count+=added;r.area=totalArea;r.coverage.coveredArea=totalArea;r.coverage.missingArea=0;
 r.issues=(r.issues||[]).filter(i=>!/^Travées non rectangulaires exclues/.test(i.text||''));
 r.issues.push({code:'coverage-complete',text:'Solivage automatique étendu à '+plans.length+' zone(s) orthogonale(s) non rectangulaire(s). Couverture géométrique : '+totalArea.toFixed(2)+' m².',severity:'warning'});
 return r;
}
function install(B,G,S,F){
 if(B.joistCoverageInstalled)return;B.joistCoverageInstalled=true;const oldFloor=B.floorReport,oldReport=B.report;
 B.floorReport=(m,c,g=G,s=S)=>augment(m,c,oldFloor(m,c,g,s),g,s);
 B.report=(m,g=G,s=S,f=F)=>{const base=oldReport(m,g,s,f);base.floors=base.floors.map(r=>augment(m,r.config,r,g,s));base.elements=base.floors.flatMap(r=>r.elements||[]);base.levels=base.floors.flatMap(r=>r.level?[r.level]:[]);base.quantities=B.quantities(m,base.floors,f);return base;};
}
const api={frame,planFace,preferredPlan,augment,install};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root){root.PBPJoistCoverage=api;if(root.PBPBuilding&&root.PBPGeometry&&root.PBPStructure&&root.PBPFoundations)install(root.PBPBuilding,root.PBPGeometry,root.PBPStructure,root.PBPFoundations);root.PBPJoistCoverageReady=true;}
})(typeof window!=='undefined'?window:globalThis);