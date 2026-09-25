/* v0.14.0 — assisted reconstruction, geometry only. No structural inference. */
(function(root){
'use strict';
const finite=Number.isFinite,point=p=>p&&finite(p.x)&&finite(p.y),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function scaleFrom(a,b,metres){const pixels=point(a)&&point(b)?dist(a,b):0;if(!(pixels>=5)||!finite(metres)||metres<=0)throw Error('Choisissez deux points distincts et une distance réelle positive.');return metres/pixels;}
function bands(mask,W,H,vertical,minLength){
 const major=vertical?H:W,minor=vertical?W:H,out=[];let active=[];
 for(let y=0;y<minor;y++){
  const runs=[];let start=-1;
  for(let x=0;x<=major;x++){const black=x<major&&mask[vertical?x*W+y:y*W+x];if(black&&start<0)start=x;if(!black&&start>=0){if(x-start>=minLength)runs.push({lo:start,hi:x-1});start=-1;}}
  const next=[],used=new Set();
  for(const run of runs){let j=active.findIndex((a,i)=>!used.has(i)&&Math.abs(a.lo-run.lo)<=3&&Math.abs(a.hi-run.hi)<=3);if(j<0)next.push({...run,from:y,to:y});else{used.add(j);const a=active[j];next.push({...a,lo:Math.min(a.lo,run.lo),hi:Math.max(a.hi,run.hi),to:y});}}
  for(let i=0;i<active.length;i++)if(!used.has(i))out.push(active[i]);active=next;
 }
 out.push(...active);return out.map(b=>({...b,vertical,width:b.to-b.from+1,length:b.hi-b.lo+1,axis:(b.from+b.to)/2}));
}
function recognize(image,options={}){
 const {width:W,height:H,data}=image;if(!Number.isInteger(W)||!Number.isInteger(H)||W<2||H<2||W*H>6000000||!data||data.length!==W*H*4)throw Error('Image absente ou trop grande (6 millions de pixels maximum).');
 const threshold=Number(options.threshold??155),minLength=Math.max(15,Number(options.minLength??60)),minWidth=Math.max(2,Number(options.minWidth??3)),maxWidth=Math.max(minWidth+1,Number(options.maxWidth??45));
 const mask=new Uint8Array(W*H);for(let i=0;i<mask.length;i++){const k=i*4,alpha=data[k+3]/255,lum=(data[k]*.2126+data[k+1]*.7152+data[k+2]*.0722)*alpha+255*(1-alpha);mask[i]=lum<threshold?1:0;}
 const bs=[...bands(mask,W,H,false,minLength),...bands(mask,W,H,true,minLength)],chosen=[],paired=new Set();
 // Two close, parallel thin strokes can describe the two faces of an outlined wall.
 for(let i=0;i<bs.length;i++){const a=bs[i];if(a.width>=minWidth||paired.has(i))continue;let best=-1,gap=Infinity;
  for(let j=i+1;j<bs.length;j++){const b=bs[j],d=Math.abs(a.axis-b.axis),overlap=Math.min(a.hi,b.hi)-Math.max(a.lo,b.lo);if(b.vertical!==a.vertical||b.width>=minWidth||paired.has(j)||d<minWidth||d>maxWidth||overlap<.85*Math.max(a.length,b.length))continue;if(d<gap){best=j;gap=d;}}
  if(best>=0){const b=bs[best];paired.add(i);paired.add(best);chosen.push({...a,axis:(a.axis+b.axis)/2,width:gap+(a.width+b.width)/2,lo:Math.max(a.lo,b.lo),hi:Math.min(a.hi,b.hi),method:'paired-outlines'});}
 }
 for(let i=0;i<bs.length;i++){const b=bs[i];if(b.width>=minWidth&&b.width<=maxWidth&&b.length>=b.width*4)chosen.push({...b,method:'solid-band'});}
 // Junctions can make the outer and inner halves of one filled stroke have
 // different run lengths. Reunite adjacent bands before turning them into axes.
 let joined=true;while(joined){joined=false;outer:for(let i=0;i<chosen.length;i++)for(let j=i+1;j<chosen.length;j++){const a=chosen[i],b=chosen[j];if(a.method!=='solid-band'||b.method!=='solid-band'||a.vertical!==b.vertical)continue;const lo=Math.min(a.from,b.from),hi=Math.max(a.to,b.to),overlap=Math.min(a.hi,b.hi)-Math.max(a.lo,b.lo);if(hi-lo+1>maxWidth||a.from>b.to+1||b.from>a.to+1||overlap<.85*Math.max(a.length,b.length))continue;chosen[i]={...a,from:lo,to:hi,axis:(lo+hi)/2,width:hi-lo+1,lo:Math.min(a.lo,b.lo),hi:Math.max(a.hi,b.hi),length:Math.max(a.hi,b.hi)-Math.min(a.lo,b.lo)+1};chosen.splice(j,1);joined=true;break outer;}}
 let walls=chosen.map((b,i)=>({id:'scan-'+i,type:'partition',accepted:true,kind:'wall',thickness:b.width,method:b.method,a:b.vertical?{x:b.axis,y:b.lo}:{x:b.lo,y:b.axis},b:b.vertical?{x:b.axis,y:b.hi}:{x:b.hi,y:b.axis}}));
 // Remove overlapping parallel duplicates without merging actual doorway gaps.
 walls=walls.filter((w,i,a)=>!a.slice(0,i).some(q=>parallel(w,q)&&lineDistance(w,q)<Math.min(w.thickness,q.thickness)*.6&&overlapRatio(w,q)>.85));
 snapEnds(walls,Math.min(12,maxWidth));
 if(walls.length>350)walls=walls.slice(0,350);
 return{walls,openings:possibleOpenings(walls,options.scale),notes:['Reconnaissance des murs horizontaux/verticaux : vérifiez les traits, angles et épaisseurs.','Un scan ne détermine pas le caractère porteur ni les matériaux.']};
}
function parallel(a,b){const u={x:a.b.x-a.a.x,y:a.b.y-a.a.y},v={x:b.b.x-b.a.x,y:b.b.y-b.a.y};return Math.abs(u.x*v.y-u.y*v.x)<.001*dist(a.a,a.b)*dist(b.a,b.b);}
function lineDistance(a,b){const u={x:a.b.x-a.a.x,y:a.b.y-a.a.y},L=dist(a.a,a.b);return Math.abs(u.x*(b.a.y-a.a.y)-u.y*(b.a.x-a.a.x))/L;}
function overlapRatio(a,b){const vertical=Math.abs(a.b.y-a.a.y)>Math.abs(a.b.x-a.a.x),k=vertical?'y':'x',A=[a.a[k],a.b[k]].sort((a,b)=>a-b),B=[b.a[k],b.b[k]].sort((a,b)=>a-b);return Math.max(0,Math.min(A[1],B[1])-Math.max(A[0],B[0]))/Math.max(1,Math.min(A[1]-A[0],B[1]-B[0]));}
function snapEnds(walls,tolerance=8){
 const patches=[];for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
  const a=walls[i],b=walls[j],u={x:a.b.x-a.a.x,y:a.b.y-a.a.y},v={x:b.b.x-b.a.x,y:b.b.y-b.a.y},den=u.x*v.y-u.y*v.x;if(Math.abs(den)<1e-9)continue;
  const d={x:b.a.x-a.a.x,y:b.a.y-a.a.y},t=(d.x*v.y-d.y*v.x)/den,p={x:a.a.x+u.x*t,y:a.a.y+u.y*t},r=((p.x-b.a.x)*v.x+(p.y-b.a.y)*v.y)/(v.x*v.x+v.y*v.y),tol=Math.max(tolerance,(a.thickness+b.thickness)/2);
  if(t< -tol/dist(a.a,a.b)||t>1+tol/dist(a.a,a.b)||r< -tol/dist(b.a,b.b)||r>1+tol/dist(b.a,b.b))continue;
  for(const w of [a,b])for(const end of ['a','b'])if(dist(w[end],p)<=tol)patches.push({w,end,p,d:dist(w[end],p)});
 }
 patches.sort((a,b)=>a.d-b.d);const done=new Set();for(const x of patches){const k=x.w.id+':'+x.end;if(!done.has(k)){x.w[x.end]={...x.p};done.add(k);}}return walls;
}
function possibleOpenings(walls,scale){const out=[];if(!finite(scale)||scale<=0)return out;
 for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
  const a=walls[i],b=walls[j];if(!parallel(a,b)||lineDistance(a,b)>3||Math.abs(a.thickness-b.thickness)>Math.max(4,a.thickness*.3))continue;
  const vertical=Math.abs(a.b.y-a.a.y)>Math.abs(a.b.x-a.a.x),key=vertical?'y':'x',aa=[a.a,a.b].sort((p,q)=>p[key]-q[key]),bb=[b.a,b.b].sort((p,q)=>p[key]-q[key]);let p,q;
  if(aa[1][key]<bb[0][key]){p=aa[1];q=bb[0];}else if(bb[1][key]<aa[0][key]){p=bb[1];q=aa[0];}else continue;
  const gap=dist(p,q)*scale;if(gap<.5||gap>2.4)continue;out.push({id:'opening-'+i+'-'+j,kind:'opening',type:'door',accepted:false,a:{...p},b:{...q},thickness:(a.thickness+b.thickness)/2,method:'gap-hypothesis'});
 }return out.slice(0,100);}
