/* Plan Bâtiment Pro v0.16.13 — panel-edge support and upper-wall load-path audit.
   NF DTU 51.3-oriented geometry checks: panel short ends on supports; unsupported
   longitudinal edges require T&G/assembled edges or a timber support below. */
(function(root){
'use strict';
const EPS=1e-7,MIN=.03;
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),mul=(a,t)=>({x:a.x*t,y:a.y*t});
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),unit=v=>{const L=Math.hypot(v.x,v.y);return L>EPS?mul(v,1/L):null;};
const num=(v,f=null)=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))?Number(v):f;
function bayIndex(e){if(Number.isInteger(Number(e?.bayIndex)))return Number(e.bayIndex);const id=String(e?.id||'');for(const re of [/:seated:(\d+):/,/:rim-long:(\d+):/,/:full:(\d+):/,/:bay:(\d+):/]){const m=id.match(re);if(m)return Number(m[1]);}return 0;}
function isJoist(e){return e?.a&&e?.b&&['joist','joistSegment','edgeJoist','openingTrimmer'].includes(e.floorRole);}
function memberPointAt(e,u,s){const pa=dot(e.a,u),pb=dot(e.b,u),lo=Math.min(pa,pb),hi=Math.max(pa,pb);if(s<lo-1e-6||s>hi+1e-6||Math.abs(pb-pa)<EPS)return null;const t=(s-pa)/(pb-pa);return{x:e.a.x+(e.b.x-e.a.x)*t,y:e.a.y+(e.b.y-e.a.y)*t};}
function tracks(members,u,v,defaultT){const rows=members.filter(isJoist).map(e=>{const p=mul(add(e.a,e.b),.5);return{e,q:dot(p,v),t:Math.max(.001,num(e.thickness,defaultT))};}).sort((a,b)=>a.q-b.q),out=[];for(const x of rows){let t=out.at(-1);if(!t||Math.abs(t.q-x.q)>.015){t={q:x.q,t:x.t,members:[x.e]};out.push(t);}else{t.members.push(x.e);t.t=Math.max(t.t,x.t);}}return out;}
function trackPoint(t,u,s){for(const e of t.members){const p=memberPointAt(e,u,s);if(p)return p;}return null;}
function panelConfig(c,r){return{edgeMode:['tongue-groove','square'].includes(c?.panelEdgeMode)?c.panelEdgeMode:'unknown',usableLengthMm:Math.max(0,num(c?.panelUsableLength,0)),usableWidthMm:Math.max(0,num(c?.panelUsableWidth,0)),supportWidthMm:Math.max(0,num(c?.panelSupportWidth,0)),supportHeightMm:Math.max(0,num(c?.panelSupportHeight,0)),joistB:Math.max(1,num(r?.section?.b,63)),joistH:Math.max(1,num(r?.section?.h,200))};}
function supportAtRow(c,r,bi,members,s,row,pc,B){
 const seed=members.filter(isJoist).sort((a,b)=>dist(b.a,b.b)-dist(a.a,a.b))[0],u=seed&&unit(sub(seed.b,seed.a));if(!u)return[];const v={x:-u.y,y:u.x},ts=tracks(members,u,v,pc.joistB/1000),target=Math.max(.15,num(r.bays?.[bi]?.spacing,num(c.spacing,.4))),maxGap=Math.max(.35,target*1.8),out=[];
 for(let i=0;i+1<ts.length;i++){const A=ts[i],D=ts[i+1],pa=trackPoint(A,u,s),pb=trackPoint(D,u,s);if(!pa||!pb||D.q-A.q>maxGap)continue;const dir=unit(sub(pb,pa));if(!dir)continue;const a=add(pa,mul(dir,A.t/2)),b=add(pb,mul(dir,-D.t/2));if(dist(a,b)<MIN)continue;
  const existing=(r.elements||[]).find(e=>e.role==='blocking'&&e.a&&e.b&&dist(mul(add(e.a,e.b),.5),mul(add(a,b),.5))<.035);
  if(existing){existing.panelJointSupport=true;existing.panelJointRow=row;continue;}
  out.push({generator:B.TAG,assemblyId:c.id,levelId:c.id,mode:'construction',locked:true,designStatus:'prestudy',id:c.id+':panel-support:'+bi+':'+row+':'+i,type:'beam',role:'panelJointSupport',floorRole:'panelJointSupport',panelJointRow:row,bayIndex:bi,a,b,thickness:(pc.supportWidthMm||pc.joistB)/1000,height:(pc.supportHeightMm||pc.joistH)/1000,zBase:r.sourceTop});
 }return out;
}
function panelProcess(c,r,B){
 r.panelLayout={engine:'v01613',edgeMode:'unknown',configured:false,shortEdgeSupport:null,jointSupportCount:0,totalSupportLength:0,issues:[],validForConstruction:false};
 if(!r||c.system!=='wood'||!(Number(c.panel)>0)||!Array.isArray(r.elements))return r;
 const pc=panelConfig(c,r);r.panelLayout.edgeMode=pc.edgeMode;r.panelLayout.configured=pc.edgeMode!=='unknown'||pc.usableLengthMm>0||pc.usableWidthMm>0;
 const issue=(code,text,severity='warning')=>{const x={code,text,severity};r.panelLayout.issues.push(x);r.issues.push(x);};
 if(pc.edgeMode==='unknown'){issue('panel-edge-mode','Type de rives des panneaux non renseigné : indiquer rainure-languette/assemblées ou bords droits pour contrôler les appuis de joints.');return r;}
 if(!(pc.usableLengthMm>0&&pc.usableWidthMm>0)){issue('panel-dimensions','Dimensions utiles du panneau à renseigner pour vérifier que les petites rives tombent sur les appuis et pour calepiner les joints.', 'error');r.complete=false;return r;}
 const Lp=pc.usableLengthMm/1000,Wp=pc.usableWidthMm/1000,groups=new Map();for(const e of r.elements)if(isJoist(e)){const k=bayIndex(e);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e);}
 let allEnds=true;const generated=[];
 for(const [bi,members] of groups){
  const spacing=num(r.bays?.[bi]?.spacing,num(c.spacing,.4));if(!(spacing>0))continue;const n=Math.round(Lp/spacing),err=Math.abs(Lp-n*spacing),ok=n>=1&&err<=.005;allEnds=allEnds&&ok;
  if(!ok)issue('panel-short-edge-support-'+bi,'Travée '+(bi+1)+' : longueur utile panneau '+pc.usableLengthMm.toFixed(0)+' mm incompatible avec l’entraxe '+(spacing*1000).toFixed(0)+' mm (petites rives à faire tomber sur un appui).','error');
  const seed=members.filter(isJoist).sort((a,b)=>dist(b.a,b.b)-dist(a.a,a.b))[0],u=seed&&unit(sub(seed.b,seed.a));if(!u)continue;const proj=members.flatMap(e=>[dot(e.a,u),dot(e.b,u)]),lo=Math.min(...proj),hi=Math.max(...proj),span=hi-lo;
  if(pc.edgeMode==='square'){let row=0;for(let s=lo+Wp;s<hi-.02;s+=Wp){row++;generated.push(...supportAtRow(c,r,bi,members,s,row,pc,B));}}
 }
 r.panelLayout.shortEdgeSupport=allEnds;r.elements.push(...generated);const supports=r.elements.filter(e=>(e.role==='panelJointSupport'||e.panelJointSupport)&&e.a&&e.b);r.panelLayout.jointSupportCount=supports.length;r.panelLayout.totalSupportLength=supports.reduce((n,e)=>n+dist(e.a,e.b),0);
 if(!allEnds){r.complete=false;issue('panel-layout-block','Calepinage panneau non compatible avec les appuis actuels : ajuster l’entraxe des solives ou le format utile du panneau avant validation.','error');}
 if(pc.edgeMode==='square')issue('panel-square-support','Bords droits : '+r.panelLayout.jointSupportCount+' support(s) sous joints longitudinaux généré(s), longueur totale '+r.panelLayout.totalSupportLength.toFixed(2)+' m. Les quatre côtés des panneaux doivent rester supportés.');
 else issue('panel-tg-support','Rives longitudinales rainurées-languettées/assemblées : pas de cours de bois ajouté sous ces joints ; les petites rives restent contrôlées sur appui.');
 issue('panel-bearing-width','Appui de panneau : contrôle de principe fondé sur un appui de rive ; vérifier la largeur d’appui et les fixations prescrites par le panneau et le NF DTU 51.3.');
 return r;
}
function loadAudit(model,c,r,B,S){
 r.loadSupport={engine:'v01613',direct:[],unresolved:[],markers:[],validForConstruction:false};const upper=(model.elements||[]).filter(e=>e.mode==='construction'&&!e.generator&&e.levelId===c.aboveId);
 const heavy=upper.filter(e=>['wallExterior','wallBearing','column'].includes(e.type)||S.heavyPartition?.(e));
 for(const e of heavy){const direct=e.type==='column'?S.pointSupportBelow?.(model,{sourceLevelId:c.belowId},e):S.lineSupportBelow?.(model,{sourceLevelId:c.belowId},e);if(direct){r.loadSupport.direct.push({id:e.id,type:e.type,supportId:direct.support.id});continue;}
  r.loadSupport.unresolved.push({id:e.id,type:e.type,material:e.materialSpec?.type||'unknown'});if(e.a&&e.b){const marker={generator:B.TAG,assemblyId:c.id,levelId:c.id,mode:'construction',locked:true,designStatus:'requires-engineering',id:c.id+':load-transfer:'+e.id,type:'beam',role:'loadTransferRequired',floorRole:'loadTransferRequired',sourceElementId:e.id,a:{...e.a},b:{...e.b},thickness:Math.max(.04,num(e.thickness,.08)),height:.03,zBase:Number.isFinite(r.sourceTop)?r.sourceTop:Number(r.bottom||0)};r.loadSupport.markers.push(marker);}}
 if(r.loadSupport.direct.length)r.issues.push({code:'load-support-direct',text:r.loadSupport.direct.length+' mur(s)/charge(s) lourde(s) sont géométriquement alignés avec un appui porteur inférieur. La continuité réelle des appuis et la descente jusqu’aux fondations restent à vérifier.',severity:'warning'});
 if(r.loadSupport.unresolved.length)r.issues.push({code:'load-support-unresolved',text:r.loadSupport.unresolved.length+' mur(s)/cloison(s) lourde(s) ne disposent pas d’un appui porteur directement aligné sous leur axe. Une poutre, solive renforcée ou autre reprise doit être dimensionnée ; les entretoises ne sont pas comptées comme reprise de charge.',severity:'error'});
 r.elements.push(...r.loadSupport.markers);return r;
}
function process(model,c,r,B,S){if(!r||c.system!=='wood'||r.floorDetails?.engine==='v01613')return r;r.floorDetails={engine:'v01613'};loadAudit(model,c,r,B,S);if(r.complete)panelProcess(c,r,B);return r;}
function install(B,G,S,F){if(B.floorDetailsInstalled)return;B.floorDetailsInstalled=true;const floor=B.floorReport,report=B.report,quantities=B.quantities;B.floorReport=(m,c,g=G,s=S)=>process(m,c,floor(m,c,g,s),B,s);
 B.quantities=(m,rs,f=F)=>{const q=quantities(m,rs,f);q.rows=q.rows.filter(x=>x.material!=='bois supports panneaux');for(const r of rs){const level=r.config?.name||r.level?.name||r.config?.id,els=(r.elements||[]).filter(e=>e.role==='panelJointSupport'&&e.a&&e.b),tagged=(r.elements||[]).filter(e=>e.panelJointSupport&&e.a&&e.b),all=[...els,...tagged.filter(e=>!els.includes(e))];if(all.length){const L=all.reduce((n,e)=>n+dist(e.a,e.b),0),V=all.reduce((n,e)=>n+dist(e.a,e.b)*num(e.thickness,0)*num(e.height,0),0);q.rows.push({level,material:'bois supports panneaux',label:'Supports sous joints de panneaux',unit:'unités',quantity:all.length,note:'Supports de joints à bords droits ou entretoises existantes réutilisées'});q.rows.push({level,material:'bois supports panneaux',label:'Longueur supports de panneaux',unit:'m',quantity:L,note:'Longueur brute'});q.rows.push({level,material:'bois supports panneaux',label:'Volume supports de panneaux',unit:'m³',quantity:V,note:'Volume brut ; assemblages et pertes non inclus'});}}return q;};
 B.report=(m,g=G,s=S,f=F)=>{const base=report(m,g,s,f);base.floors=base.floors.map(r=>process(m,r.config,r,B,s));base.elements=base.floors.flatMap(r=>r.elements||[]);base.levels=base.floors.flatMap(r=>r.level?[r.level]:[]);base.quantities=B.quantities(m,base.floors,f);return base;};
}
const api={panelConfig,panelProcess,loadAudit,process,install};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root){root.PBPFloorDetails=api;if(root.PBPBuilding&&root.PBPGeometry&&root.PBPStructure&&root.PBPFoundations)install(root.PBPBuilding,root.PBPGeometry,root.PBPStructure,root.PBPFoundations);root.PBPFloorDetailsReady=true;}
})(typeof window!=='undefined'?window:globalThis);
