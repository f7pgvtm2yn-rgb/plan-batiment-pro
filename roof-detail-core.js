/* Plan Bâtiment Pro v0.15.0 — professional roof dossier data. */
(function(root){'use strict';
const num=x=>Number.isFinite(Number(x))?Number(x):null,dist3=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y,(b.z||0)-(a.z||0));
function area3(ps){if(!Array.isArray(ps)||ps.length<3)return 0;const o=ps[0];let a=0;for(let i=1;i<ps.length-1;i++){const u={x:ps[i].x-o.x,y:ps[i].y-o.y,z:(ps[i].z||0)-(o.z||0)},v={x:ps[i+1].x-o.x,y:ps[i+1].y-o.y,z:(ps[i+1].z||0)-(o.z||0)},cx=u.y*v.z-u.z*v.y,cy=u.z*v.x-u.x*v.z,cz=u.x*v.y-u.y*v.x;a+=Math.hypot(cx,cy,cz)/2;}return a;}
function group(model,id){const r=root.PBPRoof.report(model),rows=r.groups||[],g=rows.find(x=>x.settings.id===id)||rows[0];if(!g)return null;const surfaces=(g.elements||[]).filter(e=>e.type==='roofSurface'),pans=[];for(const e of surfaces){const i=Number(e.panIndex)||0;if(!pans[i])pans[i]={index:i,area:0,surfaces:0,thermalR:0,insulation:null};pans[i].area+=area3(e.vertices);pans[i].surfaces++;pans[i].thermalR=Math.max(pans[i].thermalR,Number(e.insulationR)||0);pans[i].insulation=g.form?.panInsulation?.[i]||null;}
 const pts=surfaces.flatMap(e=>e.vertices||[]);const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),zs=pts.map(p=>p.z),bounds=pts.length?{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),minZ:Math.min(...zs),maxZ:Math.max(...zs)}:null;
 const zone=g.geometry?.zones?.[0]||null,section=zone?{cross:zone.cross,ridgeLength:zone.ridgeLength,eaveZ:zone.eaveZ,rise:zone.rise,span:zone.span,pitch:Number(g.settings.slopeDeg)||0}:null;
 return{group:g,pans,bounds,section,elements:g.elements||[],structureType:g.settings.structureType||'traditional',warnings:(g.issues||[]).map(i=>i.text)};
}
const api={area3,group};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root){root.PBPRoofDetail=api;root.PBPRoofDetailReady=true;}
})(typeof window!=='undefined'?window:globalThis);