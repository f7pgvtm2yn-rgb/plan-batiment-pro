/* Plan Batiment Pro v0.10.17 — guided foundation prestudy linking NF P94-261 / Eurocode 7 with NF DTU 13.1. NOT an execution validation. */
(function(root){
'use strict';
const TAG='pbp-foundations-v1', EPS=.004, MAX_PARTS=1000;
const defaults=()=>({schema:2,enabled:false,hideDemo:true,sourceLevelId:'ground',targetLevelId:'foundations',system:'longrines',
  beamWidth:.32,beamHeight:.40,padWidth:.80,padLength:.80,padHeight:.30,
  stripWidth:.60,stripHeight:.30,baseZ:null,topOffset:0,maxSpacing:null,
  terrainZ:null,minDepth:null,rga:'unknown',rgaMethod:'unknown',soilRef:'',structureRef:'',
  postalCode:'',address:'',communeName:'',inseeCode:'',locationLon:null,locationLat:null,locationPrecision:'none',rgaSource:'manual',
  autoSizing:true,autoDepth:true,soilDesignResistance:null,lineLoadEd:null,
  ruleVersion:'NF P94-261 COMPIL1 2017 + NF DTU 13.1 P1-1 2019 + RGA 2026'});
const positive=(v,f)=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):f;
const nullable=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
function settings(input){
  const d=defaults(),s={...d};input=input&&typeof input==='object'?input:{};
  s.enabled=input.enabled===true;
  s.hideDemo=input.hideDemo!==false;
  for(const k of ['sourceLevelId','targetLevelId','soilRef','structureRef','postalCode','address','communeName','inseeCode','locationPrecision','rgaSource','ruleVersion'])if(typeof input[k]==='string')s[k]=input[k].slice(0,250);
  for(const k of ['beamWidth','beamHeight','padWidth','padLength','padHeight','stripWidth','stripHeight'])s[k]=positive(input[k],d[k]);
  for(const k of ['baseZ','terrainZ','minDepth','maxSpacing','locationLon','locationLat','soilDesignResistance','lineLoadEd'])s[k]=nullable(input[k]);
  if(s.minDepth!==null&&s.minDepth<0)s.minDepth=null;
  if(s.maxSpacing!==null&&s.maxSpacing<=0)s.maxSpacing=null;
  s.topOffset=nullable(input.topOffset)??0;
  s.autoSizing=input.autoSizing!==false;s.autoDepth=input.autoDepth!==false;
  if(['longrines','strips'].includes(input.system))s.system=input.system;
  if(['unknown','low','medium','high'].includes(input.rga))s.rga=input.rga;
  if(['unknown','study','standard'].includes(input.rgaMethod))s.rgaMethod=input.rgaMethod;
  return s;
}
const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const at=(w,t)=>({x:w.a.x+(w.b.x-w.a.x)*t,y:w.a.y+(w.b.y-w.a.y)*t});
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const generated=e=>e?.generator===TAG;
const rgaDepth=s=>s.rgaMethod==='standard'?(s.rga==='high'?1.20:s.rga==='medium'?.80:null):null;
function normativeInputs(s){
  const rgaMin=rgaDepth(s),manual=s.minDepth,depths=[manual,rgaMin].filter(Number.isFinite),requiredDepth=depths.length?Math.max(...depths):null;
  const qRd=nullable(s.soilDesignResistance),lineLoadEd=nullable(s.lineLoadEd),geotechReady=qRd>0&&lineLoadEd>0;
  return {rgaMin,manualMin:manual,requiredDepth,qRd,lineLoadEd,geotechReady,stripWidth:geotechReady?lineLoadEd/qRd:null};
}
function demoIds(elements){
  const points=[[-4,-3,4,-3],[4,-3,4,3],[4,3,-4,3],[-4,3,-4,-3]];
  const ids=[];
  for(let i=0;i<4;i++){
    const matches=elements.filter(e=>e.id==='demo-f'+(i+1));
    if(matches.length!==1)return [];
    const e=matches[0],p=points[i];
    if(e.type!=='foundation'||e.mode!=='construction'||e.levelId!=='foundations'||!point(e.a)||!point(e.b)||e.thickness!==.5||e.height!==.5||distance(e.a,{x:p[0],y:p[1]})>1e-9||distance(e.b,{x:p[2],y:p[3]})>1e-9)return [];
    ids.push(e.id);
  }
  return ids;
}
function compute(model){
  const s=settings(model.foundationAutomation),original=model.elements||[],levels=model.levels||[];
  const hidden=s.hideDemo?demoIds(original):[];
  const all=original.filter(e=>!hidden.includes(e.id));
  const source=levels.find(l=>l.id===s.sourceLevelId),target=levels.find(l=>l.id===s.targetLevelId);
  const rules=normativeInputs(s),report={elements:[],issues:[],wallCount:0,totalLength:0,spanCount:0,padCount:0,maxSpan:0,depth:null,baseZ:null,topZ:null,settings:s,standards:{rules:s.ruleVersion,geotech:null,dtu:null,rga:null,retained:null}};
  const issue=(code,text,severity='warning')=>{if(!report.issues.some(x=>x.code===code))report.issues.push({code,text,severity});};
  if(!s.enabled)return report;
  issue('prestudy','Préétude guidée : aucune conformité structurelle, géotechnique ou d’exécution n’est certifiée par le logiciel.');
  issue('standards-link','Chaîne de contrôle : NF P94-261 / Eurocode 7 pour la justification géotechnique ; NF DTU 13.1 pour le domaine et la mise en œuvre. Le DTU ne remplace pas le calcul géotechnique.');
  if(!source||!target||source.id===target.id){issue('levels','Choisir deux niveaux distincts : murs sources et fondations.','error');return report;}
  const prescribedDepth=rules.requiredDepth;
  const base=s.autoDepth&&s.terrainZ!==null&&Number.isFinite(prescribedDepth)?s.terrainZ-prescribedDepth:(s.baseZ??Number(target.elevation)),top=Number(source.elevation)+s.topOffset;
  report.baseZ=base;report.topZ=top;
  report.standards.rga={exposure:s.rga,method:s.rgaMethod,minimumDepth:rules.rgaMin,source:s.rgaSource,locationPrecision:s.locationPrecision};
  report.standards.geotech={qRd:rules.qRd,lineLoadEd:rules.lineLoadEd,ready:rules.geotechReady,requiredStripWidth:rules.stripWidth,sourceSoil:s.soilRef,sourceLoads:s.structureRef};
  report.standards.dtu={reference:'NF DTU 13.1 P1-1 (2019)',scope:'mise en œuvre des fondations superficielles/semi-profondes',executionValidated:false};
  if(!Number.isFinite(base)||!Number.isFinite(top)||base>=top){issue('vertical','La sous-face des fondations doit être sous le niveau d’appui des murs.','error');return report;}
  const raw=all.filter(e=>!generated(e)&&e.mode==='construction'&&e.type==='wallExterior'&&e.levelId===source.id);
  const walls=[];
  for(const w of raw){
    if(!point(w.a)||!point(w.b)||distance(w.a,w.b)<.05){issue('short','Un mur extérieur nul, trop court ou invalide est exclu.','error');continue;}
    if(walls.some(v=>(distance(v.a,w.a)<=EPS&&distance(v.b,w.b)<=EPS)||(distance(v.a,w.b)<=EPS&&distance(v.b,w.a)<=EPS))){issue('duplicates','Des murs extérieurs en doublon sont ignorés pour la génération.','error');continue;}
    walls.push(w);
  }
  report.wallCount=walls.length;
  report.totalLength=walls.reduce((n,w)=>n+distance(w.a,w.b),0);
  if(!walls.length){issue('no-walls','Aucun mur extérieur sur le niveau source choisi. Tracez un mur pour commencer.');return report;}
  const maxWallThickness=walls.reduce((n,w)=>Math.max(n,positive(w.thickness,0)),0);
  const retainedStripWidth=s.autoSizing&&rules.geotechReady?Math.max(maxWallThickness,rules.stripWidth):s.stripWidth;
  report.standards.retained={mode:s.autoSizing?'automatic':'manual',stripWidth:retainedStripWidth,padSide:null,depth:rules.requiredDepth,baseZ:base};
  const fractions=walls.map(()=>[0,1]);
  // Split at real intersections and T junctions; no automatic choice of structural span.
  for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
    const a=walls[i],b=walls[j],r=sub(a.b,a.a),v=sub(b.b,b.a),q=sub(b.a,a.a),den=cross(r,v);
    if(Math.abs(den)>1e-9){
      const t=cross(q,v)/den,u=cross(q,r)/den;
      if(t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9){fractions[i].push(Math.max(0,Math.min(1,t)));fractions[j].push(Math.max(0,Math.min(1,u)));}
    }else if(Math.abs(cross(q,r))<1e-8){
      const rr=r.x*r.x+r.y*r.y;
      const ts=[b.a,b.b].map(p=>((p.x-a.a.x)*r.x+(p.y-a.a.y)*r.y)/rr);
      if(Math.min(1,Math.max(...ts))-Math.max(0,Math.min(...ts))>EPS/distance(a.a,a.b))issue('overlap','Des axes extérieurs colinéaires se chevauchent : vérifier le contour avant exploitation.','error');
    }
  }
  const nodes=[],spans=[];
  function node(p,wallId,anchor){
    let n=nodes.find(n=>distance(n.p,p)<=EPS);
    if(!n){n={p:{...p},anchors:[],degree:0};nodes.push(n);}
    n.anchors.push(wallId+':'+anchor);return n;
  }
  let limited=false;
  for(let i=0;i<walls.length;i++){
    const w=walls[i],ts=fractions[i].sort((a,b)=>a-b).filter((t,k,a)=>!k||t-a[k-1]>1e-8);
    for(let k=0;k<ts.length-1;k++){
      const from=ts[k],to=ts[k+1],length=distance(at(w,from),at(w,to));
      let count=s.system==='longrines'&&s.maxSpacing?Math.max(1,Math.ceil(length/s.maxSpacing)):1;
      if(count>MAX_PARTS||spans.length+count>MAX_PARTS){limited=true;break;}
      for(let j=0;j<count;j++){
        const t0=from+(to-from)*j/count,t1=from+(to-from)*(j+1)/count;
        const a=node(at(w,t0),w.id,t0.toFixed(8)),b=node(at(w,t1),w.id,t1.toFixed(8));
        if(a===b)continue;
        a.degree++;b.degree++;
        spans.push({id:String(w.id)+':'+t0.toFixed(8)+':'+t1.toFixed(8),wall:w,a,b,length:distance(a.p,b.p)});
      }
    }
    if(limited)break;
  }
  if(limited){issue('limit','Génération arrêtée : trop de tronçons. Augmentez l’entraxe de dessin ou simplifiez le plan.','error');return report;}
  let retainedPadSide=Math.max(s.padWidth,s.padLength);
  if(s.autoSizing&&rules.geotechReady){
    const tributary=new Map(nodes.map(n=>[n,0]));
    for(const sp of spans){tributary.set(sp.a,(tributary.get(sp.a)||0)+sp.length/2);tributary.set(sp.b,(tributary.get(sp.b)||0)+sp.length/2);}
    let req=0;for(const n of nodes){const load=rules.lineLoadEd*(tributary.get(n)||0),side=Math.sqrt(Math.max(0,load/rules.qRd));req=Math.max(req,side);}
    retainedPadSide=Math.max(s.beamWidth,maxWallThickness,req);
    report.standards.geotech.requiredPadSide=req;report.standards.geotech.padMethod='charge linéique × longueur tributaire / qRd, semelle carrée de préétude';
  }
  report.standards.retained.padSide=retainedPadSide;
  if(nodes.some(n=>n.degree===1))issue('open','Le contour comporte des extrémités libres. La génération reste un tracé partiel.');
  if(nodes.some(n=>n.degree>2))issue('branches','Une jonction de plus de deux axes demande un détail de liaison spécifique.');
  const common={mode:'construction',levelId:target.id,generator:TAG,locked:true,designStatus:'not-designed'};
  if(s.system==='longrines'){
    const beamBase=top-s.beamHeight,padTop=base+s.padHeight,gap=beamBase-padTop;
    if(gap<-1e-6){issue('stack','Les semelles et longrines se chevauchent en hauteur : abaisser la sous-face ou revoir les hauteurs.','error');return report;}
    nodes.forEach(n=>{
      const id=n.anchors.slice().sort().join('|'),x=n.p.x,y=n.p.y;
      report.elements.push({...common,id:'auto:pad:'+id,type:'slab',foundationRole:'pad',x,y,width:retainedPadSide,depth:retainedPadSide,height:s.padHeight,zBase:base});
      if(gap>1e-6)report.elements.push({...common,id:'auto:pedestal:'+id,type:'column',foundationRole:'pedestal',x,y,width:s.beamWidth,depth:s.beamWidth,height:gap,zBase:padTop});
    });
    spans.forEach(e=>report.elements.push({...common,id:'auto:beam:'+e.id,type:'beam',foundationRole:'longrine',sourceWallId:e.wall.id,a:{...e.a.p},b:{...e.b.p},thickness:s.beamWidth,height:s.beamHeight,zBase:beamBase}));
    report.padCount=nodes.length;report.spanCount=spans.length;
    report.maxSpan=spans.reduce((n,e)=>Math.max(n,e.length),0);
    issue('span','Appuis et entraxes géométriques seulement : portées, ferraillage, clavetages et capacité du sol non calculés.');
    if(retainedPadSide<s.beamWidth)issue('pad-size','Un appui représenté est plus étroit que la longrine.','error');
    if(walls.some(w=>Number(w.thickness)>s.beamWidth+1e-6))issue('beam-width','Un mur déborde de la largeur de longrine saisie : vérifier la reprise d’appui.','error');
  }else{
    if(base+s.stripHeight>top+1e-6){issue('stack','La semelle dépasse l’altitude d’appui du mur.','error');return report;}
    spans.forEach(e=>report.elements.push({...common,id:'auto:strip:'+e.id,type:'foundation',foundationRole:'strip',sourceWallId:e.wall.id,a:{...e.a.p},b:{...e.b.p},thickness:retainedStripWidth,height:s.stripHeight,zBase:base}));
    report.spanCount=spans.length;
    issue('substructure','Le soubassement entre semelles et murs n’est pas généré dans ce mode.');
    if(walls.some(w=>Number(w.thickness)>retainedStripWidth+1e-6))issue('strip-width','Un mur est plus large que la semelle retenue.','error');
  }
  if(all.some(e=>!generated(e)&&e.mode==='construction'&&e.levelId===source.id&&['wallBearing','column'].includes(e.type)))issue('internal','Murs porteurs intérieurs et poteaux présents : leurs fondations restent à concevoir séparément.');
  if(all.some(e=>!generated(e)&&e.mode==='construction'&&e.levelId===target.id&&['foundation','beam','slab','column'].includes(e.type)))issue('manual','Des éléments manuels existent au niveau fondations. Ils sont conservés ; vérifier les superpositions.');
  if(!s.soilRef.trim())issue('soil','Étude géotechnique non référencée : le code postal ou Géorisques ne fournit pas la résistance de calcul du sol.');
  if(!s.structureRef.trim())issue('loads','Note structure non référencée : la charge de calcul doit être issue ou confirmée par la descente de charges.');
  if(!rules.geotechReady)issue('geotech-inputs','Dimensionnement géotechnique suspendu : renseigner qRd (résistance de calcul du sol, kPa) et NEd linéique (kN/m). Aucune portance n’est inventée à partir du code postal.');
  else{
    issue('geotech-result','NF P94-261 / EC7 — préétude centrée verticale : largeur théorique de semelle filante NEd/qRd = '+rules.stripWidth.toFixed(3)+' m. Excentricité, inclinaison, pente, eau, tassements et interactions restent à justifier.');
    if(s.autoSizing)issue('auto-size','Dimensions géotechniques automatiques activées : la largeur de semelle / taille des appuis est au moins égale au résultat géotechnique simplifié et à l’épaisseur du mur.');
  }
  issue('scope','NF DTU 13.1 : préparation du fond de fouille, matériaux, implantation, béton/BA et exécution restent à contrôler sur le projet. Hors-gel, pente, mitoyenneté, eau, sismicité et prescriptions locales ne sont pas déduits du seul code postal.');
  if(s.terrainZ===null)issue('terrain','Altitude du terrain non renseignée : profondeur d’assise non vérifiable.');
  else{
    report.depth=s.terrainZ-base;
    if(report.depth<=0)issue('above-ground','La sous-face des fondations n’est pas sous le terrain saisi.','error');
    if(s.minDepth!==null&&report.depth+1e-8<s.minDepth)issue('depth','Profondeur représentée inférieure au minimum prescrit saisi.','error');
  }
  if(s.rga==='unknown')issue('rga','Exposition argiles à vérifier au point du projet sur Géorisques. Un résultat au centre de commune n’est qu’indicatif.');
  if(s.rga==='medium'||s.rga==='high'){
    if(s.rgaMethod==='standard'){
      const limit=s.rga==='high'?1.20:.80;
      if(report.depth===null||report.depth+1e-8<limit)issue('rga-depth','Dispositions types argiles sélectionnées : profondeur à vérifier au regard du seuil '+limit.toFixed(2)+' m (hors exception justifiée par étude).','error');
      issue('rga-complete','Le contrôle d’un seuil de profondeur ne couvre pas les autres dispositions de l’arrêté du 22/07/2020.');
    }else issue('rga-study','En zone argileuse : vérifier la voie applicable et les prescriptions géotechniques ; aucune adaptation automatique de profondeur.');
  }
  return report;
}
const api={TAG,settings,compute,generated,demoIds,normativeInputs,rgaDepth};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.PBPFoundations=api;
})(typeof window!=='undefined'?window:globalThis);
