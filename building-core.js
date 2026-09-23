/* PBP 0.9 : quantities and linked floor levels. NOT a construction design certificate. */
(function(root){'use strict';
const TAG='pbp-building-v09',clone=v=>JSON.parse(JSON.stringify(v));
const num=(x,f=null)=>x!==null&&x!==''&&x!==undefined&&Number.isFinite(Number(x))?Number(x):f;
const positive=(x,f)=>num(x)>0?Number(x):f;
const issue=(text,error=false)=>({text,severity:error?'error':'warning'});
function material(){return {type:'unknown',core:200,insulation:0,inside:0,outside:0,rate:null,studWidth:45,studSpacing:600,rails:2,waste:0,reference:''};}
function technical(){return {location:'plenum',stacked:false,prescribed:null,clearance:null,reference:'',gas:false,networks:[]};}
function settings(v){return {schema:1,materials:clone(v?.materials||{}),floors:Array.isArray(v?.floors)?clone(v.floors).slice(0,25):[]};}
function config(S,below,above){return {...S.floorDefaults(),id:'floor:'+above.id,belowId:below.id,aboveId:above.id,name:'Plancher '+below.name+' → '+above.name,enabled:true,system:'wood',autoSection:true,insulationThickness:0,insulationDensity:30,ravoirage:0,ravoirageDensity:1800,technical:technical(),showAllLayers:true,invert:false};}
function techReport(input){
 const t={...technical(),...input},issues=[],values=[];let complete=true;
 const networks=(t.networks||[]).filter(n=>n.enabled);
 for(const n of networks){
  const d=num(n.diameter),ins=num(n.insulation,0);if(!(d>0)||ins<0){complete=false;issues.push(issue(n.kind+' : diamètre extérieur / isolation à renseigner.',true));continue;}
  let h=d+2*ins;
  if(n.kind==='evacuation'){
   const slope=num(n.slope),run=num(n.length);
   if(slope===null||slope<0||run===null||run<0){complete=false;issues.push(issue('Évacuation : longueur du parcours et pente prescrite manquantes.',true));}
   else h+=run*1000*slope/100;
  }
  values.push(h);
 }
 const geometric=values.length?(t.stacked?values.reduce((a,b)=>a+b,0):Math.max(...values)):0;
 const prescribed=num(t.prescribed),clearance=num(t.clearance);
 if(networks.length&&(prescribed===null||clearance===null||!String(t.reference||'').trim())){complete=false;issues.push(issue('Minimum complet indéterminé : saisir les dégagements et la prescription du système. Le diamètre seul ne valide pas le vide technique.'));}
 if((prescribed!==null&&prescribed<0)||(clearance!==null&&clearance<0)){complete=false;issues.push(issue('Les réservations et jeux ne peuvent pas être négatifs.',true));}
 if(t.location==='structure'&&networks.length){complete=false;issues.push(issue('Aucun percement ou encastrement automatique dans les solives ou dalles porteuses. Réservation à justifier par l’étude structure.',true));}
 if(t.location==='chape'&&networks.length){complete=false;issues.push(issue('Canalisations horizontales : ne pas les incorporer dans une chape / dalle rapportée du domaine DTU 26.2 ; prévoir un ravoirage distinct.',true));}
 if(t.gas){complete=false;issues.push(issue('Gaz : accessibilité, ventilation, fourreau et distances doivent être étudiés spécifiquement. Ce module ne valide pas une installation gaz.',true));}
 if(networks.some(n=>n.kind==='ventilation'))issues.push(issue('Ventilation : diamètre, calorifuge, accessoires, rayons de courbure et accès d’entretien dépendent du réseau et du fabricant.'));
 const required=Math.max(geometric+Math.max(0,clearance||0),Math.max(0,prescribed||0));
 return {geometric,required,complete,issues,networkCount:networks.length,location:t.location};
}
function pairModel(m,face,c,index,G,S){
 const choices=[0,1].map(i=>({i,span:G.dist(face.points[i],face.points[(i+3)%4])})).sort((a,b)=>a.span-b.span||a.i-b.i);
 const side=choices[c.invert?1:0].i,sides=[face.sides[side],face.sides[(side+2)%4]];
 const walls=sides.map((s,j)=>({id:c.id+':proxy:'+index+':'+j,type:'wallBearing',mode:'construction',levelId:c.belowId,a:s.a,b:s.b,thickness:Math.min(...s.members.map(w=>positive(w.thickness,.2))),height:Math.min(...s.members.map(w=>positive(w.height,2.8)))}));
 const f={...S.floorDefaults(),...c,id:c.id+':bay:'+index,levelId:c.aboveId,sourceLevelId:c.belowId,supportA:walls[0].id,supportB:walls[1].id,system:'wood',autoSection:true};
 // Add the new solid layers to the existing study's permanent load, once only.
 f.finishes=Number(f.finishes)+Math.max(0,num(c.ravoirage,0))/1000*positive(c.ravoirageDensity,1800)*9.80665/1000+Math.max(0,num(c.insulationThickness,0))/1000*positive(c.insulationDensity,30)*9.80665/1000;
 return {model:{...m,elements:m.elements.concat(walls)},f};
}
function floorReport(m,c,G,S){
 const levels=m.levels.filter(l=>l.kind!=='floor'),below=levels.find(l=>l.id===c.belowId),above=levels.find(l=>l.id===c.aboveId);
 const r={config:c,issues:[],elements:[],layers:[],bays:[],count:0,area:0,complete:false,validForConstruction:false};
 if(!below||!above||below.id===above.id||above.elevation<=below.elevation){r.issues.push(issue('Deux niveaux d’habitation distincts et ordonnés sont nécessaires.',true));return r;}
 if(!(num(below.height)>0)){r.issues.push(issue('Hauteur du niveau inférieur à renseigner.',true));return r;}
 const t=techReport(c.technical),tech=t.location==='plenum'?t.required/1000:0;
 r.technical=t;r.issues.push(...t.issues);
 r.sourceTop=Number(below.elevation)+Number(below.height);r.top=Number(above.elevation);r.available=r.top-r.sourceTop;r.bottom=r.sourceTop-tech-Math.max(0,num(c.ceilingThickness,0))/1000;r.level={id:c.id,name:c.name||'Plancher '+below.name+' → '+above.name,kind:'floor',autoFloor:true,belowId:below.id,aboveId:above.id,elevation:r.bottom,height:Math.max(0,r.top-r.bottom)};
 const studyConfig={...c,ravoirage:Math.max(num(c.ravoirage,0),t.location==='ravoirage'?t.required:0)};
 const detection=G.faces(m,c.belowId,S);r.issues.push(...detection.issues.map(s=>issue(s)));
 const manual=S.settings(m.structureDesign).floors.filter(f=>f.enabled&&f.levelId===c.aboveId);
 if(manual.length){r.issues.push(issue('Des zones de plancher v0.7 sont encore actives pour cet étage. Désactivez-les avant de générer le nouveau plancher-niveau.',true));return r;}
 const faces=detection.faces.filter(f=>c.system!=='wood'||f.rectangle);
 if(faces.length<detection.faces.length)r.issues.push(issue('Travées non rectangulaires exclues du solivage automatique : le dessin reste partiel.'));
 if(!faces.length){r.issues.push(issue('Aucune emprise compatible fermée ; ne pas inventer d’appui.',true));return r;}
 r.area=faces.reduce((s,f)=>s+f.area,0);
 const sourceTop=Number(below.elevation)+Number(below.height),baseModel={...m,levels:levels.map(l=>l.id===above.id?{...l,elevation:Math.max(above.elevation,sourceTop+1)}:l)};
 let core=positive(c.slabThickness,null),width=null,blocked=false;
 if(c.system==='wood'){
  const first=faces.map((face,i)=>{const p=pairModel(baseModel,face,studyConfig,i,G,S);return S.floorReport(p.model,p.f);});
  if(first.some(b=>!b.suggestion||b.blocked||!b.check?.screened)){blocked=true;r.issues.push(issue('Solivage suspendu : hypothèses, reprise de charges, trémie ou section d’essai à vérifier.',true));}
  core=first.reduce((h,b)=>Math.max(h,b.suggestion?.h||0),0);width=first.reduce((b,r)=>Math.max(b,r.suggestion?.b||0),0);
  r.bays=first;
  if(!core||!width){r.issues.push(...first.flatMap(b=>b.issues.filter(i=>i.severity==='error')));return r;}
 }else if(c.system!=='concrete'||core===null||core>1000){r.issues.push(issue('Dalle portée : épaisseur issue de l’étude béton à saisir (aucun calcul de ferraillage).',true));return r;}
 const mm=k=>Math.max(0,num(c[k],0))/1000;
 const rav=Math.max(mm('ravoirage'),t.location==='ravoirage'?t.required/1000:0),ceiling=mm('ceilingThickness');
 const aboveLayers=[{role:c.system==='wood'?'joists':'concrete',name:c.system==='wood'?'Solives C24 — section d’essai':'Dalle béton portée',h:core/1000},
 ...(c.system==='wood'?[{role:'panel',name:'Panneau bois',h:mm('panel')}]:[]),{role:'insulation',name:'Isolation rapportée',h:mm('insulationThickness')},{role:'ravoirage',name:'Ravoirage',h:rav},{role:'screed',name:'Chape',h:mm('screed')},{role:'finish',name:'Revêtement',h:mm('finishThickness')}].filter(l=>l.h>0);
 if(m.elements.some(e=>S.isSupport(e)&&e.levelId===below.id&&Math.abs(Number(e.height)-Number(below.height))>.01))r.issues.push(issue('Arases réelles des appuis différentes du haut de niveau : coordonner leurs hauteurs. Le dessin ne justifie pas une liaison porteuse.',true));
 r.sourceTop=sourceTop;r.bottom=sourceTop-tech-ceiling;r.top=above.elevation;r.requiredTop=sourceTop+aboveLayers.reduce((s,l)=>s+l.h,0);r.available=above.elevation-sourceTop;r.required=r.requiredTop-sourceTop;r.gap=above.elevation-r.requiredTop;r.totalThickness=r.required+tech+ceiling;r.clearHeight=below.height-tech-ceiling;r.section=c.system==='wood'?{b:width,h:core}:null;
 r.level={id:c.id,name:c.name||'Plancher '+below.name+' → '+above.name,kind:'floor',autoFloor:true,belowId:below.id,aboveId:above.id,elevation:r.bottom,height:Math.max(0,r.top-r.bottom)};
 if(r.gap<-1e-6)r.issues.push(issue('Épaisseur disponible insuffisante de '+(-r.gap*100).toFixed(1)+' cm : coordonner le niveau supérieur. Aucun matériau n’est comprimé pour rentrer.',true));
 if(r.gap>.001)r.issues.push(issue('Réserve non affectée de '+(r.gap*100).toFixed(1)+' cm au-dessus de la composition. Ce vide n’est pas compté en béton.'));
 if(r.clearHeight<num(c.clearHeight,2.5)-.001)r.issues.push(issue('La réservation technique réduit la hauteur libre sous votre objectif. Ce seuil est un objectif de projet, pas une hauteur légale universelle.'));
 r.layers=[...(ceiling?[{role:'ceiling',name:'Plafond',z:r.bottom,h:ceiling}]:[]),...(tech?[{role:'technical',name:'Vide technique réservé',z:sourceTop-tech,h:tech,void:true}]:[])];
 let z=sourceTop;for(const l of aboveLayers){r.layers.push({...l,z});z+=l.h;}
 if(r.gap>0)r.layers.push({role:'reserve',name:'Réserve non affectée',z,h:r.gap,void:true});
 if(c.system==='wood'){
  r.bays=faces.map((face,i)=>{const p=pairModel({...m,levels:levels.map(l=>l.id===above.id?{...l,elevation:r.requiredTop}:l)},face,{...c,ravoirage:rav*1000},i,G,S);return S.floorReport(p.model,{...p.f,autoSection:false,b:width,h:core});});
  if(r.bays.some(b=>b.blocked||!b.check?.screened||!b.elements.length))blocked=true;
  r.issues.push(...r.bays.flatMap(b=>b.issues.filter(i=>i.severity==='error'&&i.code!=='support-z')));
 }
 if((m.elements||[]).some(e=>e.mode==='construction'&&e.levelId===above.id&&e.type==='opening')){blocked=true;r.issues.push(issue('Trémie présente : découpe/chevêtres non calculés. Le nouveau plancher est suspendu.',true));}
 r.complete=!blocked&&r.gap>=-1e-6;
 const common={generator:TAG,levelId:c.id,mode:'construction',locked:true,designStatus:'prestudy',assemblyId:c.id};
 if(c.enabled&&r.complete){
  if(c.system==='wood')for(const b of r.bays)for(const e of b.elements.filter(e=>e.floorRole==='joist')){r.elements.push({...e,...common,role:'joists',zBase:sourceTop});r.count++;}
  faces.forEach((face,i)=>r.layers.filter(l=>l.role!=='joists').forEach(l=>r.elements.push({...common,id:c.id+':'+i+':'+l.role,type:'slab',role:l.role,polygon:face.points,zBase:l.z,height:l.h,void:l.void||false,hiddenLayer:c.showAllLayers===false&&!['panel','concrete'].includes(l.role)})));
 }
 r.issues.push(issue('Calculs de préétude et volumes bruts : appuis, transferts entre matériaux/étages, ferraillage, assemblages et conformité globale non validés.'));
 return r;
}
function quantities(m,reports,F){
 const rows=[],issues=[];const add=(level,material,label,unit,quantity,note='')=>{if(Number.isFinite(quantity)&&quantity>=0)rows.push({level,material,label,unit,quantity,note});};
 const d=settings(m.buildingDesign),levels=new Map(m.levels.map(l=>[l.id,l.name])),foundation=F.compute(m),hidden=new Set(foundation.settings?.enabled&&foundation.settings.hideDemo?F.demoIds(m.elements):[]);
 for(const e of m.elements){if(e.mode!=='construction'||e.generator||hidden.has(e.id))continue;
  const level=levels.get(e.levelId)||e.levelId;
  if(['wallExterior','wallBearing','partition'].includes(e.type)&&e.a&&e.b){
   const p={...material(),...(e.materialSpec||d.materials[e.levelId]||{})},L=Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),H=num(e.height,0),A=L*H,core=positive(p.core,0)/1000;
   if(p.type==='unknown'){add(level,'non renseigné','Murs non affectés','m²',A,'Surface brute');continue;}
   add(level,p.type,'Surface brute de murs','m²',A,'Axes ; ouvertures/jonctions non déduites');
   if(p.type==='concrete')add(level,'béton','Voiles — volume conventionnel','m³',A*core,'L axe × H × épaisseur du cœur');
   if(['brick','block'].includes(p.type)){
    const rate=num(p.rate);if(rate>0)add(level,p.type==='brick'?'briques':'parpaings','Unités estimées','unités',A*rate*(1+Math.max(0,num(p.waste,0))/100),'Taux fabricant + pertes saisies ; hors accessoires');
    else issues.push(level+' : renseigner le nombre d’unités/m² de la référence de brique/parpaing.');
   }
   if(p.type==='timber'){
    const b=positive(p.studWidth,45)/1000,s=positive(p.studSpacing,600)/1000,n=Math.ceil(L/s)+1,rails=Math.max(0,num(p.rails,2)),h=Math.max(0,H-rails*b),V=(n*h+rails*L)*b*core;
    add(level,'bois ossature','Montants courants','unités',n,'Sans renforts d’angles/baies ni contreventement');add(level,'bois ossature','Ossature courante brute','m³',V,'Montants + lisses ; aucune validation de section');add(level,'isolation en ossature','Remplissage théorique','m³',Math.max(0,A*core-V));
   }
   for(const [k,name] of [['inside','Parement intérieur'],['outside','Parement extérieur'],['insulation','Isolation rapportée']])if(num(p[k],0)>0)add(level,name,name,'m³',A*p[k]/1000);
  }else if(e.type==='foundation'&&e.a&&e.b)add(level,'béton','Fondation manuelle','m³',Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)*num(e.thickness,0)*num(e.height,0),'Convention béton ; matériau à confirmer');
  else if(e.type==='beam'&&e.a&&e.b)add(level,'non renseigné','Poutre manuelle','m³',Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)*num(e.thickness,0)*num(e.height,0),'Matériau à renseigner');
  else if(e.type==='column')add(level,'non renseigné','Poteau manuel','m³',num(e.width,0)*num(e.depth,0)*num(e.height,0),'Matériau à renseigner');
  else if(e.type==='slab'&&!e.polygon)add(level,'non renseigné','Dalle manuelle','m³',num(e.width,0)*num(e.depth,0)*num(e.height,0),'Indépendante des nouveaux planchers ; vérifier les doublons');
 }
 const f=foundation;
 for(const e of f.elements||[]){const V=e.a?Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)*e.thickness*e.height:e.width*e.depth*e.height;add(levels.get(e.levelId)||'Fondations','béton',e.foundationRole||'Fondations','m³',V,'Volume brut, jonctions non dédupliquées');}
 for(const r of reports){if(!r.complete){issues.push((r.config.name||'Plancher')+' : incomplet ; quantités non consolidées.');continue;}
  for(const e of r.elements){if(e.void)continue;const A=e.polygon?Math.abs(e.polygon.reduce((n,p,i)=>n+p.x*e.polygon[(i+1)%e.polygon.length].y-e.polygon[(i+1)%e.polygon.length].x*p.y,0)/2):0;
   const materialName={joists:'bois solives',panel:'panneau bois',concrete:'béton',screed:'chape',ravoirage:'ravoirage',insulation:'isolant',finish:'revêtement',ceiling:'plafond'}[e.role]||e.role;
   const V=e.a?Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y)*e.thickness*e.height:A*e.height;
   const label={joists:'Solives',panel:'Panneau bois',concrete:'Dalle béton',screed:'Chape',ravoirage:'Ravoirage',insulation:'Isolation',finish:'Revêtement',ceiling:'Plafond'}[e.role]||e.role;add(r.config.name,materialName,label,'m³',V);if(e.polygon)add(r.config.name,materialName,label,'m²',A);
   if(e.role==='joists'){add(r.config.name,materialName,'Nombre de solives par travée','unités',1);add(r.config.name,materialName,'Longueur de solives selon axes','m',Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y));}
  }
 }
 if(m.elements.some(e=>['door','window'].includes(e.type)))issues.push('Ouvertures non déduites : l’éditeur ne les lie pas encore de façon fiable aux murs.');
 issues.push('Métré estimatif brut, non bordereau de commande : jonctions, découpes, ferraillage, linteaux, accessoires et renforts non détaillés. Les planchers v0.7 non migrés ne sont pas consolidés ici.');
 const grouped=new Map();for(const row of rows){const k=[row.level,row.material,row.label,row.unit,row.note].join('|');if(grouped.has(k))grouped.get(k).quantity+=row.quantity;else grouped.set(k,{...row});}
 return {rows:[...grouped.values()],issues:[...new Set(issues)]};
}
function report(m,G,S,F){const d=settings(m.buildingDesign),seen=new Set(),floors=d.floors.filter(c=>c.enabled).map(c=>{if(seen.has(c.aboveId))return {config:c,issues:[issue('Deux planchers automatiques visent le même niveau supérieur : doublon exclu.',true)],elements:[],layers:[],bays:[],count:0,area:0,complete:false};seen.add(c.aboveId);return floorReport(m,c,G,S);});return {floors,elements:floors.flatMap(r=>r.elements),levels:floors.flatMap(r=>r.level?[r.level]:[]),quantities:quantities(m,floors,F)};}
const api={TAG,settings,material,technical,config,techReport,floorReport,report,quantities};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.PBPBuilding=api;
})(typeof window!=='undefined'?window:globalThis);
