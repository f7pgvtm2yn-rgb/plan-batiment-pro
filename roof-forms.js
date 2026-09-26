/* v0.14.2 — independent roof form geometry; hips and mono-pitches are NOT sized structures. */
(function(root){
'use strict';
const finite=Number.isFinite,clone=x=>JSON.parse(JSON.stringify(x));
function settings(s){const pans=[1,2,4].includes(Number(s.pans))?Number(s.pans):2,rotation=s.rotation===undefined?(s.invert?90:0):Number(s.rotation);return{pans,rotation:[0,90,180,270].includes(rotation)?rotation:0};}
function clip(poly,a,b,c){const out=[];if(!poly.length)return out;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=a*p.x+b*p.y+c,dq=a*q.x+b*q.y+c,ip=dp<=1e-8,iq=dq<=1e-8;if(ip)out.push(p);if(ip!==iq){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}return out.filter((p,i,ar)=>!i||Math.hypot(p.x-ar[i-1].x,p.y-ar[i-1].y)>1e-8);}
function normalizeOverhang(over){
 const n=x=>finite(Number(x))&&Number(x)>=0?Number(x):0;
 if(finite(Number(over)))return{west:n(over),east:n(over),south:n(over),north:n(over)};
 over=over&&typeof over==='object'?over:{};return{west:n(over.west),east:n(over.east),south:n(over.south),north:n(over.north)};
}
function forms(L,W,pitch,pans=2,over=0){
 const ov=normalizeOverhang(over);
 if(![L,W,pitch].every(finite)||L<=0||W<=0||pitch<=0||pitch>=Math.PI/2)throw Error('Géométrie de toiture invalide.');
 const t=Math.tan(pitch),rise=(pans===1?W:W/2)*t,hipRun=Math.min(W/2,L*.4),te=rise/hipRun;
 let planes=[{name:'Pan unique',a:0,b:t,c:0,side:'south'}];
 if(pans>=2)planes=[{name:'Pan A',a:0,b:t,c:0,side:'south'},{name:'Pan B',a:0,b:-t,c:W*t,side:'north'}];
 if(pans===4)planes.push({name:'Croupe C',a:te,b:0,c:0,side:'west'},{name:'Croupe D',a:-te,b:0,c:L*te,side:'east'});
 const rect=[{x:-ov.west,y:-ov.south},{x:L+ov.east,y:-ov.south},{x:L+ov.east,y:W+ov.north},{x:-ov.west,y:W+ov.north}];
 const surfaces=planes.map((p,i)=>{let poly=rect.map(p=>({...p}));for(let j=0;j<planes.length;j++)if(j!==i){const q=planes[j];poly=clip(poly,p.a-q.a,p.b-q.b,p.c-q.c);}return{...p,vertices:poly.map(q=>({...q,z:p.a*q.x+p.b*q.y+p.c}))};});
 return{surfaces,rise,hipPitch:pans===4?Math.atan(te)*180/Math.PI:null};
}
function crossSection(poly,axis,value){const other=axis==='x'?'y':'x',out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(Math.abs(a[axis]-value)<1e-8)out.push(a[other],b[other]);continue;}const t=(value-a[axis])/d;if(t>=-1e-8&&t<=1+1e-8)out.push(a[other]+(b[other]-a[other])*t);}return out.length?[Math.min(...out),Math.max(...out)]:null;}
function edge(a,b){return{a,b};}
function zoneCorners(z,Z){const p=z.p,u=z.u,v=z.v,L=z.ridgeLength,W=z.cross;return[p,Z.add(p,Z.mul(u,L)),Z.add(Z.add(p,Z.mul(u,L)),Z.mul(v,W)),Z.add(p,Z.mul(v,W))];}
function overlapCollinear(a,b,c,d,Z){
 const ab=Z.sub(b,a),cd=Z.sub(d,c),Lab=Math.hypot(ab.x,ab.y),Lcd=Math.hypot(cd.x,cd.y);if(Lab<1e-8||Lcd<1e-8)return 0;
 if(Math.abs(Z.cross(ab,cd))>1e-6*Lab*Lcd)return 0;
 if(Math.abs(Z.cross(Z.sub(c,a),ab))/Lab>.006||Math.abs(Z.cross(Z.sub(d,a),ab))/Lab>.006)return 0;
 const u=Z.mul(ab,1/Lab),x1=Z.dot(Z.sub(c,a),u),x2=Z.dot(Z.sub(d,a),u);
 return Math.max(0,Math.min(Lab,Math.max(x1,x2))-Math.max(0,Math.min(x1,x2)));
}
function exposedOverhang(z,index,zones,amount,Z){
 const cs=zoneCorners(z,Z),edges=[edge(cs[0],cs[3]),edge(cs[1],cs[2]),edge(cs[0],cs[1]),edge(cs[3],cs[2])],names=['west','east','south','north'],out={west:amount,east:amount,south:amount,north:amount};
 for(let e=0;e<edges.length;e++)for(let j=0;j<zones.length;j++){if(j===index)continue;const other=zoneCorners(zones[j],Z);for(const oe of [edge(other[0],other[3]),edge(other[1],other[2]),edge(other[0],other[1]),edge(other[3],other[2])])if(overlapCollinear(edges[e].a,edges[e].b,oe.a,oe.b,Z)>.02){out[names[e]]=0;break;}if(out[names[e]]===0)break;}
 return out;
}
function localPoint(p,z,Z){const d=Z.sub(p,z.p);return{x:Z.dot(d,z.u),y:Z.dot(d,z.v)};}
function roofHeight(form,x,y){return Math.min(...form.surfaces.map(p=>p.a*x+p.b*y+p.c));}
function clipSegmentRect(a,b,L,W){
 let t0=0,t1=1,dx=b.x-a.x,dy=b.y-a.y;
 const tests=[[-dx,a.x],[dx,L-a.x],[-dy,a.y],[dy,W-a.y]];
 for(const [p,q] of tests){if(Math.abs(p)<1e-12){if(q<0)return null;continue;}const r=q/p;if(p<0){if(r>t1)return null;if(r>t0)t0=r;}else{if(r<t0)return null;if(r<t1)t1=r;}}
 return{a:{x:a.x+dx*t0,y:a.y+dy*t0},b:{x:a.x+dx*t1,y:a.y+dy*t1},t0,t1};
}
function profileIntervals(form,a,b,bottom){
 const dx=b.x-a.x,dy=b.y-a.y,ts=[0,1];
 for(let i=0;i<form.surfaces.length;i++)for(let j=i+1;j<form.surfaces.length;j++){
  const p=form.surfaces[i],q=form.surfaces[j],A=(p.a-q.a)*dx+(p.b-q.b)*dy,B=(p.a-q.a)*a.x+(p.b-q.b)*a.y+(p.c-q.c);
  if(Math.abs(A)>1e-12){const t=-B/A;if(t>1e-8&&t<1-1e-8)ts.push(t);}
 }
 ts.sort((x,y)=>x-y);const uniq=ts.filter((t,i)=>!i||Math.abs(t-ts[i-1])>1e-8),out=[];
 for(let i=0;i<uniq.length-1;i++){const ta=uniq[i],tb=uniq[i+1],pa={x:a.x+dx*ta,y:a.y+dy*ta},pb={x:a.x+dx*tb,y:a.y+dy*tb},za=roofHeight(form,pa.x,pa.y),zb=roofHeight(form,pb.x,pb.y);if(Math.max(za,zb)>bottom+1e-6)out.push({a:pa,b:pb,za,zb});}
 return out;
}
function wallExtensions(m,z,form,zi,s,common,Z){
 if(s.extendWalls===false||!z.face?.sides)return[];
 const level=m.levels.find(l=>l.id===s.supportLevelId),out=[],seen=new Set(),L=z.ridgeLength,W=z.cross;
 for(const side of z.face.sides||[])for(const w of side.members||[]){
  if(w.type!=='wallExterior'||!w.a||!w.b||seen.has(w.id))continue;
  const la=localPoint(w.a,z,Z),lb=localPoint(w.b,z,Z),cut=clipSegmentRect(la,lb,L,W);if(!cut)continue;
  const wa={x:w.a.x+(w.b.x-w.a.x)*cut.t0,y:w.a.y+(w.b.y-w.a.y)*cut.t0},wb={x:w.a.x+(w.b.x-w.a.x)*cut.t1,y:w.a.y+(w.b.y-w.a.y)*cut.t1};
  const baseZ=(finite(Number(w.zBase))?Number(w.zBase):Number(level?.elevation)||0)+Number(w.height||0),bottom=baseZ-z.eaveZ;
  const parts=profileIntervals(form,cut.a,cut.b,bottom);
  let n=0;for(const p of parts){
   const span=Math.hypot(cut.b.x-cut.a.x,cut.b.y-cut.a.y)||1,tA=Math.hypot(p.a.x-cut.a.x,p.a.y-cut.a.y)/span,tB=Math.hypot(p.b.x-cut.a.x,p.b.y-cut.a.y)/span;
   const a={x:wa.x+(wb.x-wa.x)*tA,y:wa.y+(wb.y-wa.y)*tA},b={x:wa.x+(wb.x-wa.x)*tB,y:wa.y+(wb.y-wa.y)*tB};
   const topA=z.eaveZ+p.za,topB=z.eaveZ+p.zb;if(Math.max(topA,topB)<=baseZ+1e-6)continue;
   out.push({...common,id:R.TAG+':'+s.id+':wall-ext:'+zi+':'+w.id+':'+n++,type:'roofWallExtension',role:'roofWallExtension',sourceWallId:w.id,a,b,bottomA:baseZ,bottomB:baseZ,topA:Math.max(baseZ,topA),topB:Math.max(baseZ,topB),thickness:Number(w.thickness)||.2,materialSpec:w.materialSpec||null,wallType:w.type,designStatus:'geometry-linked'});
  }
  if(parts.length)seen.add(w.id);
 }
 return out;
}
function reportGroup(m,input,G,S,R){
 const f=settings(input),C=root.PBPCoverage,Z=root.PBPSpaces,s={...input,...f},out=C.roofGroupReport(m,{...s,_skipForms:true,invert:f.rotation%180===90},G,S,R);out.settings=s;
 if(!out.geometry)return out;
 const special=f.pans!==2,common={generator:R.TAG,mode:'construction',levelId:out.elements[0]?.levelId||m.levels.find(l=>l.id==='roof')?.id||s.supportLevelId,locked:true,roofGroupId:s.id,sourceLevelId:s.supportLevelId,designStatus:'geometry-only'};
 if(special){out.section=null;out.complete=false;out.count=0;out.checks=[];out.elements=[];out.issues=out.issues.filter(i=>!i.text.startsWith('Aucune section d’essai')&&(f.pans!==1||!i.text.startsWith('Faîtage représenté')));out.issues.push({severity:'warning',text:f.pans===1?'Monopente : appui haut et reprise des efforts à définir. Géométrie proposée, sans dimensionnement du nouveau système.':'Quatre pans : arêtiers, empannons, assemblages et reprises de charge non dimensionnés. Tracé de principe uniquement.'});}
 out.form={...f,hipPitches:[],trimmedInternalEdges:0};
 const oriented=out.geometry.zones.map(base=>{const z={...base,p:{...base.p},u:{...base.u},v:{...base.v}},L=z.ridgeLength,W=z.cross;if(f.rotation>=180){z.p=Z.add(z.p,Z.add(Z.mul(z.u,L),Z.mul(z.v,W)));z.u=Z.mul(z.u,-1);z.v=Z.mul(z.v,-1);}return z;});
 oriented.forEach((z,zi)=>{
  const L=z.ridgeLength,W=z.cross,ov=exposedOverhang(z,zi,oriented,s.overhang,Z);out.form.trimmedInternalEdges+=Object.values(ov).filter(x=>x===0&&s.overhang>0).length;
  const wp=p=>({...Z.add(z.p,Z.add(Z.mul(z.u,p.x),Z.mul(z.v,p.y))),z:z.eaveZ+p.z}),form=forms(L,W,s.slopeDeg*Math.PI/180,f.pans,ov);out.form.hipPitches.push(form.hipPitch);
  const seams=new Map();
  for(const [si,p] of form.surfaces.entries()){
   const coverOffset=(out.section?.h||s.h)/2000*Math.max(...form.surfaces.map(q=>Math.sqrt(1+q.a*q.a+q.b*q.b)))+.005;
   const vertices=p.vertices.map(q=>wp({...q,z:q.z+coverOffset}));out.elements.push({...common,id:R.TAG+':'+s.id+':surface:'+zi+':'+si,type:'roofSurface',role:'roofCover',vertices,height:.035,panIndex:si,panCount:f.pans});
   if(special){const axis=['south','north'].includes(p.side)?'x':'y',xs=p.vertices.map(x=>x[axis]),lo=Math.min(...xs),hi=Math.max(...xs),n=Math.max(1,Math.ceil((hi-lo)/s.rafterSpacing));
    for(let k=0;k<=n;k++){const value=lo+(hi-lo)*k/n,cut=crossSection(p.vertices,axis,value);if(!cut||cut[1]-cut[0]<.08)continue;const xy=x=>axis==='x'?{x:value,y:x}:{x,y:value},a=xy(cut[0]),b=xy(cut[1]);a.z=p.a*a.x+p.b*a.y+p.c;b.z=p.a*b.x+p.b*b.y+p.c;out.elements.push({...common,id:R.TAG+':'+s.id+':form:'+zi+':'+si+':'+k,type:'slopedBeam',role:'rafters',a:wp(a),b:wp(b),width:s.b/1000,height:s.h/1000});out.count++;}
   }
   for(let k=0;k<p.vertices.length;k++){const a=p.vertices[k],b=p.vertices[(k+1)%p.vertices.length],key=[a,b].map(v=>[v.x,v.y,v.z].map(x=>x.toFixed(6)).join(',')).sort().join('|');if(!seams.has(key))seams.set(key,{a,b,count:0});seams.get(key).count++;}
  }
  if(special)for(const [k,x] of [...seams.values()].filter(x=>x.count>1).entries())out.elements.push({...common,id:R.TAG+':'+s.id+':seam:'+zi+':'+k,type:'slopedBeam',role:Math.abs(x.a.z-x.b.z)<1e-6?'ridge':'hip',a:wp(x.a),b:wp(x.b),width:.025,height:.025,visualGuide:true,designStatus:'guide-non-porteur'});
  const ext=wallExtensions(m,z,form,zi,s,common,Z);out.elements.push(...ext);out.form.wallExtensions=(out.form.wallExtensions||0)+ext.length;
 });
 out.geometryComplete=true;out.validForConstruction=false;return out;
}
const api={settings,clip,normalizeOverhang,forms,overlapCollinear,exposedOverhang,roofHeight,clipSegmentRect,profileIntervals,reportGroup};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root){root.PBPRoofForms=api;root.PBPRoofFormsReady=true;}
})(typeof window!=='undefined'?window:globalThis);