function toElements(candidates,settings={}){
 const {scale,levelId,height=2.8,origin={x:0,y:0},pixelOrigin={x:0,y:0},source='document'}=settings;
 if(!finite(scale)||scale<=0||!levelId||!finite(height)||height<=0||!point(origin)||!point(pixelOrigin))throw Error('Échelle, niveau, origine ou hauteur manquants.');
 const idPrefix=settings.idPrefix||'import-'+Date.now().toString(36),out=[],wp=p=>({x:origin.x+(p.x-pixelOrigin.x)*scale,y:origin.y+(p.y-pixelOrigin.y)*scale});
 for(const [i,c] of candidates.entries()){
  if(!c.accepted)continue;if(!point(c.a)||!point(c.b)||dist(c.a,c.b)*scale<.05)throw Error('Un tracé sélectionné est invalide ou trop court.');
  const a=wp(c.a),b=wp(c.b),thickness=Number(c.thickness)*scale;if(!finite(thickness)||thickness<=0||thickness>3)throw Error('Épaisseur invalide : corrigez la proposition ou l’échelle.');
  const common={id:idPrefix+'-'+i,mode:'construction',levelId,designStatus:'unverified-import',importSource:String(source).slice(0,150)};
  if(c.kind==='opening')out.push({...common,type:c.type==='window'?'window':'door',x:(a.x+b.x)/2,y:(a.y+b.y)/2,width:dist(a,b),depth:thickness,height:c.type==='window'?1.25:2.04,rotation:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI});
  else out.push({...common,type:['partition','wallExterior','wallBearing'].includes(c.type)?c.type:'partition',a,b,thickness,height});
 }
 return out;
}
function deduplicate(elements,existing){const seen=[...existing],out=[];for(const e of elements){const same=seen.some(q=>q.levelId===e.levelId&&q.type===e.type&&(e.a&&q.a?((dist(e.a,q.a)<.003&&dist(e.b,q.b)<.003)||(dist(e.a,q.b)<.003&&dist(e.b,q.a)<.003)):!e.a&&!q.a&&Math.hypot(e.x-q.x,e.y-q.y)<.003));if(!same){seen.push(e);out.push(e);}}return out;}
const api={recognize,scaleFrom,snapEnds,possibleOpenings,toElements,deduplicate};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.PBPPlanImport=api;
})(typeof window!=='undefined'?window:globalThis);
