/* v0.12.0 depth-buffered solid rendering.
   Visual cleanup only: model geometry, dimensions and structural calculations are unchanged. */
(function(){'use strict';const C=PBPPrecision,G=PBPGeometry,app=planApp,$=s=>document.querySelector(s),fallback=ConstructionRenderer3D.prototype.draw;
const palette={concrete:'#a7afb5',brick:'#c08d79',block:'#b2b4af',timber:'#bd9b69',panel:'#cfb88c',insulation:'#e7d793',ravoirage:'#c3b9a7',screed:'#b8b8ae',finish:'#d1c1ad',ceiling:'#e2e5e8',joists:'#ad8654',rafters:'#a67f4f',ridge:'#8c643d',liningInside:'#9abbd0',liningOutside:'#99b78f',acousticLining:'#b99ab9',drywallPartition:'#c8bbc9'};
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const VIS_EPS=.002;
const clonePoint=p=>({x:Number(p.x),y:Number(p.y)});
function cleanPolygon(points){
 const a=[];for(const p of points||[]){if(!C.point(p))continue;if(!a.length||C.dist(p,a[a.length-1])>1e-6)a.push(clonePoint(p));}
 if(a.length>2&&C.dist(a[0],a[a.length-1])<1e-6)a.pop();
 let changed=true,guard=0;while(changed&&a.length>3&&guard++<20){changed=false;for(let i=0;i<a.length;i++){const p=a[(i+a.length-1)%a.length],q=a[i],r=a[(i+1)%a.length],u=C.sub(q,p),v=C.sub(r,q),lu=Math.hypot(u.x,u.y),lv=Math.hypot(v.x,v.y);if(lu<1e-6||lv<1e-6||Math.abs(C.cross(u,v))<1e-8*lu*lv&&C.dot(u,v)>0){a.splice(i,1);changed=true;break;}}}
 return a;
}
function pointOnSegmentProjection(p,e){
 const v=C.sub(e.b,e.a),L2=C.dot(v,v);if(!(L2>1e-10))return null;const t=C.dot(C.sub(p,e.a),v)/L2;if(t<-.03/Math.sqrt(L2)||t>1+.03/Math.sqrt(L2))return null;return C.add(e.a,C.mul(v,Math.max(0,Math.min(1,t))));
}
function elementZ(e,ls){const l=ls.get(e.levelId);return Number.isFinite(e.zBase)?Number(e.zBase):Number(l?.elevation);}
function trimJoistForDisplay(e,data,bearingWalls){
 if(!e?.a||!e?.b)return e;const ab=C.sub(e.b,e.a),L=Math.hypot(ab.x,ab.y);if(L<.05)return e;const u={x:ab.x/L,y:ab.y/L},z=elementZ(e,data.ls),next={...e,a:clonePoint(e.a),b:clonePoint(e.b)};
 for(const end of ['a','b']){
  const p=e[end],inside=end==='a'?u:C.mul(u,-1);let best=null;
  for(const w of bearingWalls){
   const wz=elementZ(w,data.ls),wh=Number(w.height),t=Number(w.thickness);if(!Number.isFinite(wz)||!(wh>0)||!(t>0)||Math.abs(wz+wh-z)>.06)continue;
   const q=pointOnSegmentProjection(p,w);if(!q)continue;const d=C.dist(p,q);if(d>t/2+.04)continue;
   const wu=C.unit(C.sub(w.b,w.a));if(!wu||Math.abs(C.dot(wu,inside))>.35)continue;
   if(!best||d<best.d)best={w,q,d,t};
  }
  if(best)next[end]=C.add(best.q,C.mul(inside,best.t/2+VIS_EPS));
 }
 if(C.dist(next.a,next.b)<.04)return e;return next;
}
function convexHull(points){
 const ps=[...new Map(points.map(p=>[(Math.round(p.x*1e6))+':'+(Math.round(p.y*1e6)),p])).values()].sort((a,b)=>a.x-b.x||a.y-b.y);if(ps.length<3)return ps;
 const cr=(o,a,b)=>C.cross(C.sub(a,o),C.sub(b,o)),lo=[],hi=[];for(const p of ps){while(lo.length>1&&cr(lo.at(-2),lo.at(-1),p)<=1e-10)lo.pop();lo.push(p);}for(let i=ps.length-1;i>=0;i--){const p=ps[i];while(hi.length>1&&cr(hi.at(-2),hi.at(-1),p)<=1e-10)hi.pop();hi.push(p);}lo.pop();hi.pop();return lo.concat(hi);
}
function initGL(renderer){const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{antialias:true,alpha:false,depth:true,preserveDrawingBuffer:true});if(!gl)return null;
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec3 color;varying vec3 v;uniform vec4 view;uniform vec3 size;void main(){float x=p.x*view.x-p.y*view.y;float y=p.x*view.y+p.y*view.x;gl_Position=vec4(x*size.x,(p.z*view.w-y*view.z)*size.y-0.24,-(y*view.w+p.z*view.z)/size.z,1.0);v=color;}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 v;void main(){gl_FragColor=vec4(v,1.0);}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 return {canvas,gl,program,buffer:gl.createBuffer(),p:gl.getAttribLocation(program,'p'),color:gl.getAttribLocation(program,'color'),view:gl.getUniformLocation(program,'view'),size:gl.getUniformLocation(program,'size')};}
function scene(m,show){const b=PBPBuildingUI.getReport(),s=PBPStructureUI.getReport(),f=PBPFoundationUI.getReport(),env=window.PBPEnvelopeUI?.getReport?.()||{elements:[],hiddenHostIds:[]},roof=window.PBPRoofUI?.getReport?.()||{elements:[]},levels=m.levels.filter(l=>!l.autoFloor).concat(b.levels||[]),vis=G.visible({...m,levels},show),ids=new Set(vis.map(l=>l.id)),ls=new Map(levels.map(l=>[l.id,l])),demo=new Set(f.settings?.enabled&&f.settings.hideDemo?PBPFoundations.demoIds(m.elements):[]),hiddenHosts=new Set(env.hiddenHostIds||[]),showFloor=m.view3D?.showFloor!==false;
 const floorLayers=new Set(['panel','insulation','ravoirage','screed','finish','ceiling','concrete','deck']);
 const elements=[...new Map([...m.elements.filter(e=>!hiddenHosts.has(e.id)),...(f.elements||[]),...(s.elements||[]),...(b.elements||[]),...(env.elements||[]),...(roof.elements||[])].map(e=>[e.id,e])).values()].filter(e=>{
  if(!(e.mode==='construction'&&ids.has(e.levelId)&&!e.hiddenLayer&&!demo.has(e.id)&&(show||(!e.foundationRole&&e.type!=='foundation'))))return false;
  // "Plancher" only hides sheet/cover layers. Joists, rim joists and closure rims remain visible.
  if(!showFloor&&floorLayers.has(e.role))return false;
  if(e.role==='roofCover'&&m.view3D?.showRoofCover===false)return false;
  return true;
 });
 return {levels,vis,ls,elements,showFloor};}
function mesh(data){const triangles=[],lines=[],issues=[];let maxDepth=30;
 const put=(arr,p,c)=>{maxDepth=Math.max(maxDepth,Math.abs(p[0])+Math.abs(p[1])+Math.abs(p[2])+10);arr.push(...p,...c);};
 function prism(points,z,h,color,wire=false){if(!Number.isFinite(z)||!(h>0))return;let ps=cleanPolygon(points);if(ps.length<3||Math.abs(C.area(ps))<1e-7)return;if(C.area(ps)<0)ps=ps.slice().reverse();const base=rgb(color),colorFor=n=>{const v=.68+.27*Math.max(0,n[0]*.30+n[1]*-.4+n[2]*.866);return base.map(c=>Math.min(1,c*v));};
 if(wire){for(const alt of [z,z+h])for(let i=0;i<ps.length;i++){const j=(i+1)%ps.length;put(lines,[ps[i].x,ps[i].y,alt],[.56,.64,.69]);put(lines,[ps[j].x,ps[j].y,alt],[.56,.64,.69]);}return;}
 const top=C.triangulate(ps);for(const tri of top){for(const p of tri)put(triangles,[p.x,p.y,z+h],colorFor([0,0,1]));for(const p of tri)put(triangles,[p.x,p.y,z],colorFor([0,0,-1]));}
 for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],v=C.unit(C.sub(b,a));if(!v)continue;const col=colorFor([v.y,-v.x,0]);for(const p of [[a.x,a.y,z],[b.x,b.y,z],[b.x,b.y,z+h],[a.x,a.y,z],[b.x,b.y,z+h],[a.x,a.y,z+h]])put(triangles,p,col);}}
 function beam3d(e,color){if(!e.a||!e.b||![e.a.x,e.a.y,e.a.z,e.b.x,e.b.y,e.b.z,e.width,e.height].every(Number.isFinite))return;const ax=e.a.x,ay=e.a.y,az=e.a.z,bx=e.b.x,by=e.b.y,bz=e.b.z,dx=bx-ax,dy=by-ay,dz=bz-az,L=Math.hypot(dx,dy,dz);if(L<1e-6)return;const ux=dx/L,uy=dy/L,uz=dz/L;let rx=-uy,ry=ux,rz=0,rl=Math.hypot(rx,ry,rz);if(rl<1e-6){rx=1;ry=0;rz=0;rl=1;}rx/=rl;ry/=rl;rz/=rl;const sx=uy*rz-uz*ry,sy=uz*rx-ux*rz,sz=ux*ry-uy*rx,hw=e.width/2,hh=e.height/2,base=rgb(color),shade=(v)=>base.map(x=>Math.min(1,x*v));const corners=[];for(const end of [0,1]){const cx=end?bx:ax,cy=end?by:ay,cz=end?bz:az;corners.push([cx+rx*hw+sx*hh,cy+ry*hw+sy*hh,cz+rz*hw+sz*hh],[cx-rx*hw+sx*hh,cy-ry*hw+sy*hh,cz-rz*hw+sz*hh],[cx-rx*hw-sx*hh,cy-ry*hw-sy*hh,cz-rz*hw-sz*hh],[cx+rx*hw-sx*hh,cy+ry*hw-sy*hh,cz+rz*hw-sz*hh]);}const faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];for(let fi=0;fi<faces.length;fi++){const f=faces[fi],col=shade(fi<2?.95:.78+(fi%2)*.08);for(const t of [[f[0],f[1],f[2]],[f[0],f[2],f[3]]])for(const i of t)put(triangles,corners[i],col);}}
 function roofSurface(e){const ps=e.vertices;if(!Array.isArray(ps)||ps.length<3||!ps.every(p=>[p.x,p.y,p.z].every(Number.isFinite)))return;const col=rgb('#93857b'),bottom=col.map(x=>x*.70),edge=col.map(x=>x*.84),h=.035;for(let i=1;i<ps.length-1;i++){for(const p of [ps[0],ps[i],ps[i+1]])put(triangles,[p.x,p.y,p.z+h],col);for(const p of [ps[0],ps[i+1],ps[i]])put(triangles,[p.x,p.y,p.z],bottom);}for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length];for(const p of [[a.x,a.y,a.z],[b.x,b.y,b.z],[b.x,b.y,b.z+h],[a.x,a.y,a.z],[b.x,b.y,b.z+h],[a.x,a.y,a.z+h]])put(triangles,p,edge);}}
 for(const e of data.elements)if(e.type==='roofSurface')roofSurface(e);
 const sloped=data.elements.filter(e=>e.type==='slopedBeam');for(const e of sloped)beam3d(e,palette[e.role]||palette.timber);
 const wallTypes=new Set(['wallExterior','wallBearing','partition','foundation','beam']),walls=data.elements.filter(e=>wallTypes.has(e.type)&&e.a&&e.b),ordinary=walls.filter(e=>e.role!=='joists'&&e.floorRole!=='joist'),joists=walls.filter(e=>!ordinary.includes(e));
 const paint=w=>palette[w.e.role]||palette[w.e.materialSpec?.type]||(w.e.type==='foundation'||w.e.foundationRole?'#999fa5':w.e.type==='partition'?'#ccd2d7':'#b3c0c8');
 for(const l of data.levels){const group=ordinary.filter(e=>e.levelId===l.id);if(!group.length)continue;const zs=[...new Set(group.flatMap(e=>{const z=Number.isFinite(e.zBase)?e.zBase:l.elevation;return[z,z+Number(e.height)];}).filter(Number.isFinite))].sort((a,b)=>a-b);if(zs.length>160){issues.push('Géométrie très détaillée : raccords simplifiés');for(const w of C.footprints(group,data.levels))prism(w.ps,w.z,w.h,paint(w));continue;}
 for(let i=0;i<zs.length-1;i++){const lo=zs[i],hi=zs[i+1];if(hi-lo<1e-7)continue;const band=group.filter(e=>{const z=Number.isFinite(e.zBase)?e.zBase:l.elevation;return z<hi-1e-7&&z+Number(e.height)>lo+1e-7;}).map(e=>({...e,zBase:lo,height:hi-lo}));for(const w of C.footprints(band,data.levels))prism(w.ps,w.z,w.h,paint(w));}}
 // Trim only the DISPLAY geometry of joist ends back to the visible inner face
 // of supporting walls. The calculated bearing length remains unchanged in the model.
 const bearingWalls=ordinary.filter(e=>['wallExterior','wallBearing'].includes(e.type)&&e.a&&e.b);
 const visualJoists=joists.map(e=>trimJoistForDisplay(e,data,bearingWalls));
 for(const w of C.footprints(visualJoists,data.levels))prism(w.ps,w.z,w.h,palette.joists);

 // Multi-wall nodes (T/cross junctions) are not handled by the two-wall miter
 // routine. Add a tiny union cap at those nodes to remove angle holes/slivers.
 const joinWalls=ordinary.filter(e=>['wallExterior','wallBearing','partition'].includes(e.type)&&e.a&&e.b&&Number(e.thickness)>0);
 const nodes=[];
 for(const e of joinWalls){const z=elementZ(e,data.ls),h=Number(e.height),u=C.unit(C.sub(e.b,e.a));if(!u||!Number.isFinite(z)||!(h>0))continue;for(const end of ['a','b']){const p=e[end];let n=nodes.find(n=>n.levelId===e.levelId&&Math.abs(n.z-z)<1e-7&&Math.abs(n.h-h)<1e-7&&C.dist(n.p,p)<.004);if(!n){n={p,levelId:e.levelId,z,h,ends:[]};nodes.push(n);}n.ends.push({e,end,u:end==='a'?u:C.mul(u,-1)});}}
 for(const n of nodes){if(n.ends.length<3)continue;const pts=[];for(const x of n.ends){const half=Number(x.e.thickness)/2,side={x:-x.u.y*half,y:x.u.x*half};pts.push(C.add(n.p,side),C.sub(n.p,side));}const hull=convexHull(pts);if(hull.length>=3&&Math.abs(C.area(hull))<.5){const exterior=n.ends.find(x=>x.e.type==='wallExterior')||n.ends.find(x=>x.e.type==='wallBearing')||n.ends[0];const col=palette[exterior.e.materialSpec?.type]||(exterior.e.type==='partition'?'#ccd2d7':'#b3c0c8');prism(hull,n.z,n.h,col);issues.push('Jonction multi-murs lissée');}}

 for(const e of data.elements){if(walls.includes(e)||e.type==='slopedBeam'||e.type==='roofSurface')continue;const l=data.ls.get(e.levelId);if(!l)continue;const z=Number.isFinite(e.zBase)?e.zBase:l.elevation,h=Number(e.height);let ps=e.polygon;
 if(!ps&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number(e.width)>0&&Number(e.depth)>0){const w=e.width/2,d=e.depth/2;ps=[{x:e.x-w,y:e.y-d},{x:e.x+w,y:e.y-d},{x:e.x+w,y:e.y+d},{x:e.x-w,y:e.y+d}];}
 if(ps){const col=e.role==='rim'?(palette[e.rimMaterial]||'#b3c0c8'):(palette[e.role]||'#b8c1c7');prism(ps,z,h,col,e.void||e.type==='opening');}}
 const grid=20;for(let i=-grid;i<=grid;i++){for(const p of [[i,-grid,0],[i,grid,0],[-grid,i,0],[grid,i,0]])put(lines,p,[.81,.85,.87]);}return {triangles,lines,maxDepth,issues};}
