/* v0.15.1 — geometric assistance only; never a structural verification. */
(function(root){'use strict';
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),mul=(v,t)=>({x:v.x*t,y:v.y*t}),dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),unit=v=>{const l=Math.hypot(v.x,v.y);return l>1e-9?mul(v,1/l):null;};
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const TYPES=new Set(['wallExterior','wallBearing','partition','foundation','beam','column']);
function references(elements,active,levels,exclude=[]){const skip=new Set(exclude),allowed=new Set(levels),points=[],lines=[];for(const e of elements){if(e.mode!=='construction'||!TYPES.has(e.type)||(e.levelId!==active&&!allowed.has(e.levelId)))continue;if(e.levelId!==active&&e.type==='partition')continue;
 const meta={id:e.id,levelId:e.levelId,reference:e.levelId!==active};
 if(point(e.a)&&point(e.b)){for(const k of ['a','b'])if(!skip.has(e.id+':'+k))points.push({...meta,p:{...e[k]},end:k});if(!skip.has(e.id+':a')&&!skip.has(e.id+':b'))lines.push({...meta,a:e.a,b:e.b});}
 else if(e.type==='column'&&Number.isFinite(e.x)&&Number.isFinite(e.y))points.push({...meta,p:{x:e.x,y:e.y},end:'center'});
 }return{points,lines};}
function snap(p,refs,{start=null,tolerance=.16,enabled=true,perpendicular=[]}={}){const result={point:{...p},guides:[],label:'',references:[]};if(!enabled||!point(p))return result;const tol=Math.max(.000001,tolerance),near=[];
 for(const t of refs.points){const d=dist(p,t.p);if(d<=tol)near.push({d,t});}near.sort((a,b)=>a.d-b.d||Number(a.t.reference)-Number(b.t.reference));
 if(near.length){const t=near[0].t;return{point:{...t.p},guides:[{a:t.p,b:t.p}],label:t.end==='center'?'Centre de poteau':'Extrémité',references:[t.levelId]};}
 const lines=[];
 function line(a,u,label,levelId=null,finite=false){const v=unit(u);if(!v)return;const t=dot(sub(p,a),v),q=add(a,mul(v,t)),d=dist(p,q);if(d<=tol&&(!finite||(t>=0&&t<=Math.hypot(u.x,u.y))))lines.push({a,u:v,q,d,label,levelId});}
 if(point(start)){line(start,{x:1,y:0},'90° · horizontal');line(start,{x:0,y:1},'90° · vertical');for(const u of perpendicular)line(start,{x:-u.y,y:u.x},'90° · perpendiculaire');}
 for(const t of refs.points){if(point(start)&&dist(t.p,start)<1e-8)continue;line(t.p,{x:1,y:0},'Extrémités alignées',t.levelId);line(t.p,{x:0,y:1},'Extrémités alignées',t.levelId);}
 for(const t of refs.lines)line(t.a,sub(t.b,t.a),'Axe de structure',t.levelId,true);
 lines.sort((a,b)=>a.d-b.d);const shortlist=lines.slice(0,24);let best=null;
 for(let i=0;i<shortlist.length;i++)for(let j=i+1;j<shortlist.length;j++){const a=shortlist[i],b=shortlist[j],c=cross(a.u,b.u);if(Math.abs(c)<.08)continue;const q=add(a.a,mul(a.u,cross(sub(b.a,a.a),b.u)/c)),d=dist(p,q);if(d<=tol*1.4&&(!best||d<best.d))best={q,d,lines:[a,b]};}
 const chosen=best?best.lines:shortlist.slice(0,1);if(!chosen.length)return result;const q=best?best.q:chosen[0].q;
 return{point:q,guides:chosen.map(l=>({a:l.a,b:q})),label:[...new Set(chosen.map(l=>l.label))].join(' · '),references:[...new Set(chosen.map(l=>l.levelId).filter(Boolean))]};}
function area(ps){return ps.reduce((n,p,i)=>n+cross(p,ps[(i+1)%ps.length]),0)/2;}
function triangulate(polygon){let ps=polygon.filter((p,i,a)=>!i||dist(p,a[i-1])>1e-9);if(ps.length>2&&dist(ps[0],ps.at(-1))<1e-9)ps=ps.slice(0,-1);if(area(ps)<0)ps=ps.slice().reverse();const ids=ps.map((_,i)=>i),tris=[];let guard=0;
 const inTri=(p,a,b,c)=>cross(sub(b,a),sub(p,a))>=-1e-9&&cross(sub(c,b),sub(p,b))>=-1e-9&&cross(sub(a,c),sub(p,c))>=-1e-9;
 while(ids.length>3&&guard++<ps.length*ps.length){let found=false;for(let j=0;j<ids.length;j++){const a=ps[ids[(j+ids.length-1)%ids.length]],b=ps[ids[j]],c=ps[ids[(j+1)%ids.length]];if(cross(sub(b,a),sub(c,b))<=1e-10)continue;if(ids.some(k=>ps[k]!==a&&ps[k]!==b&&ps[k]!==c&&inTri(ps[k],a,b,c)))continue;tris.push([a,b,c]);ids.splice(j,1);found=true;break;}if(!found)break;}
 if(ids.length===3)tris.push(ids.map(i=>ps[i]));return tris;}
