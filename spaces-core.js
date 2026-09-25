/* v0.13.0 — Rooms, interior areas and stable structural-zone selections.
   Area is geometric, not a statutory habitable/floor-area certificate. */
(function(root){
'use strict';
const EPS=1e-7;
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),mul=(a,t)=>({x:a.x*t,y:a.y*t});
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const area=ps=>ps.reduce((s,p,i)=>s+cross(p,ps[(i+1)%ps.length]),0)/2;
function onSegment(p,a,b,tol=EPS){const v=sub(b,a),l=dot(v,v);if(!l)return dist(p,a)<=tol;const t=dot(sub(p,a),v)/l;return t>=0&&t<=1&&dist(p,add(a,mul(v,t)))<=tol;}
function inside(p,ps){let yes=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){if(onSegment(p,ps[j],ps[i]))return true;if((ps[i].y>p.y)!==(ps[j].y>p.y)&&p.x<(ps[j].x-ps[i].x)*(p.y-ps[i].y)/(ps[j].y-ps[i].y)+ps[i].x)yes=!yes;}return yes;}
function labelPoint(ps){
 if(!ps?.length)return{x:0,y:0};const a=area(ps);let p={x:0,y:0};
 if(Math.abs(a)>EPS){for(let i=0;i<ps.length;i++){const q=ps[i],r=ps[(i+1)%ps.length],k=cross(q,r);p.x+=(q.x+r.x)*k;p.y+=(q.y+r.y)*k;}p=mul(p,1/(6*a));if(inside(p,ps))return p;}
 const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0,h=Math.max(...ys)-y0;let best=ps[0],score=-1;
 for(let i=0;i<20;i++)for(let j=0;j<20;j++){p={x:x0+(i+.5)*w/20,y:y0+(j+.5)*h/20};if(!inside(p,ps))continue;let d=Infinity;for(let k=0;k<ps.length;k++){const b=ps[k],v=sub(ps[(k+1)%ps.length],b),t=Math.max(0,Math.min(1,dot(sub(p,b),v)/(dot(v,v)||1)));d=Math.min(d,dist(p,add(b,mul(v,t))));}if(d>score){score=d;best=p;}}
 return best;
}
function settings(v){const names={};for(const [k,x] of Object.entries(v?.names||{})){if(typeof x==='string')names[k]=x.trim().slice(0,80);}return{schema:1,visible:v?.visible!==false,names};}
function identity(face,levelId){
 const parts=[];for(const s of face.sides||[]){for(const w of s.members||[]){if(!w.id||!point(w.a)||!point(w.b))continue;parts.push([String(w.id),dot(sub(s.b,s.a),sub(w.b,w.a))>=0?1:-1]);}}
 const uniq=[...new Map(parts.map(x=>[JSON.stringify(x),x])).values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return JSON.stringify([String(levelId),uniq.length?uniq:(face.points||[]).map(p=>[+p.x.toFixed(6),+p.y.toFixed(6)])]);
}
function usableWall(e){return e?.mode==='construction'&&!e.generator&&['wallExterior','wallBearing','partition'].includes(e.type)&&point(e.a)&&point(e.b)&&dist(e.a,e.b)>.05;}
function interior(face){
 let variable=false;const ls=[];
 for(const s of face.sides||[]){const widths=(s.members||[]).map(w=>Number(w.thickness));if(!widths.length||widths.some(w=>!Number.isFinite(w)||w<=0))return{polygon:null,area:null,approximate:true,reason:'Épaisseur de mur manquante.'};
  if(Math.max(...widths)-Math.min(...widths)>.001)variable=true;
  const v=sub(s.b,s.a),L=Math.hypot(v.x,v.y);if(L<EPS)return{polygon:null,area:null,approximate:true,reason:'Contour dégénéré.'};
  const u=mul(v,1/L),n={x:-u.y,y:u.x};ls.push({p:add(s.a,mul(n,Math.max(...widths)/2)),u});
 }
 const ps=[];
 for(let i=0;i<ls.length;i++){const a=ls[(i+ls.length-1)%ls.length],b=ls[i],den=cross(a.u,b.u);if(Math.abs(den)<EPS)return{polygon:null,area:null,approximate:true,reason:'Jonction intérieure à vérifier.'};ps.push(add(a.p,mul(a.u,cross(sub(b.p,a.p),b.u)/den)));}
 let valid=ps.length>=3&&area(ps)>EPS&&area(ps)<=Math.abs(area(face.points))+EPS&&ps.every(p=>inside(p,face.points));
 for(let i=0;i<ps.length&&valid;i++)for(let j=i+2;j<ps.length;j++){if(i===0&&j===ps.length-1)continue;const a=ps[i],b=ps[(i+1)%ps.length],c=ps[j],d=ps[(j+1)%ps.length],r=sub(b,a),s=sub(d,c),den=cross(r,s);if(Math.abs(den)<EPS)continue;const t=cross(sub(c,a),s)/den,u=cross(sub(c,a),r)/den;if(t>EPS&&t<1-EPS&&u>EPS&&u<1-EPS)valid=false;}
 return valid?{polygon:ps,area:area(ps),approximate:variable,reason:variable?'Épaisseurs variables : enveloppe intérieure estimée.':''}:{polygon:null,area:null,approximate:true,reason:'Surface intérieure indéterminée : contour étroit ou croisé.'};
}
function rooms(model,levelId,G=root.PBPGeometry){
 const d=G.faces(model,levelId,{isSupport:usableWall}),s=settings(model.spaceDesign);
 const rows=(d.faces||[]).map(face=>({id:identity(face,levelId),face})).sort((a,b)=>a.id.localeCompare(b.id)).map((r,i)=>{const inner=interior(r.face);return{...r,levelId,name:s.names[r.id]||'Pièce '+(i+1),defaultName:'Pièce '+(i+1),axisArea:Math.abs(area(r.face.points)),area:inner.area,innerPolygon:inner.polygon,approximate:inner.approximate,areaNote:inner.reason,anchor:labelPoint(inner.polygon||r.face.points)};});
 return{rows,issues:d.issues||[]};
}
function zones(model,levelId,basis='structure',G=root.PBPGeometry,S=root.PBPStructure){
 const detector=basis==='exterior'?{isSupport:e=>usableWall(e)&&e.type==='wallExterior'}:S;
 const d=G.faces(model,levelId,detector),rs=rooms(model,levelId,G).rows;
 const rows=(d.faces||[]).map((face,i)=>{const id=identity(face,levelId),matched=rs.filter(r=>r.id===id||inside(r.anchor,face.points));return{id,levelId,face,area:Math.abs(area(face.points)),anchor:labelPoint(face.points),name:matched.length?matched.map(r=>r.name).join(' / '):'Zone '+(i+1),roomIds:matched.map(r=>r.id),rectangle:face.rectangle===true};});
 return{rows,issues:d.issues||[]};
}
function selection(v){return{mode:v?.mode==='selected'?'selected':'all',ids:Array.isArray(v?.ids)?[...new Set(v.ids.filter(x=>typeof x==='string'))]:[]};}
function resolve(rows,v){const s=selection(v),ids=new Set(s.ids),found=new Set(rows.map(r=>r.id)),chosen=s.mode==='all'?rows:rows.filter(r=>ids.has(r.id));return{selection:s,chosen,missing:s.mode==='selected'?s.ids.filter(id=>!found.has(id)):[],selectedArea:chosen.reduce((a,r)=>a+r.area,0),totalArea:rows.reduce((a,r)=>a+r.area,0)};}
function toggle(rows,v,id){const r=resolve(rows,v),ids=new Set(r.chosen.map(x=>x.id));if(ids.has(id))ids.delete(id);else ids.add(id);return{mode:'selected',ids:[...ids]};}
const api={point,sub,add,mul,dot,cross,dist,area,inside,labelPoint,settings,identity,usableWall,interior,rooms,zones,selection,resolve,toggle};
if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.PBPSpaces=api;
})(typeof window!=='undefined'?window:globalThis);