// Software depth buffer for devices with WebGL disabled. Same mesh and camera;
// supersampling and downscaling smooth silhouettes without moving the model.
function raster(renderer,geo){
 const factor=Math.min(2,Math.sqrt(2400000/(renderer.width*renderer.height))),W=Math.max(1,Math.round(renderer.width*factor)),H=Math.max(1,Math.round(renderer.height*factor));
 const canvas=renderer.cpuCanvas||(renderer.cpuCanvas=document.createElement('canvas')),key=[renderer.solidKey,W,H,renderer.angle,renderer.tilt,renderer.zoom].join('|');
 if(renderer.cpuKey===key)return canvas;renderer.cpuKey=key;canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(W,H),pixels=image.data,depth=new Float32Array(W*H);depth.fill(Infinity);
 for(let i=0;i<pixels.length;i+=4){pixels[i]=238;pixels[i+1]=242;pixels[i+2]=245;pixels[i+3]=255;}
 const ca=Math.cos(renderer.angle),sa=Math.sin(renderer.angle),st=Math.sin(renderer.tilt),ct=Math.cos(renderer.tilt),scale=renderer.zoom*factor;
 const project=(a,i)=>{const x=a[i],y=a[i+1],z=a[i+2],rx=x*ca-y*sa,ry=x*sa+y*ca;return{x:W/2+rx*scale,y:H*.62+(ry*st-z*ct)*scale,z:-(ry*ct+z*st)};};
 const tri=geo.triangles;
 for(let i=0;i<tri.length;i+=18){const a=project(tri,i);let b=project(tri,i+6),c=project(tri,i+12);let den=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(den)<1e-9)continue;if(den<0){[b,c]=[c,b];den=-den;}
  const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(W-1,Math.ceil(Math.max(a.x,b.x,c.x))),y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(H-1,Math.ceil(Math.max(a.y,b.y,c.y)));if(x0>x1||y0>y1)continue;
  const red=Math.round(tri[i+3]*255),green=Math.round(tri[i+4]*255),blue=Math.round(tri[i+5]*255);
  const v0x=b.y-c.y,v0y=c.x-b.x,v1x=c.y-a.y,v1y=a.x-c.x;
  for(let y=y0;y<=y1;y++){let wa=((b.x-x0-.5)*(c.y-y-.5)-(b.y-y-.5)*(c.x-x0-.5))/den,wb=((c.x-x0-.5)*(a.y-y-.5)-(c.y-y-.5)*(a.x-x0-.5))/den;
   for(let x=x0;x<=x1;x++){const wc=1-wa-wb;if(wa>=-1e-7&&wb>=-1e-7&&wc>=-1e-7){const z=wa*a.z+wb*b.z+wc*c.z,k=y*W+x;if(z<=depth[k]+1e-7){depth[k]=z;const j=k*4;pixels[j]=red;pixels[j+1]=green;pixels[j+2]=blue;}}wa+=v0x/den;wb+=v1x/den;}}
 }
 const ls=geo.lines;for(let i=0;i<ls.length;i+=12){const a=project(ls,i),b=project(ls,i+6),n=Math.min(50000,Math.ceil(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))));if(!n)continue;for(let j=0;j<=n;j++){const t=j/n,x=Math.round(a.x+(b.x-a.x)*t),y=Math.round(a.y+(b.y-a.y)*t);if(x<0||x>=W||y<0||y>=H)continue;const k=y*W+x,z=a.z+(b.z-a.z)*t-.00002;if(z<=depth[k]){depth[k]=z;const off=k*4;pixels[off]=ls[i+3]*255;pixels[off+1]=ls[i+4]*255;pixels[off+2]=ls[i+5]*255;}}}
 ctx.putImageData(image,0,0);return canvas;
}
ConstructionRenderer3D.prototype.draw=function(){if(!this.ctx||!this.width||this.width<2||this.height<2)return;try{
 if(!this.solidGL&&!this.solidFailed){this.solidGL=initGL(this);if(!this.solidGL)this.solidFailed=true;}
 const show=this.app.model.view3D?.showFoundations===true,data=scene(this.app.model,show),key=JSON.stringify([data.levels,data.elements]);if(key!==this.solidKey){this.solidMesh=mesh(data);this.solidKey=key;}const geo=this.solidMesh,r=this.solidGL;
 if(!r||r.gl.isContextLost()){const canvas=raster(this,geo);this.ctx.clearRect(0,0,this.width,this.height);this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';this.ctx.drawImage(canvas,0,0,this.width,this.height);this.solidStatus={webgl:false,softwareDepth:true,triangles:geo.triangles.length/18};const input=$('#gShowFoundations');if(input)input.checked=show;const floor=$('#gShowFloor');if(floor)floor.checked=data.showFloor;const text=$('#g3DLevels');if(text)text.textContent=data.vis.map(l=>l.name).join(' + ')||'Fondations masquées';return;}const g=r.gl;
 if(r.canvas.width!==this.canvas.width||r.canvas.height!==this.canvas.height){r.canvas.width=this.canvas.width;r.canvas.height=this.canvas.height;}
 g.viewport(0,0,r.canvas.width,r.canvas.height);g.clearColor(.933,.949,.961,1);g.clearDepth(1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.disable(g.CULL_FACE);g.useProgram(r.program);g.uniform4f(r.view,Math.cos(this.angle),Math.sin(this.angle),Math.sin(this.tilt),Math.cos(this.tilt));g.uniform3f(r.size,2*this.zoom/this.width,2*this.zoom/this.height,geo.maxDepth);
 g.bindBuffer(g.ARRAY_BUFFER,r.buffer);g.enableVertexAttribArray(r.p);g.enableVertexAttribArray(r.color);g.vertexAttribPointer(r.p,3,g.FLOAT,false,24,0);g.vertexAttribPointer(r.color,3,g.FLOAT,false,24,12);
 for(const [arr,mode] of [[geo.triangles,g.TRIANGLES],[geo.lines,g.LINES]]){g.bufferData(g.ARRAY_BUFFER,new Float32Array(arr),g.DYNAMIC_DRAW);g.drawArrays(mode,0,arr.length/6);}this.ctx.clearRect(0,0,this.width,this.height);this.ctx.drawImage(r.canvas,0,0,this.width,this.height);
 const input=$('#gShowFoundations');if(input)input.checked=show;const floor=$('#gShowFloor');if(floor)floor.checked=data.showFloor;const text=$('#g3DLevels');if(text)text.textContent=data.vis.map(l=>l.name).join(' + ')||'Fondations masquées';this.solidStatus={webgl:true,antialias:g.getContextAttributes().antialias,triangles:geo.triangles.length/18,issues:geo.issues};
 }catch(err){console.error('Rendu 3D avancé indisponible',err);this.solidFailed=true;fallback.call(this);}};
window.PBPSolidView={scene,mesh,raster};window.PBPSolidReady=true;
})();
