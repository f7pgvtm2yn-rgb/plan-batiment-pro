/* Plan Bâtiment Pro v0.16.11 — automatic blocking / noggins between floor joists.
   Geometry and quantity take-off only. The longitudinal spacing is a project rule,
   not a universal DTU prescription; execution details and structural justification remain required. */
(function(root){
'use strict';
const EPS=1e-7,DEFAULT_MAX_RUN=2.0,MIN_MEMBER=.03;
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),mul=(a,t)=>({x:a.x*t,y:a.y*t});
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=v=>{const L=Math.hypot(v.x,v.y);return L>EPS?mul(v,1/L):null;};
const num=(v,f=null)=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))?Number(v):f;
function cfg(c){
 return {enabled:c?.blockingEnabled!==false,maxRun:Math.max(.30,num(c?.blockingMaxRun,DEFAULT_MAX_RUN)),widthMm:Math.max(0,num(c?.blockingWidth,0)),heightMm:Math.max(0,num(c?.blockingHeight,0))};
}
function bayIndex(e){
 if(Number.isInteger(Number(e?.bayIndex)))return Number(e.bayIndex);
 const id=String(e?.id||'');
 for(const re of [/:seated:(\d+):/,/:rim-long:(\d+):/,/:full:(\d+):/,/:bay:(\d+):/]){const m=id.match(re);if(m)return Number(m[1]);}
 return 0;
}
function pointInPolygon(p,poly){
 let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j],hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y||1e-12)+a.x);if(hit)inside=!inside;
 }return inside;
}
function orient(a,b,c){return cross(sub(b,a),sub(c,a));}
function onSeg(a,b,p){return Math.abs(orient(a,b,p))<1e-8&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;}
function segmentsIntersect(a,b,c,d){
 const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
 if(((o1>EPS&&o2<-EPS)||(o1<-EPS&&o2>EPS))&&((o3>EPS&&o4<-EPS)||(o3<-EPS&&o4>EPS)))return true;
 return onSeg(a,b,c)||onSeg(a,b,d)||onSeg(c,d,a)||onSeg(c,d,b);
}
function crossesVoid(a,b,voids){
 const mid=mul(add(a,b),.5);for(const p of voids){if(pointInPolygon(mid,p))return true;for(let i=0;i<p.length;i++)if(segmentsIntersect(a,b,p[i],p[(i+1)%p.length]))return true;}return false;
}
function memberPointAt(e,u,s){
 const pa=dot(e.a,u),pb=dot(e.b,u),lo=Math.min(pa,pb),hi=Math.max(pa,pb);if(s<lo-1e-6||s>hi+1e-6||Math.abs(pb-pa)<EPS)return null;
 const t=(s-pa)/(pb-pa);return{x:e.a.x+(e.b.x-e.a.x)*t,y:e.a.y+(e.b.y-e.a.y)*t};
}
function isLongitudinalMember(e){return e?.a&&e?.b&&['joist','joistSegment','edgeJoist','openingTrimmer'].includes(e.floorRole);}
function makeForBay(c,r,bi,members,voids,config){
 const usable=members.filter(isLongitudinalMember);if(usable.length<2)return {bayIndex:bi,rows:0,members:0,totalLength:0,elements:[]};
 const seed=usable.slice().sort((a,b)=>dist(b.a,b.b)-dist(a.a,a.b))[0],u0=unit(sub(seed.b,seed.a));if(!u0)return {bayIndex:bi,rows:0,members:0,totalLength:0,elements:[]};
 const u=u0,v={x:-u.y,y:u.x},parallel=usable.filter(e=>{const x=unit(sub(e.b,e.a));return x&&Math.abs(cross(x,u))<.12;});if(parallel.length<2)return {bayIndex:bi,rows:0,members:0,totalLength:0,elements:[]};
 const projections=parallel.flatMap(e=>[dot(e.a,u),dot(e.b,u)]),lo=Math.min(...projections),hi=Math.max(...projections),span=hi-lo;
 if(!(span>.05))return {bayIndex:bi,rows:0,members:0,totalLength:0,elements:[]};
 const rowCount=Math.max(0,Math.ceil(span/config.maxRun)-1),sectionB=(config.widthMm>0?config.widthMm:num(r.section?.b,63))/1000,sectionH=(config.heightMm>0?config.heightMm:num(r.section?.h,200))/1000;
 const target=Math.max(.15,num(r.bays?.[bi]?.spacing,num(c.spacing,.4))),maxGap=Math.max(.35,target*1.8),elements=[];let actualRows=0,totalLength=0;
 for(let row=1;row<=rowCount;row++){
  const s=lo+span*row/(rowCount+1),hits=[];
  for(const e of parallel){const p=memberPointAt(e,u,s);if(!p)continue;hits.push({e,p,q:dot(p,v),t:Math.max(.001,num(e.thickness,sectionB))});}
  hits.sort((a,b)=>a.q-b.q);const unique=[];for(const h of hits){const last=unique.at(-1);if(last&&Math.abs(last.q-h.q)<.015){if(h.t>last.t)unique[unique.length-1]=h;}else unique.push(h);}
  let placed=0;for(let i=0;i+1<unique.length;i++){
   const A=unique[i],B=unique[i+1],gap=B.q-A.q;if(gap<=Math.max(A.t,B.t)+MIN_MEMBER||gap>maxGap)continue;
   const dir=unit(sub(B.p,A.p));if(!dir)continue;const a=add(A.p,mul(dir,A.t/2)),b=add(B.p,mul(dir,-B.t/2));if(dist(a,b)<MIN_MEMBER||crossesVoid(a,b,voids))continue;
   const e={generator:B_TAG,assemblyId:c.id,levelId:c.id,mode:'construction',locked:true,designStatus:'prestudy',id:c.id+':blocking:'+bi+':'+row+':'+i,type:'beam',role:'blocking',floorRole:'blocking',blockingRow:row,bayIndex:bi,a,b,thickness:sectionB,height:sectionH,zBase:r.sourceTop};
   elements.push(e);placed++;totalLength+=dist(a,b);
  }
  if(placed)actualRows++;
 }
 return {bayIndex:bi,rows:actualRows,members:elements.length,totalLength,elements,span,maxRun:config.maxRun,section:{b:sectionB*1000,h:sectionH*1000}};
}
let B_TAG='pbp-building-v09';
function process(model,c,r,B){
 if(!r||c.system!=='wood'||!r.complete||!Array.isArray(r.elements)||r.blocking?.engine==='v01611')return r;B_TAG=B.TAG||B_TAG;
 const config=cfg(c);r.blocking={engine:'v01611',enabled:config.enabled,maxRun:config.maxRun,rowCount:0,memberCount:0,totalLength:0,section:null,bays:[],validForConstruction:false};
 if(!config.enabled){r.issues.push({code:'blocking-disabled',text:'Entretoises automatiques désactivées pour ce plancher.',severity:'warning'});return r;}
 const groups=new Map();for(const e of r.elements)if(isLongitudinalMember(e)){const k=bayIndex(e);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e);}
 const voids=r.elements.filter(e=>e.role==='openingVoid'&&Array.isArray(e.polygon)).map(e=>e.polygon);
 const generated=[];for(const [bi,members] of groups){const x=makeForBay(c,r,bi,members,voids,config);r.blocking.bays.push(x);generated.push(...x.elements);r.blocking.rowCount+=x.rows;r.blocking.memberCount+=x.members;r.blocking.totalLength+=x.totalLength;if(!r.blocking.section&&x.section)r.blocking.section=x.section;}
 r.elements.push(...generated);
 if(r.blocking.memberCount){r.issues.push({code:'blocking-result',text:'Entretoises : '+r.blocking.rowCount+' ligne(s), '+r.blocking.memberCount+' pièce(s), '+r.blocking.totalLength.toFixed(2)+' m au total. Répartition calculée pour ne pas dépasser '+config.maxRun.toFixed(2)+' m entre lignes/appuis, selon la règle de projet saisie.',severity:'warning'});}
 else r.issues.push({code:'blocking-none',text:'Aucune entretoise intermédiaire générée : la longueur entre appuis ne dépasse pas la règle de projet de '+config.maxRun.toFixed(2)+' m, ou la géométrie ne fournit pas deux solives voisines exploitables.',severity:'warning'});
 r.issues.push({code:'blocking-scope',text:'Entretoises = calepinage géométrique et métré de préétude. Leur nécessité, section, fixation, disposition en ligne/quinconce et rôle vis-à-vis des cloisons, vibrations ou charges concentrées restent à vérifier selon le système de plancher et les prescriptions applicables.',severity:'warning'});
 return r;
}
function install(B,G,S,F){
 if(B.blockingInstalled)return;B.blockingInstalled=true;B_TAG=B.TAG||B_TAG;const floor=B.floorReport,report=B.report,quantities=B.quantities;
 const finalize=(m,c,r)=>{if(root.PBPOpeningFraming&&!r?.openingFraming)r=root.PBPOpeningFraming.process(m,c,r,B);return process(m,c,r,B);};
 B.floorReport=(m,c,g=G,s=S)=>finalize(m,c,floor(m,c,g,s));
 B.quantities=(m,rs,f=F)=>{const q=quantities(m,rs,f);q.rows=q.rows.filter(x=>x.material!=='blocking'&&x.label!=='blocking'&&x.material!=='bois entretoises');for(const r of rs)if(r.complete&&r.blocking?.enabled){const level=r.config.name||r.level?.name||r.config.id,els=(r.elements||[]).filter(e=>e.role==='blocking'&&e.a&&e.b),length=els.reduce((n,e)=>n+dist(e.a,e.b),0),volume=els.reduce((n,e)=>n+dist(e.a,e.b)*num(e.thickness,0)*num(e.height,0),0);if(els.length){q.rows.push({level,material:'bois entretoises',label:'Entretoises',unit:'unités',quantity:els.length,note:'Pièces générées entre faces de solives ; fixations et pertes non incluses'});q.rows.push({level,material:'bois entretoises',label:'Longueur totale d’entretoises',unit:'m',quantity:length,note:'Longueur brute entre faces de solives'});q.rows.push({level,material:'bois entretoises',label:'Volume d’entretoises',unit:'m³',quantity:volume,note:'Volume brut selon la section de préétude'});}q.rows.push({level,material:'bois entretoises',label:'Lignes d’entretoises',unit:'unités',quantity:r.blocking.rowCount||0,note:'Nombre de lignes effectivement générées ; règle de projet max '+Number(r.blocking.maxRun).toFixed(2)+' m'});}return q;};
 B.report=(m,g=G,s=S,f=F)=>{const base=report(m,g,s,f);base.floors=base.floors.map(r=>finalize(m,r.config,r));base.elements=base.floors.flatMap(r=>r.elements||[]);base.levels=base.floors.flatMap(r=>r.level?[r.level]:[]);base.quantities=B.quantities(m,base.floors,f);return base;};
}
const api={DEFAULT_MAX_RUN,cfg,bayIndex,pointInPolygon,segmentsIntersect,crossesVoid,process,install};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root){root.PBPBlocking=api;if(root.PBPBuilding&&root.PBPGeometry&&root.PBPStructure&&root.PBPFoundations)install(root.PBPBuilding,root.PBPGeometry,root.PBPStructure,root.PBPFoundations);root.PBPBlockingReady=true;}
})(typeof window!=='undefined'?window:globalThis);
