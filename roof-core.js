/* Plan Bâtiment Pro v0.15.0 — first autonomous timber roof prestudy.
   EC5 screening only; connections, global stability, snow/wind zoning and execution remain project inputs/checks. */
(function(root){
'use strict';
const TAG='pbp-roof-v1',G0=9.80665,clone=v=>JSON.parse(JSON.stringify(v)),num=(v,f=null)=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):f;
const insulationDefault=()=>({enabled:false,mode:'between-under',thickness:.20,lambda:.035,underThickness:.05,underLambda:.035,acoustic:false,reference:''});
const defaults=()=>({schema:1,enabled:false,supportLevelId:'r1',system:'gable-rafter',structureType:'traditional',slopeDeg:35,overhang:.30,invert:false,rafterSpacing:.60,trussSpacing:.60,purlinRows:2,deadLoad:.55,snowLoad:null,windPressure:null,grade:'C24',service:2,autoSection:true,extendWalls:true,panInsulation:[],b:63,h:175});
function settings(v){const s={...defaults(),...(v&&typeof v==='object'?clone(v):{})};for(const k of ['slopeDeg','overhang','rafterSpacing','trussSpacing','purlinRows','deadLoad','snowLoad','windPressure','b','h'])s[k]=num(s[k],defaults()[k]);s.enabled=s.enabled===true;s.invert=s.invert===true;s.autoSection=s.autoSection!==false;s.extendWalls=s.extendWalls!==false;if(!['gable-rafter'].includes(s.system))s.system='gable-rafter';if(!['traditional','truss'].includes(s.structureType))s.structureType='traditional';s.trussSpacing=Math.max(.3,Math.min(1.2,s.trussSpacing||.6));s.purlinRows=Math.max(0,Math.min(4,Math.round(s.purlinRows||0)));s.panInsulation=Array.isArray(s.panInsulation)?s.panInsulation.slice(0,4).map(x=>{const d={...insulationDefault(),...(x&&typeof x==='object'?x:{})};d.enabled=d.enabled===true;d.acoustic=d.acoustic===true;if(!['none','between','between-under','sarking','ceiling'].includes(d.mode))d.mode='between-under';for(const k of ['thickness','lambda','underThickness','underLambda'])d[k]=Math.max(0,num(d[k],insulationDefault()[k]));d.reference=String(d.reference||'').slice(0,250);return d;}):[];return s;}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function exteriorLevels(model){return (model.levels||[]).filter(l=>!l.autoFloor&&!['foundations','roof'].includes(l.id)).filter(l=>(model.elements||[]).filter(e=>e.levelId===l.id&&e.type==='wallExterior'&&e.a&&e.b&&!e.generator).length>=3).sort((a,b)=>b.elevation-a.elevation);}
function pointIn(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i].y>p.y)!==(poly[j].y>p.y)&&p.x<(poly[j].x-poly[i].x)*(p.y-poly[i].y)/(poly[j].y-poly[i].y)+poly[i].x)yes=!yes;return yes;}
function orthogonal(poly){for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(Math.abs(a.x-b.x)>.005&&Math.abs(a.y-b.y)>.005)return false;}return true;}
function rectangles(poly){
 const xs=[...new Set(poly.map(p=>+p.x.toFixed(6)))].sort((a,b)=>a-b),ys=[...new Set(poly.map(p=>+p.y.toFixed(6)))].sort((a,b)=>a-b),cells=[];
 for(let ix=0;ix<xs.length-1;ix++)for(let iy=0;iy<ys.length-1;iy++){const minX=xs[ix],maxX=xs[ix+1],minY=ys[iy],maxY=ys[iy+1];if(maxX-minX<.01||maxY-minY<.01)continue;if(pointIn({x:(minX+maxX)/2,y:(minY+maxY)/2},poly))cells.push({minX,maxX,minY,maxY});}
 const out=[];while(cells.length){let r=cells.shift(),changed=true;while(changed){changed=false;for(let i=0;i<cells.length;i++){const c=cells[i],sameY=Math.abs(c.minY-r.minY)<1e-6&&Math.abs(c.maxY-r.maxY)<1e-6,touchX=Math.abs(c.minX-r.maxX)<1e-6||Math.abs(c.maxX-r.minX)<1e-6,sameX=Math.abs(c.minX-r.minX)<1e-6&&Math.abs(c.maxX-r.maxX)<1e-6,touchY=Math.abs(c.minY-r.maxY)<1e-6||Math.abs(c.maxY-r.minY)<1e-6;if(sameY&&touchX){r={minX:Math.min(r.minX,c.minX),maxX:Math.max(r.maxX,c.maxX),minY:r.minY,maxY:r.maxY};cells.splice(i,1);changed=true;break;}if(sameX&&touchY){r={minX:r.minX,maxX:r.maxX,minY:Math.min(r.minY,c.minY),maxY:Math.max(r.maxY,c.maxY)};cells.splice(i,1);changed=true;break;}}}out.push({...r,w:r.maxX-r.minX,h:r.maxY-r.minY});}
 return out.sort((a,b)=>b.w*b.h-a.w*a.h);
}
function footprint(model,s,G,S){
 let support=s.supportLevelId,ext=(model.elements||[]).filter(e=>e.levelId===support&&e.type==='wallExterior'&&e.a&&e.b&&!e.generator);
 if(ext.length<3){const l=exteriorLevels(model)[0];if(!l)return{error:'Aucun niveau ne possède un contour suffisant de murs extérieurs.'};support=l.id;ext=(model.elements||[]).filter(e=>e.levelId===support&&e.type==='wallExterior'&&e.a&&e.b&&!e.generator);}
 const filtered={...model,elements:(model.elements||[]).filter(e=>e.levelId!==support||e.type==='wallExterior')},d=G.faces(filtered,support,S),faces=d.faces||[];
 if(faces.length!==1)return{error:faces.length?'Plusieurs contours extérieurs indépendants détectés : créer une charpente par bâtiment.':'Le contour extérieur n’est pas fermé.',supportLevelId:support};
 const f=faces[0];if(!orthogonal(f.points))return{error:'Le contour extérieur contient des pans non orthogonaux : le moteur automatique multi-zones ne les traite pas encore.',supportLevelId:support};
 const zones=f.rectangle?[(()=>{const xs=f.points.map(p=>p.x),ys=f.points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return{minX,maxX,minY,maxY,w:maxX-minX,h:maxY-minY};})()]:rectangles(f.points);
 if(!zones.length)return{error:'Emprise extérieure non décomposable automatiquement.',supportLevelId:support};
 return{face:f,zones,supportLevelId:support,irregular:!f.rectangle};
}
function beamCheck(L,spacing,b,h,g,snow){
 const E=11000,fm=24,fv=4,kmod=.8,gammaM=1.3,I=b*h*h*h/12,W=b*h*h/6,A=b*h,mm=L*1000,wg=g*spacing,ws=snow*spacing;
 const wd=1.35*wg+1.5*ws,M=wd*mm*mm/8,V=wd*mm/2,flex=(M/W)/(kmod*fm/gammaM),shear=(1.5*V/(.67*A))/(kmod*fv/gammaM),defl=5*(wg+ws)*mm**4/(384*E*I),ratioDefl=defl/(mm/300);
 return{b,h,flex,shear,defl,ratios:{flexion:flex,cisaillement:shear,fleche:ratioDefl},screened:[flex,shear,ratioDefl].every(x=>Number.isFinite(x)&&x<=1)};
}
function report(model,G=root.PBPGeometry,S=root.PBPStructure){
 const s=settings(model.roofDesign),r={settings:s,issues:[],elements:[],complete:false,section:null,count:0,geometry:null};const issue=(severity,text)=>r.issues.push({severity,text});if(!s.enabled)return r;
 const fp=footprint(model,s,G,S);if(fp.error){issue('error',fp.error);return r;}const pitch=s.slopeDeg*Math.PI/180,zones=fp.zones.map((z,zi)=>{const alongX=s.invert?z.w<z.h:z.w>=z.h,ridgeLength=alongX?z.w:z.h,cross=alongX?z.h:z.w,run=cross/2,span=run/Math.cos(pitch),rise=run*Math.tan(pitch),spacing=ridgeLength/Math.max(1,Math.ceil(ridgeLength/Math.max(.2,s.rafterSpacing)));return{...z,zi,alongX,ridgeLength,cross,run,span,rise,spacing};});
 r.geometry={...fp,zones,maxSpan:Math.max(...zones.map(z=>z.span)),totalRidge:zones.reduce((n,z)=>n+z.ridgeLength,0)};
 if(fp.irregular)issue('warning',zones.length+' zone(s) de toiture générées sur le contour avec décroché. Les noues/arêtiers et leurs assemblages restent à dimensionner spécifiquement.');
 if(!(s.snowLoad>=0)){issue('error','Charge de neige sur toiture non renseignée : géométrie détectée mais calcul de section suspendu.');return r;}if(!(s.windPressure>=0))issue('warning','Pression/succion de vent non renseignée : section gravitaire calculable, assemblages et soulèvement non vérifiés.');
 let section={b:s.b,h:s.h},checks=zones.map(z=>beamCheck(z.span,z.spacing,section.b,section.h,s.deadLoad,s.snowLoad));
 if(s.autoSection){const cs=[];for(const b of [45,63,75,100,120])for(const h of [120,145,170,195,220,245,270,300,340])if(h>=b&&h/b<=7){const zc=zones.map(z=>beamCheck(z.span,z.spacing,b,h,s.deadLoad,s.snowLoad));if(zc.every(c=>c.screened))cs.push({b,h,checks:zc});}cs.sort((a,b)=>a.b*a.h-b.b*b.h||a.h-b.h);if(!cs.length){issue('error','Aucune section C24 d’essai ne satisfait toutes les zones : prévoir pannes/appuis ou autre système.');return r;}section={b:cs[0].b,h:cs[0].h};checks=cs[0].checks;}
 r.section=section;r.check=checks.reduce((a,c)=>Math.max(...Object.values(c.ratios))>Math.max(...Object.values(a.ratios))?c:a,checks[0]);if(checks.some(c=>!c.screened)){issue('error','Section saisie insuffisante sur au moins une zone de toiture.');return r;}
 const level=(model.levels||[]).find(l=>l.id===fp.supportLevelId),eaveZ=(Number(level?.elevation)||0)+(Number(level?.height)||0),over=s.overhang,common={generator:TAG,mode:'construction',levelId:'roof',type:'slopedBeam',role:'rafters',width:section.b/1000,height:section.h/1000,locked:true,designStatus:'prestudy'};
 r.count=0;r.upliftReaction=0;
 for(const z of zones){const dirCount=Math.ceil(z.ridgeLength/z.spacing)+1,actual=z.ridgeLength/(dirCount-1||1);r.count+=dirCount*2;for(let k=0;k<dirCount;k++){const t=k*actual;if(z.alongX){const x=z.minX+t,y1=z.minY-over,y2=z.maxY+over,ym=(z.minY+z.maxY)/2;r.elements.push({...common,id:TAG+':'+z.zi+':a:'+k,a:{x,y:y1,z:eaveZ},b:{x,y:ym,z:eaveZ+z.rise}});r.elements.push({...common,id:TAG+':'+z.zi+':b:'+k,a:{x,y:y2,z:eaveZ},b:{x,y:ym,z:eaveZ+z.rise}});}else{const y=z.minY+t,x1=z.minX-over,x2=z.maxX+over,xm=(z.minX+z.maxX)/2;r.elements.push({...common,id:TAG+':'+z.zi+':a:'+k,a:{x:x1,y,z:eaveZ},b:{x:xm,y,z:eaveZ+z.rise}});r.elements.push({...common,id:TAG+':'+z.zi+':b:'+k,a:{x:x2,y,z:eaveZ},b:{x:xm,y,z:eaveZ+z.rise}});}}
 r.elements.push({generator:TAG,mode:'construction',levelId:'roof',type:'slopedBeam',role:'ridge',width:section.b/1000,height:section.h/1000,locked:true,designStatus:'prestudy',id:TAG+':ridge:'+z.zi,a:z.alongX?{x:z.minX-over,y:(z.minY+z.maxY)/2,z:eaveZ+z.rise}:{x:(z.minX+z.maxX)/2,y:z.minY-over,z:eaveZ+z.rise},b:z.alongX?{x:z.maxX+over,y:(z.minY+z.maxY)/2,z:eaveZ+z.rise}:{x:(z.minX+z.maxX)/2,y:z.maxY+over,z:eaveZ+z.rise}});
 if(s.windPressure>=0)r.upliftReaction=Math.max(r.upliftReaction,s.windPressure*z.spacing*z.span/2);}
 issue('warning','Préétude EC5 : assemblages, appuis, stabilité globale, contreventement, feu, durabilité et règles complètes NF DTU 31.1 restent à vérifier.');r.complete=true;return r;
}
const api={TAG,defaults,insulationDefault,settings,exteriorLevels,rectangles,footprint,beamCheck,report};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root){root.PBPRoof=api;root.PBPRoofReady=true;}
})(typeof window!=='undefined'?window:globalThis);
