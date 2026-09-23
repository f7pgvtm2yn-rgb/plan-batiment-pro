/* PBP v0.7: preliminary checks ONLY; never an execution design or compliance certificate. */
(function(root){
'use strict';
const TAG='pbp-floors-v1',G0=9.80665,EPS=.004;
const SOURCES={
  clay:'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000042238448',
  slab:'https://www.boutique.afnor.org/fr-fr/norme/nf-dtu-133-p112/travaux-de-dallages-conception-calcul-et-execution-partie-112-cahier-des-cl/fa190588/317419',
  timber:'https://www.boutique.afnor.org/fr-fr/norme/nf-en-199511-compil-2/eurocode-5-conception-et-calcul-des-structures-en-bois-partie-11-generalite/fa191476/318309',
  annex:'https://www.boutique.afnor.org/fr-fr/norme/nf-en-199511-na/eurocode-5-conception-et-calcul-des-structures-en-bois-partie-11-generalite/fa163225/35259',
  guide:'https://www.codifab.fr/actions-collectives/guide-dinitiation-la-charpente-575',
  vibration:'https://www.fcba.fr/travaux/vibois-comportement-vibratoire-plancher-bois-et-confort-lie-a-la-marche/'
};
const num=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const clone=v=>JSON.parse(JSON.stringify(v));
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const isSupport=e=>e&&e.mode==='construction'&&!e.generator&&['wallExterior','wallBearing','beam'].includes(e.type)&&finitePoint(e.a)&&finitePoint(e.b)&&dist(e.a,e.b)>.05;
const makeIssue=(code,text,severity='warning')=>({code,text,severity});
function defaults(){return {schema:1,foundation:{autoDepth:false,stripScope:false,frostDepth:null,studyDepth:null,minFootingHeight:null,minBeamHeight:null},floors:[]};}
function floorDefaults(){return {id:'',name:'Plancher',levelId:'r1',sourceLevelId:'ground',supportA:'',supportB:'',system:'wood',enabled:true,spacing:.4,b:75,h:225,autoSection:false,grade:'unknown',service:1,restraint:false,transfer:'unknown',loadsConfirmed:false,panel:22,panelDensity:650,screed:0,screedDensity:2000,finishes:.15,ceiling:.15,insulation:.1,partitions:.5,q:1.5,p:2,finishThickness:15,ceilingThickness:13,slabThickness:null,houseScope:false,clearHeight:2.5,deflection:300,showDeck:false};}
function settings(value){
 const d=defaults();if(!value||typeof value!=='object')return d;
 const f=value.foundation||{};d.foundation.autoDepth=f.autoDepth===true;d.foundation.stripScope=f.stripScope===true;
 for(const k of ['frostDepth','studyDepth','minFootingHeight','minBeamHeight'])d.foundation[k]=num(f[k]);
 if(Array.isArray(value.floors))d.floors=value.floors.slice(0,100).filter(f=>f&&typeof f==='object').map(f=>({...floorDefaults(),...clone(f)}));
 return d;
}
function foundation(model){
 const a=model.foundationAutomation||{},s=settings(model.structureDesign).foundation,issues=[],limits=[];
 for(const [k,label] of [['frostDepth','Hors-gel'],['studyDepth','Étude de sol']]){
  const v=num(s[k]);if(v===null)issues.push(makeIssue(k,label+' non renseigné : minimum complet indéterminé.'));else if(v<0)issues.push(makeIssue(k,label+' : profondeur négative invalide.','error'));else limits.push({label,value:v});
 }
 if(num(a.minDepth)!==null&&a.minDepth>=0)limits.push({label:'Prescription saisie en v0.6',value:+a.minDepth});
 if(a.rgaMethod==='standard'&&['medium','high'].includes(a.rga)){
  limits.push({label:'Seuil argiles — voie dispositions types',value:a.rga==='high'?1.2:.8});
  issues.push(makeIssue('clay','Seuil partiel : la voie dispositions types impose aussi les autres dispositions de l’arrêté, dont le vide sanitaire hors sous-sol. Exception de sol dur à justifier par étude.'));
 }else if(a.rgaMethod!=='study'||!a.soilRef)issues.push(makeIssue('clay','Voie applicable au risque argiles et prescriptions du projet à déterminer.'));
 const minimum=limits.length?Math.max(...limits.map(x=>x.value)):null;
 const terrain=num(a.terrainZ),oldBase=num(a.baseZ)??num((model.levels||[]).find(l=>l.id===(a.targetLevelId||'foundations'))?.elevation);
 const effective={...a};let proposedBase=oldBase;
 if(s.autoDepth&&terrain!==null&&minimum!==null&&oldBase!==null)proposedBase=Math.min(oldBase,terrain-minimum);
 if(proposedBase!==null)effective.baseZ=proposedBase;
 if(s.autoDepth){
  const minH=num(s.minFootingHeight),minB=num(s.minBeamHeight);
  if(minH!==null&&minH>0){effective.padHeight=Math.max(num(a.padHeight)??.3,minH);effective.stripHeight=Math.max(num(a.stripHeight)??.3,minH);}
  if(minB!==null&&minB>0)effective.beamHeight=Math.max(num(a.beamHeight)??.4,minB);
 }
 if(terrain===null)issues.push(makeIssue('terrain','Renseigner l’altitude du terrain horizontal : aucun abaissement automatique sans ce repère.'));
 const depth=terrain!==null&&proposedBase!==null?terrain-proposedBase:null;
 if(depth!==null&&minimum!==null&&depth<minimum-1e-8)issues.push(makeIssue('depth','Profondeur dessinée inférieure au plus grand seuil connu.','error'));
 if(s.stripScope&&a.system==='strips'){
  if(s.autoDepth){effective.stripHeight=Math.max(num(effective.stripHeight)??.3,.2);effective.stripWidth=Math.max(num(effective.stripWidth)??.6,.4);}
  if((num(effective.stripHeight)??.3)<.2||(num(effective.stripWidth)??.6)<.4)issues.push(makeIssue('strip-min','Semelle filante dans le domaine NF DTU 13.1 : seuils d’exécution de 0,20 m en hauteur et 0,40 m en largeur non atteints.','error'));
  issues.push(makeIssue('strip-rule','Semelles filantes : 20 cm de hauteur et 40 cm de largeur sont des planchers d’exécution, pas des sections justifiées pour vos charges.'));
 }
 if(num(s.minFootingHeight)===null)issues.push(makeIssue('height','Semelles isolées et longrines : épaisseur/hauteur à justifier par le bureau d’études. Le seuil de semelle filante ne leur est pas transposé.'));
 return {effective,minimum,limits,depth,proposedBase,partial:true,issues};
}
function bay(model,f){
 const es=model.elements||[],a=es.find(e=>e.id===f.supportA),b=es.find(e=>e.id===f.supportB);
 if(!isSupport(a)||!isSupport(b)||a.id===b.id||a.levelId!==f.sourceLevelId||b.levelId!==f.sourceLevelId)throw Error('Choisir deux murs porteurs ou poutres distincts sur le niveau des appuis.');
 const len=dist(a.a,a.b),u={x:(a.b.x-a.a.x)/len,y:(a.b.y-a.a.y)/len},v={x:-u.y,y:u.x};
 const lenB=dist(b.a,b.b),ub={x:(b.b.x-b.a.x)/lenB,y:(b.b.y-b.a.y)/lenB};
 if(Math.abs(u.x*ub.y-u.y*ub.x)>1e-5)throw Error('Appuis non parallèles : le calcul simplifié et le tracé automatique sont suspendus.');
 const wa=num(a.thickness),wb=num(b.thickness);
 if(wa===null||wb===null||wa<=0||wb<=0)throw Error('Épaisseur des deux appuis à renseigner.');
 const y=dot(sub(b.a,a.a),v),L=Math.abs(y),clear=L-(wa+wb)/2;
 let low=Math.max(0,Math.min(dot(sub(b.a,a.a),u),dot(sub(b.b,a.a),u)));
 let high=Math.min(len,Math.max(dot(sub(b.a,a.a),u),dot(sub(b.b,a.a),u)));
 if(clear<.2||high-low<.2)throw Error('Appuis trop proches ou sans recouvrement suffisant.');
 const p=(x,t)=>({x:a.a.x+u.x*x+v.x*t,y:a.a.y+u.y*x+v.y*t});
 return {a,b,u,v,y,L,clear,low,high,width:high-low,area:L*(high-low),corners:[p(low,0),p(high,0),p(high,y),p(low,y)],point:p};
}
function mass(f){
 const wood=f.system==='wood',t=wood?Number(f.panel)/1000:Number(f.slabThickness)/1000;
 const supportG=wood?t*Number(f.panelDensity)*G0/1000:t*25;
 const screed=Number(f.screed)/1000*Number(f.screedDensity)*G0/1000;
 return supportG+screed+Number(f.finishes)+Number(f.ceiling)+Number(f.insulation)+Number(f.partitions);
}
// Simple rectangular C24 beam, two simple supports. Dimensions are NET mm.
// No system/size benefit. EC5 indicative factors explicitly exposed in docs.
function beamCheck(f,L,spacing,b,h){
 const E=11000,G=690,rho=420,kdef=Number(f.service)===2?.8:.6;
 const I=b*h*h*h/12,A=b*h,W=b*h*h/6,mm=L*1000;
 const g=mass(f)*spacing+rho*G0/1000*(b/1000)*(h/1000),q=Number(f.q)*spacing,P=Number(f.p)*1000;
 const uniform=w=>5*w*mm**4/(384*E*I)+w*mm**2/(8*(5/6)*G*A);
 const point=p=>p*mm**3/(48*E*I)+p*mm/(4*(5/6)*G*A);
 const cases=[{w:1.35*g,p:0,k:.6},{w:1.35*g+1.5*q,p:0,k:.8},{w:1.35*g,p:1.5*P,k:.8}];
 let flex=0,shear=0,reaction=0;
 for(const c of cases){const M=c.w*mm**2/8+c.p*mm/4,V=c.w*mm/2+c.p;flex=Math.max(flex,(M/W)/(c.k*24/1.3));shear=Math.max(shear,(1.5*V/(.67*A))/(c.k*4/1.3));reaction=Math.max(reaction,V/1000);}
 const instant=Math.max(uniform(q),point(P)),final=Math.max(uniform(g)*(1+kdef)+uniform(q)*(1+.3*kdef),uniform(g)*(1+kdef)+point(P)*(1+.3*kdef));
 const point1=point(1000),frequency=Math.PI/(2*L*L)*Math.sqrt((E*1e6*(I*1e-12))/((g+.3*q)*1000/G0));
 const ratios={flexion:flex,cisaillement:shear,flecheInstantanee:instant/(mm/300),flecheFinale:final/(mm/Number(f.deflection)),souplesse1kN:point1/1.5,frequenceIndicative:8/frequency};
 return {b,h,g,q,G:mass(f)+rho*G0/1000*(b/1000)*(h/1000)/spacing,instant,final,point1,frequency,reaction,ratios,screened:Object.values(ratios).every(v=>Number.isFinite(v)&&v<=1),kdef};
}
function validateFloor(f){
 const bounds={spacing:[.15,1],b:[35,300],h:[80,600],panel:[0,100],panelDensity:[100,2000],screed:[0,250],screedDensity:[100,3000],finishes:[0,20],ceiling:[0,20],insulation:[0,20],partitions:[0,20],q:[0,20],p:[0,50],clearHeight:[1,8],finishThickness:[0,200],ceilingThickness:[0,200]};
 for(const [k,[lo,hi]] of Object.entries(bounds)){const v=num(f[k]);if(v===null||v<lo||v>hi)throw Error('Valeur invalide : '+k+' ('+lo+' à '+hi+').');}
 if(!['wood','concrete','ground'].includes(f.system))throw Error('Type de plancher inconnu.');
 if(![300,400,500].includes(+f.deflection)||![1,2].includes(+f.service))throw Error('Hypothèses de calcul non prises en charge.');
 if(f.system!=='wood'&&(num(f.slabThickness)===null||f.slabThickness<=0||f.slabThickness>1000))throw Error('Saisir l’épaisseur du béton ; aucune épaisseur portée n’est devinée.');
}
function floorReport(model,input){
 const f={...floorDefaults(),...input},r={floor:f,issues:[],elements:[],check:null,suggestion:null,geometry:null,validForConstruction:false};
 const issue=(c,t,s)=>r.issues.push(makeIssue(c,t,s));
 try{
  validateFloor(f);const geo=bay(model,f);r.geometry=geo;
  const target=(model.levels||[]).find(l=>l.id===f.levelId),source=(model.levels||[]).find(l=>l.id===f.sourceLevelId);
  if(!target||!source||!Number.isFinite(target.elevation)||!Number.isFinite(source.elevation))throw Error('Niveaux ou altitudes invalides.');
  if(f.system==='ground'&&target.id!==source.id)throw Error('Un dallage sur sol doit rester sur le niveau de ses murs de contour.');
  if(f.system!=='ground'&&target.elevation<=source.elevation)throw Error('Le plancher porté doit être au-dessus du niveau de ses appuis.');
  let blocked=false;
  const contains=p=>{const z=sub(p,geo.a.a),x=dot(z,geo.u),y=dot(z,geo.v);return x>geo.low+EPS&&x<geo.high-EPS&&y>Math.min(0,geo.y)+EPS&&y<Math.max(0,geo.y)-EPS;};
  for(const el of model.elements||[]){
   if(el.mode!=='construction'||el.generator||el.levelId!==f.levelId)continue;
   if(['wallExterior','wallBearing','column'].includes(el.type)){
    let inside=false;
    if(finitePoint(el.a)&&finitePoint(el.b)){
     const p=sub(el.a,geo.a.a),q=sub(el.b,geo.a.a),aa=[dot(p,geo.u),dot(p,geo.v)],bb=[dot(q,geo.u),dot(q,geo.v)];
     let t0=0,t1=1;const lo=[geo.low+EPS,Math.min(0,geo.y)+EPS],hi=[geo.high-EPS,Math.max(0,geo.y)-EPS];
     for(let d=0;d<2;d++){const delta=bb[d]-aa[d];if(Math.abs(delta)<1e-10){if(aa[d]<lo[d]||aa[d]>hi[d])t1=-1;}else{let x=(lo[d]-aa[d])/delta,y=(hi[d]-aa[d])/delta;if(x>y)[x,y]=[y,x];t0=Math.max(t0,x);t1=Math.min(t1,y);}}
     inside=t0<=t1;
    }else if(finitePoint({x:el.x,y:el.y}))inside=contains({x:el.x,y:el.y});
    if(inside){blocked=true;issue('transfer','Mur porteur ou poteau détecté sur la travée : reprise ponctuelle/linéaire non calculée.','error');break;}
   }
  }
  if((model.elements||[]).some(e=>e.mode==='construction'&&e.levelId===f.levelId&&e.type==='opening')){blocked=true;issue('opening','Une trémie existe à ce niveau : pas de découpe automatique, chevêtres à étudier.','error');}
  const fa=model.foundationAutomation||{};
  if(f.system==='ground'){
   if(!f.houseScope||Number(f.q)>2.5)issue('slab-scope','Seuil de 120 mm non applicable automatiquement : confirmer le domaine maison individuelle et les charges ≤ 2,5 kN/m².','error');
   else if(Number(f.slabThickness)<120)issue('slab-min','Dallage maison individuelle : épaisseur béton saisie inférieure au seuil de 120 mm du NF DTU 13.3 P1-1-2.','error');
   if(fa.rgaMethod==='standard'&&['medium','high'].includes(fa.rga)){blocked=true;issue('clay-ground','Voie argiles dispositions types sélectionnée : en l’absence de sous-sol, un vide sanitaire est prévu. Ne pas valider un terre-plein par ce seuil.','error');}
  }
  const n=Math.ceil(geo.width/Number(f.spacing)),spacing=geo.width/n;
  if(n>250)throw Error('Trop de solives pour une travée ; réduire la zone.');
  r.spacing=spacing;r.count=n+1;r.G=mass(f);r.area=geo.area;
  if(f.system==='wood'){
   if(geo.L>8)throw Error('Portée supérieure à 8 m : hors du comparateur de sections en bois massif.');
   if(f.transfer!=='none'){blocked=true;issue('load-path','Cheminement des charges à préciser : le comparateur ne reprend ni étage, ni mur, ni poteau sur les solives.','error');}
   if(f.grade!=='C24'||!f.restraint||!f.loadsConfirmed){blocked=true;issue('assumptions','Confirmer bois C24, maintien latéral prévu et charges du scénario avant la recherche de section.','error');}
   if(f.q<1.5||f.p<2){blocked=true;issue('usage','Scénario habitation : Q < 1,5 kN/m² ou charge ponctuelle < 2 kN. Vérifier l’usage ; recherche automatique suspendue.','error');}
   if(!blocked&&f.autoSection){
    const candidates=[];
    for(const b of [45,63,75,100,120])for(const h of [145,170,195,220,245,270,300,340,400])if(h>=b&&h/b<=6){const c=beamCheck(f,geo.L,spacing,b,h);if(c.screened)candidates.push(c);}
    candidates.sort((a,b)=>a.b*a.h-b.b*b.h||a.h-b.h);r.suggestion=candidates[0]||null;
    if(!r.suggestion){blocked=true;issue('section','Aucune section d’essai ne satisfait les filtres partiels ; ajouter un appui ou faire étudier une autre structure.','error');}
   }
   r.check=beamCheck(f,geo.L,spacing,r.suggestion?.b??Number(f.b),r.suggestion?.h??Number(f.h));r.G=mass(f)+(n+1)*geo.L/geo.area*420*G0/1000*(r.check.b/1000)*(r.check.h/1000);r.hypothetical=blocked;
   if(!r.check.screened){blocked=true;issue('screen','Au moins un critère du comparateur est dépassé. Tracé du solivage suspendu ; ne pas utiliser cette section en exécution.','error');}
   issue('panel','Panneau de plancher : épaisseur saisie, pas dimensionnée. Vérifier le tableau fabricant/DTU 51.3, joints, appuis de rives et charges concentrées.');
   issue('incomplete','Comparaison partielle seulement : vibrations complètes, appuis, assemblages, déversement réel, feu, acoustique, eau et stabilité du bâtiment non validés.');
  }else if(f.system==='concrete')issue('concrete','Dalle portée : épaisseur renseignée, pas calculée. Étude béton/ferraillage ou étude du fabricant de plancher requise.');
  const coreH=f.system==='wood'?r.check.h/1000:Number(f.slabThickness)/1000;
  const topLayers=(f.system==='wood'?Number(f.panel)/1000:0)+Number(f.screed)/1000+Number(f.finishThickness)/1000;
  r.totalThickness=coreH+topLayers+Number(f.ceilingThickness)/1000;
  r.suggestedElevation=source.elevation+Number(f.clearHeight)+r.totalThickness;
  r.clearHeight=target.elevation-source.elevation-r.totalThickness;
  r.baseZ=target.elevation-topLayers-coreH;
  if(f.system!=='ground'){
   if(r.clearHeight<Number(f.clearHeight)-.001)issue('headroom','Hauteur libre dessinée inférieure à votre objectif (objectif de projet, pas minimum légal universel).');
   if([geo.a,geo.b].some(w=>Math.abs(source.elevation+Number(w.height)-r.baseZ)>.01))issue('support-z','Arase des appuis et sous-face du plancher non coordonnées : régler les hauteurs avant exploitation.','error');
  }
  r.label=f.system==='wood'?(Number(f.screed)>0?'Bois avec chape — composition alourdie':'Bois sans chape — composition légère déclarée'):(f.system==='ground'?'Dallage sur terre-plein':'Plancher béton — composition lourde déclarée');
  r.massKg=r.G*1000/G0;
  r.permanentTotal=r.area*r.G;r.variableTotal=r.area*Number(f.q);
  if(f.system!=='ground'){r.lineG=r.G*geo.L/2;r.lineQ=Number(f.q)*geo.L/2;}
  r.blocked=blocked;
  if(f.enabled&&!blocked){
   const common={generator:TAG,mode:'construction',levelId:f.levelId,locked:true,designStatus:'prestudy',floorId:f.id};
   if(f.system==='wood')for(let i=0;i<=n;i++){
    const x=geo.low+spacing*i;r.elements.push({...common,id:'joist:'+f.id+':'+i,type:'beam',floorRole:'joist',a:geo.point(x,0),b:geo.point(x,geo.y),thickness:r.check.b/1000,height:coreH,zBase:r.baseZ});
   }
   if(f.system!=='wood'||f.showDeck)r.elements.push({...common,id:'deck:'+f.id,type:'slab',floorRole:'deck',polygon:geo.corners,zBase:f.system==='wood'?r.baseZ+coreH:r.baseZ,height:f.system==='wood'?Number(f.panel)/1000:coreH});
  }
 }catch(error){issue('invalid',error.message,'error');}
 return r;
}
function report(model){
 const s=settings(model.structureDesign),floors=s.floors.map(f=>floorReport(model,f));
 const source=model.foundationAutomation?.sourceLevelId||'ground',base=(model.levels||[]).find(l=>l.id===source)?.elevation??0;
 const missing=(model.levels||[]).filter(l=>l.id!=='roof'&&l.id!=='foundations'&&l.elevation>base&&!s.floors.some(f=>f.levelId===l.id));
 return {floors,foundation:foundation(model),missing,elements:floors.flatMap(r=>r.elements),globalNotice:'Chaque étage exige une descente de charges jusqu’aux fondations. Les charges des étages ne sont PAS multipliées arbitrairement sur les solives inférieures.'};
}
const api={TAG,SOURCES,defaults,floorDefaults,settings,foundation,bay,mass,beamCheck,floorReport,report,isSupport};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.PBPStructure=api;
})(typeof window!=='undefined'?window:globalThis);