// True mitres replace the old arbitrary extension of both wall ends. Only
// equal vertical intervals are joined: a real height difference is not hidden.
function footprints(elements,levels){const ls=new Map(levels.map(l=>[l.id,l])),parts=[];
 for(const e of elements){if(e.mode!=='construction'||!e.a||!e.b||!['wallExterior','wallBearing','partition','foundation','beam'].includes(e.type)||!point(e.a)||!point(e.b))continue;const u=unit(sub(e.b,e.a)),t=Number(e.thickness),z=Number.isFinite(e.zBase)?e.zBase:Number(ls.get(e.levelId)?.elevation),h=Number(e.height);if(!u||!(t>0)||!Number.isFinite(z)||!(h>0))continue;const n={x:-u.y*t/2,y:u.x*t/2};parts.push({e,z,h,u,t,ps:[add(e.a,n),add(e.b,n),sub(e.b,n),sub(e.a,n)]});}
 const nodes=[];for(const w of parts){if(w.e.role==='joists'||w.e.floorRole==='joist')continue;for(const end of ['a','b']){const p=w.e[end];let node=nodes.find(n=>n.levelId===w.e.levelId&&Math.abs(n.z-w.z)<1e-7&&Math.abs(n.h-w.h)<1e-7&&dist(n.p,p)<.004);if(!node){node={p,levelId:w.e.levelId,z:w.z,h:w.h,ends:[]};nodes.push(node);}node.ends.push({w,end,v:end==='a'?w.u:mul(w.u,-1)});}}
 for(const node of nodes){if(node.ends.length!==2)continue;const [a,b]=node.ends,den=cross(a.v,b.v);if(Math.abs(den)<1e-6)continue;const halfA=a.w.t/2,halfB=b.w.t/2;
 const intersections=[];for(const sign of [1,-1]){const pa=add(node.p,{x:-a.v.y*halfA*sign,y:a.v.x*halfA*sign}),pb=add(node.p,{x:b.v.y*halfB*sign,y:-b.v.x*halfB*sign});const q=add(pa,mul(a.v,cross(sub(pb,pa),b.v)/den));intersections.push(q);}
 const limit=Math.min(4*Math.max(a.w.t,b.w.t),dist(a.w.e.a,a.w.e.b)*.45,dist(b.w.e.a,b.w.e.b)*.45);if(intersections.some(p=>dist(p,node.p)>limit))continue;
 const [left,right]=intersections;if(a.end==='a'){a.w.ps[0]=left;a.w.ps[3]=right;}else{a.w.ps[2]=left;a.w.ps[1]=right;}if(b.end==='a'){b.w.ps[0]=right;b.w.ps[3]=left;}else{b.w.ps[2]=right;b.w.ps[1]=left;}
 }return parts;}
const api={sub,add,mul,dot,cross,dist,unit,point,references,snap,triangulate,footprints,area};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root){
 root.PBPPrecision=api;
 if(root.PlanRenderer2D&&!root.PBPWallJoint2DInstalled){
  root.PBPWallJoint2DInstalled=true;
  const fill=(e,overlay)=>overlay?'#8ea3b0':e.type==='wallBearing'?'#273a49':e.type==='partition'?'#7b8790':e.type==='foundation'?'#69747c':e.type==='beam'?'#50616d':'#344c5d';
  const key=p=>Math.round(p.x*1e6)+','+Math.round(p.y*1e6);
  root.PlanRenderer2D.prototype.drawWallBatch=function(elements,alpha=1,overlay=false){
   const parts=footprints(elements,this.app.model.levels);if(!parts.length)return;
   const c=this.ctx,screen=p=>this.worldToScreen(p),edges=new Map();
   c.save();c.globalAlpha=alpha;
   for(const w of parts){
    const ps=w.ps.map(screen);if(ps.length<3)continue;
    c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=fill(w.e,overlay);c.fill();
    for(let i=0;i<w.ps.length;i++){const a=w.ps[i],b=w.ps[(i+1)%w.ps.length],ka=key(a),kb=key(b),k=ka<kb?ka+'|'+kb:kb+'|'+ka;if(!edges.has(k))edges.set(k,[]);edges.get(k).push({a,b});}
   }
   c.strokeStyle=overlay?'#667f8f':'#142b3a';c.lineWidth=1.5;c.lineCap='butt';c.lineJoin='miter';
   for(const rows of edges.values()){if(rows.length>1)continue;const e=rows[0],a=screen(e.a),b=screen(e.b);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
   c.restore();
  };
 }
}
})(typeof window!=='undefined'?window:globalThis);
