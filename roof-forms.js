/* v0.14.0 — independent roof form geometry; hips and mono-pitches are NOT sized structures. */
(function(root){
'use strict';
const finite=Number.isFinite,clone=x=>JSON.parse(JSON.stringify(x));
function settings(s){const pans=[1,2,4].includes(Number(s.pans))?Number(s.pans):2,rotation=s.rotation===undefined?(s.invert?90:0):Number(s.rotation);return{pans,rotation:[0,90,180,270].includes(rotation)?rotation:0};}
function clip(poly,a,b,c){const out=[];if(!poly.length)return out;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=a*p.x+b*p.y+c,dq=a*q.x+b*q.y+c,ip=dp<=1e-8,iq=dq<=1e-8;if(ip)out.push(p);if(ip!==iq){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}return out.filter((p,i,ar)=>!i||Math.hypot(p.x-ar[i-1].x,p.y-ar[i-1].y)>1e-8);}
function forms(L,W,pitch,pans=2,over=0){
 if(![L,W,pitch,over].every(finite)||L<=0||W<=0||pitch<=0||pitch>=Math.PI/2||over<0)throw Error('Géométrie de toiture invalide.');
 const t=Math.tan(pitch),rise=(pans===1?W:W/2)*t,hipRun=Math.min(W/2,L*.4),te=rise/hipRun;
 let planes=[{name:'Pan unique',a:0,b:t,c:0,side:'south'}];
 if(pans>=2)planes=[{name:'Pan A',a:0,b:t,c:0,side:'south'},{name:'Pan B',a:0,b:-t,c:W*t,side:'north'}];
 if(pans===4)planes.push({name:'Croupe C',a:te,b:0,c:0,side:'west'},{name:'Croupe D',a:-te,b:0,c:L*te,side:'east'});
 const rect=[{x:-over,y:-over},{x:L+over,y:-over},{x:L+over,y:W+over},{x:-over,y:W+over}];
 const surfaces=planes.map((p,i)=>{let poly=rect.map(p=>({...p}));for(let j=0;j<planes.length;j++)if(j!==i){const q=planes[j];poly=clip(poly,p.a-q.a,p.b-q.b,p.c-q.c);}return{...p,vertices:poly.map(q=>({...q,z:p.a*q.x+p.b*q.y+p.c}))};});
 return{surfaces,rise,hipPitch:pans===4?Math.atan(te)*180/Math.PI:null};
}
function crossSection(poly,axis,value){const other=axis==='x'?'y':'x',out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],d=b[axis]-a[axis];if(Math.abs(d)<1e-9){if(Math.abs(a[axis]-value)<1e-8)out.push(a[other],b[other]);continue;}const t=(value-a[axis])/d;if(t>=-1e-8&&t<=1+1e-8)out.push(a[other]+(b[other]-a[other])*t);}return out.length?[Math.min(...out),Math.max(...out)]:null;}
function reportGroup(m,input,G,S,R){
 const f=settings(input),C=root.PBPCoverage,Z=root.PBPSpaces,s={...input,...f},out=C.roofGroupReport(m,{...s,_skipForms:true,invert:f.rotation%180===90},G,S,R);out.settings=s;
 if(!out.geometry)return out;
 const special=f.pans!==2,common={generator:R.TAG,mode:'construction',levelId:out.elements[0]?.levelId||m.levels.find(l=>l.id==='roof')?.id||s.supportLevelId,locked:true,roofGroupId:s.id,sourceLevelId:s.supportLevelId,designStatus:'geometry-only'};
 if(special){out.section=null;out.complete=false;out.count=0;out.checks=[];out.elements=[];out.issues=out.issues.filter(i=>!i.text.startsWith('Aucune section d’essai')&&(f.pans!==1||!i.text.startsWith('Faîtage représenté')));out.issues.push({severity:'warning',text:f.pans===1?'Monopente : appui haut et reprise des efforts à définir. Géométrie proposée, sans dimensionnement du nouveau système.':'Quatre pans : arêtiers, empannons, assemblages et reprises de charge non dimensionnés. Tracé de principe uniquement.'});}
 out.form={...f,hipPitches:[]};
 out.geometry.zones.forEach((base,zi)=>{
  const z={...base,p:{...base.p},u:{...base.u},v:{...base.v}},L=z.ridgeLength,W=z.cross;
  if(f.rotation>=180){z.p=Z.add(z.p,Z.add(Z.mul(z.u,L),Z.mul(z.v,W)));z.u=Z.mul(z.u,-1);z.v=Z.mul(z.v,-1);}
  const wp=p=>({...Z.add(z.p,Z.add(Z.mul(z.u,p.x),Z.mul(z.v,p.y))),z:z.eaveZ+p.z}),form=forms(L,W,s.slopeDeg*Math.PI/180,f.pans,s.overhang);out.form.hipPitches.push(form.hipPitch);
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
 });
 out.geometryComplete=true;out.validForConstruction=false;return out;
}
const api={settings,clip,forms,reportGroup};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root){root.PBPRoofForms=api;root.PBPRoofFormsReady=true;}
})(typeof window!=='undefined'?window:globalThis);
