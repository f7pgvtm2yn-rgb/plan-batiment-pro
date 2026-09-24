/* Plan Bâtiment Pro v0.12.0 — first autonomous timber roof prestudy.
   EC5 screening only; connections, global stability, snow/wind zoning and execution remain project inputs/checks. */
(function(root){
'use strict';
const TAG='pbp-roof-v1',G0=9.80665,clone=v=>JSON.parse(JSON.stringify(v)),num=(v,f=null)=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):f;
const defaults=()=>({schema:1,enabled:false,supportLevelId:'r1',system:'gable-rafter',slopeDeg:35,overhang:.30,invert:false,rafterSpacing:.60,deadLoad:.55,snowLoad:null,windPressure:null,grade:'C24',service:2,autoSection:true,b:63,h:175});
function settings(v){const s={...defaults(),...(v&&typeof v==='object'?clone(v):{})};for(const k of ['slopeDeg','overhang','rafterSpacing','deadLoad','snowLoad','windPressure','b','h'])s[k]=num(s[k],defaults()[k]);s.enabled=s.enabled===true;s.invert=s.invert===true;s.autoSection=s.autoSection!==false;if(!['gable-rafter'].includes(s.system))s.system='gable-rafter';return s;}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function footprint(model,s,G,S){const d=G.faces(model,s.supportLevelId,S),faces=(d.faces||[]).filter(f=>f.rectangle);if(faces.length!==1)return{error:'La charpente automatique actuelle exige une emprise porteuse rectangulaire unique sur le niveau support.'};const f=faces[0],xs=f.points.map(p=>p.x),ys=f.points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),w=maxX-minX,h=maxY-minY;return{face:f,minX,maxX,minY,maxY,w,h};}
function beamCheck(L,spacing,b,h,g,snow){
 const E=11000,fm=24,fv=4,kmod=.8,gammaM=1.3,I=b*h*h*h/12,W=b*h*h/6,A=b*h,mm=L*1000,wg=g*spacing,ws=snow*spacing;
 const wd=1.35*wg+1.5*ws,M=wd*mm*mm/8,V=wd*mm/2,flex=(M/W)/(kmod*fm/gammaM),shear=(1.5*V/(.67*A))/(kmod*fv/gammaM),defl=5*(wg+ws)*mm**4/(384*E*I),ratioDefl=defl/(mm/300);
 return{b,h,flex,shear,defl,ratios:{flexion:flex,cisaillement:shear,fleche:ratioDefl},screened:[flex,shear,ratioDefl].every(x=>Number.isFinite(x)&&x<=1)};
}
function report(model,G=root.PBPGeometry,S=root.PBPStructure){
 const s=settings(model.roofDesign),r={settings:s,issues:[],elements:[],complete:false,section:null,count:0,geometry:null};const issue=(severity,text)=>r.issues.push({severity,text});if(!s.enabled)return r;
 const fp=footprint(model,s,G,S);if(fp.error){issue('error',fp.error);return r;}const alongX=s.invert?fp.w<fp.h:fp.w>=fp.h,ridgeLength=alongX?fp.w:fp.h,cross=alongX?fp.h:fp.w,pitch=s.slopeDeg*Math.PI/180,run=cross/2,span=run/Math.cos(pitch),rise=run*Math.tan(pitch),spacing=ridgeLength/Math.max(1,Math.ceil(ridgeLength/Math.max(.2,s.rafterSpacing)));
 r.geometry={...fp,alongX,ridgeLength,cross,span,rise,spacing};
 if(!(s.snowLoad>=0)){issue('error','Charge de neige sur toiture non renseignée : calcul de section suspendu.');return r;}if(!(s.windPressure>=0))issue('warning','Pression/succion de vent non renseignée : section gravitaire calculable, assemblages et soulèvement non vérifiés.');
 let section={b:s.b,h:s.h},check=beamCheck(span,spacing,section.b,section.h,s.deadLoad,s.snowLoad);
 if(s.autoSection){const cs=[];for(const b of [45,63,75,100,120])for(const h of [120,145,170,195,220,245,270,300,340])if(h>=b&&h/b<=7){const c=beamCheck(span,spacing,b,h,s.deadLoad,s.snowLoad);if(c.screened)cs.push(c);}cs.sort((a,b)=>a.b*a.h-b.b*b.h||a.h-b.h);if(!cs.length){issue('error','Aucune section C24 d’essai ne satisfait le filtre EC5 simplifié : prévoir pannes/appuis ou autre système.');return r;}check=cs[0];section={b:check.b,h:check.h};}
 r.section=section;r.check=check;if(!check.screened){issue('error','Section saisie insuffisante selon le filtre EC5 simplifié.');return r;}
 const level=(model.levels||[]).find(l=>l.id===s.supportLevelId),eaveZ=(Number(level?.elevation)||0)+(Number(level?.height)||0),over=s.overhang,dirCount=Math.ceil(ridgeLength/spacing)+1,actual=ridgeLength/(dirCount-1||1);r.count=dirCount*2;
 const common={generator:TAG,mode:'construction',levelId:'roof',type:'slopedBeam',role:'rafters',width:section.b/1000,height:section.h/1000,locked:true,designStatus:'prestudy'};
 for(let k=0;k<dirCount;k++){const t=k*actual;if(alongX){const x=fp.minX+t,y1=fp.minY-over,y2=fp.maxY+over,ym=(fp.minY+fp.maxY)/2;r.elements.push({...common,id:TAG+':a:'+k,a:{x,y:y1,z:eaveZ},b:{x,y:ym,z:eaveZ+rise}});r.elements.push({...common,id:TAG+':b:'+k,a:{x,y:y2,z:eaveZ},b:{x,y:ym,z:eaveZ+rise}});}else{const y=fp.minY+t,x1=fp.minX-over,x2=fp.maxX+over,xm=(fp.minX+fp.maxX)/2;r.elements.push({...common,id:TAG+':a:'+k,a:{x:x1,y,z:eaveZ},b:{x:xm,y,z:eaveZ+rise}});r.elements.push({...common,id:TAG+':b:'+k,a:{x:x2,y,z:eaveZ},b:{x:xm,y,z:eaveZ+rise}});}}
 r.elements.push({generator:TAG,mode:'construction',levelId:'roof',type:'slopedBeam',role:'ridge',width:section.b/1000,height:section.h/1000,locked:true,designStatus:'prestudy',id:TAG+':ridge',a:alongX?{x:fp.minX-over,y:(fp.minY+fp.maxY)/2,z:eaveZ+rise}:{x:(fp.minX+fp.maxX)/2,y:fp.minY-over,z:eaveZ+rise},b:alongX?{x:fp.maxX+over,y:(fp.minY+fp.maxY)/2,z:eaveZ+rise}:{x:(fp.minX+fp.maxX)/2,y:fp.maxY+over,z:eaveZ+rise}});
 if(s.windPressure>=0)r.upliftReaction=s.windPressure*spacing*span/2;issue('warning','Préétude EC5 : assemblages, appuis, stabilité globale, contreventement, feu, durabilité et règles complètes NF DTU 31.1 restent à vérifier.');r.complete=true;return r;
}
const api={TAG,defaults,settings,footprint,beamCheck,report};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root){root.PBPRoof=api;root.PBPRoofReady=true;}
})(typeof window!=='undefined'?window:globalThis);
