/* v0.10.7 — automatic architectural dimension chains for plan view.
   Display aid only: permit/execution completeness still depends on the project documents. */
(function(root){
'use strict';
const app=root.planApp,R=root.PlanRenderer2D,G=root.PBPGeometry,S=root.PBPStructure,D=root.PBPDrawing,$=s=>document.querySelector(s);
if(!app||!R||!G||!S||!D)throw Error('Cotation architecte : modules requis absents.');
const pt=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),mul=(a,t)=>({x:a.x*t,y:a.y*t}),dot=(a,b)=>a.x*b.x+a.y*b.y;
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function current(){return D.getSettings?D.getSettings():D.settings(app.model.drawingDisplay);}
function wallDir(w){const L=dist(w.a,w.b)||1;return {u:{x:(w.b.x-w.a.x)/L,y:(w.b.y-w.a.y)/L},n:{x:-(w.b.y-w.a.y)/L,y:(w.b.x-w.a.x)/L},L};}
function exterior(){return (app.model.elements||[]).filter(e=>e.mode==='construction'&&!e.generator&&e.levelId===app.model.activeLevelId&&e.type==='wallExterior'&&pt(e.a)&&pt(e.b)&&dist(e.a,e.b)>.05);}
function activeWalls(){return (app.model.elements||[]).filter(e=>e.mode==='construction'&&!e.generator&&e.levelId===app.model.activeLevelId&&['wallExterior','wallBearing','partition'].includes(e.type)&&pt(e.a)&&pt(e.b)&&dist(e.a,e.b)>.05);}
function fmt(v,s=current()){return D.label(v,s.unit);}
function centerOf(ws){const pts=ws.flatMap(w=>[w.a,w.b]);return pts.length?{x:pts.reduce((n,p)=>n+p.x,0)/pts.length,y:pts.reduce((n,p)=>n+p.y,0)/pts.length}:{x:0,y:0};}
function sideThickness(side){const xs=(side?.members||[]).map(w=>Number(w.thickness)).filter(x=>Number.isFinite(x)&&x>0);return xs.length?Math.min(...xs):0;}
function overall(ws){
 if(!ws.length)return[];const long=ws.slice().sort((a,b)=>dist(b.a,b.b)-dist(a.a,a.b))[0],{u}=wallDir(long),v={x:-u.y,y:u.x};
 let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
 for(const w of ws){const d=wallDir(w),h=(Number(w.thickness)||0)/2,du=h*Math.abs(dot(d.n,u)),dv=h*Math.abs(dot(d.n,v));for(const p of [w.a,w.b]){const pu=dot(p,u),pv=dot(p,v);minU=Math.min(minU,pu-du);maxU=Math.max(maxU,pu+du);minV=Math.min(minV,pv-dv);maxV=Math.max(maxV,pv+dv);}}
 const wp=(a,b)=>add(mul(u,a),mul(v,b));
 return [
  {kind:'overall',a:wp(minU,minV),b:wp(maxU,minV),length:maxU-minU,offset:36},
  {kind:'overall',a:wp(maxU,minV),b:wp(maxU,maxV),length:maxV-minV,offset:36}
 ];
}
function nearestOpenings(w){
 const {u,L}=wallDir(w),tol=Math.max(.35,(Number(w.thickness)||0)/2+.18),out=[];
 for(const e of app.model.elements||[]){if(e.mode!=='construction'||e.levelId!==w.levelId||!['door','window'].includes(e.type)||!Number.isFinite(e.x)||!Number.isFinite(e.y)||!(Number(e.width)>0))continue;
  const p={x:e.x,y:e.y},t=dot(sub(p,w.a),u),q=add(w.a,mul(u,t)),d=dist(p,q);if(d>tol||t<-.05||t>L+.05)continue;
  const half=Number(e.width)/2,outA=Math.max(0,t-half),outB=Math.min(L,t+half);if(outB-outA>.05)out.push({e,start:outA,end:outB});
 }
 return out.sort((a,b)=>a.start-b.start);
}
function facadeChains(ws,s){
 const rows=[];if(!s.dimFacades)return rows;const c=centerOf(ws);
 for(const w of ws){const {u,L}=wallDir(w),m=mid(w.a,w.b),n=wallDir(w).n,sign=dot(sub(m,c),n)>=0?1:-1,marks=[0,L];
  if(s.dimOpenings)for(const o of nearestOpenings(w))marks.push(o.start,o.end);
  const uniq=[...new Set(marks.map(x=>+x.toFixed(5)))].sort((a,b)=>a-b);
  for(let i=0;i<uniq.length-1;i++){const a=uniq[i],b=uniq[i+1],len=b-a;if(len<.12)continue;rows.push({kind:'facade',a:add(w.a,mul(u,a)),b:add(w.a,mul(u,b)),length:len,offset:54*sign,wallId:w.id});}
 }
 return rows;
}
function roomRows(s){
 if(!s.dimRooms||!['architect','execution'].includes(s.profile))return[];
 const pseudo={isSupport:e=>e&&e.mode==='construction'&&!e.generator&&e.levelId===app.model.activeLevelId&&['wallExterior','wallBearing','partition'].includes(e.type)&&pt(e.a)&&pt(e.b)&&dist(e.a,e.b)>.05};
 let faces=[];try{faces=G.faces(app.model,app.model.activeLevelId,pseudo).faces||[];}catch{return[];}
 const out=[];
 for(const f of faces){if(!f.rectangle||Math.abs(f.area)<1.5||f.points.length!==4)continue;
  const mids=f.sides.map(x=>mid(x.a,x.b)),pairs=[[0,2],[1,3]];
  for(const [i,j] of pairs){let a=mids[i],b=mids[j],L=dist(a,b);if(L<.6)continue;const u={x:(b.x-a.x)/L,y:(b.y-a.y)/L},ti=sideThickness(f.sides[i]),tj=sideThickness(f.sides[j]);a=add(a,mul(u,ti/2));b=add(b,mul(u,-tj/2));L=dist(a,b);if(L>.5)out.push({kind:'room',a,b,length:L,offset:0});}
 }
 return out;
}
function thicknessRows(s){
 if(s.profile!=='execution'||!s.dimThickness)return[];return activeWalls().filter(w=>dist(w.a,w.b)>1&&Number(w.thickness)>.02).map(w=>({kind:'thickness',p:mid(w.a,w.b),text:'e = '+fmt(Number(w.thickness),s),wallId:w.id}));
}
function descriptors(s=current()){
 if(!s.dimensions||s.profile==='simple')return[];
 const ws=exterior(),rows=[];if(s.dimOverall)rows.push(...overall(ws));
 if(s.profile!=='permit'||s.dimFacades)rows.push(...facadeChains(ws,s));
 rows.push(...roomRows(s),...thicknessRows(s));return rows;
}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function drawLine(r,row,occupied){
 const A=r.worldToScreen(row.a),B=r.worldToScreen(row.b),dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy);if(L<14)return;
 const u={x:dx/L,y:dy/L},n={x:-u.y,y:u.x},center={x:r.width/2,y:r.height/2},m={x:(A.x+B.x)/2,y:(A.y+B.y)/2};
 let off=row.offset||0;if(row.kind==='overall'&&off){const outward=((m.x-center.x)*n.x+(m.y-center.y)*n.y)>=0?1:-1;off=Math.abs(off)*outward;}
 const P={x:A.x+n.x*off,y:A.y+n.y*off},Q={x:B.x+n.x*off,y:B.y+n.y*off},M={x:(P.x+Q.x)/2,y:(P.y+Q.y)/2},text=fmt(row.length),c=r.ctx;
 c.font=row.kind==='overall'?'600 11px system-ui':'11px system-ui';let angle=Math.atan2(u.y,u.x);if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;
 const tw=c.measureText(text).width+10,th=18,bw=Math.abs(Math.cos(angle))*tw+Math.abs(Math.sin(angle))*th,bh=Math.abs(Math.sin(angle))*tw+Math.abs(Math.cos(angle))*th,rect={x:M.x-bw/2-2,y:M.y-bh/2-2,w:bw+4,h:bh+4};
 if(rect.x<4||rect.y<4||rect.x+rect.w>r.width-4||rect.y+rect.h>r.height-4||occupied.some(o=>overlap(rect,o)))return;occupied.push(rect);
 c.save();c.strokeStyle=row.kind==='overall'?'#173f56':row.kind==='room'?'#6a6f73':'#4c7180';c.fillStyle=c.strokeStyle;c.lineWidth=row.kind==='overall'?1.25:1;
 c.beginPath();if(off){c.moveTo(A.x,A.y);c.lineTo(P.x+n.x*Math.sign(off)*5,P.y+n.y*Math.sign(off)*5);c.moveTo(B.x,B.y);c.lineTo(Q.x+n.x*Math.sign(off)*5,Q.y+n.y*Math.sign(off)*5);}c.moveTo(P.x,P.y);c.lineTo(Q.x,Q.y);
 for(const e of [P,Q]){const tx=(u.x+n.x)*3.5,ty=(u.y+n.y)*3.5;c.moveTo(e.x-tx,e.y-ty);c.lineTo(e.x+tx,e.y+ty);}c.stroke();
 c.translate(M.x,M.y);c.rotate(angle);c.fillStyle='rgba(255,255,255,.95)';c.fillRect(-tw/2,-th/2,tw,th);c.fillStyle=row.kind==='overall'?'#173f56':'#355b6b';c.textAlign='center';c.textBaseline='middle';c.fillText(text,0,0);c.restore();
}
function drawArchitect(r){
 const s=current();if(app.viewMode==='3d'||!s.dimensions||s.profile==='simple')return;const rows=descriptors(s),occupied=[],vr=r.canvas.getBoundingClientRect();
 for(const target of document.querySelectorAll('#propertiesPanel:not(.hidden),#view2d .pane-label')){const q=target.getBoundingClientRect();if(q.width&&q.height)occupied.push({x:q.left-vr.left-4,y:q.top-vr.top-4,w:q.width+8,h:q.height+8});}
 const c=r.ctx;c.save();
 for(const row of rows){if(row.kind==='thickness'){const p=r.worldToScreen(row.p);c.font='10px system-ui';const tw=c.measureText(row.text).width+8,rect={x:p.x-tw/2,y:p.y-24,w:tw,h:16};if(occupied.some(o=>overlap(rect,o)))continue;occupied.push(rect);c.fillStyle='rgba(255,255,255,.9)';c.fillRect(rect.x,rect.y,rect.w,rect.h);c.fillStyle='#704f2a';c.textAlign='center';c.textBaseline='middle';c.fillText(row.text,p.x,p.y-16);continue;}drawLine(r,row,occupied);}
 c.restore();
}
const oldDraw=R.prototype.draw;R.prototype.draw=function(...args){const out=oldDraw.apply(this,args);drawArchitect(this);return out;};
root.PBPArchitectDimensions={descriptors,overall,facadeChains,roomRows,getSettings:current};root.PBPArchitectDimensionsReady=true;
})(typeof window!=='undefined'?window:globalThis);