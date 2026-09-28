/* v0.17.0 Clean Core — joist wizard, same workflow as v0.16.16 without legacy UI engine. */
(function(root){
'use strict';
const app=root.PBPCleanApp,B=root.PBPBuilding,S=root.PBPStructure,Z=root.PBPSpaces,G=root.PBPGeometry,C=root.PBPCleanCalc,$=s=>document.querySelector(s);
const clone=x=>JSON.parse(JSON.stringify(x)),fmt=(x,n=2)=>Number.isFinite(Number(x))?Number(x).toFixed(n).replace('.',','):'—';
let step=0,config=null,result=null,sourceId='',material='dry';
function levels(){return app.model.storyLevels();}
function existingFor(below,above){return (B.settings(app.model.data.buildingDesign).floors||[]).find(f=>f.belowId===below.id&&f.aboveId===above.id);}
function defaultConfig(below,above){return{...B.config(S,below,above),assistant:true,coverageFollowWalls:true,scenarioMode:'standard-prestudy',grade:'C24',enabled:true,coverageZones:{mode:'all',ids:[]},blockingEnabled:true,blockingPattern:'staggered'};}
function sourcePair(id){
 const ls=levels(),i=ls.findIndex(l=>l.id===id);return i>=0&&i<ls.length-1?{below:ls[i],above:ls[i+1]}:null;
}
function readStep0(){
 if(!config)return;for(const k of ['q','p','finishes','partitions','panel','screed','spacing']){const el=$('#jw_'+k);if(el)config[k]=el.value===''?null:Number(el.value);}
 const s=$('#jwService');if(s)config.service=Number(s.value);config.assistantMaxSpacing=config.spacing;
}
function zones(){
 if(!config)return{rows:[],pick:{chosen:[],totalArea:0,selectedArea:0,missing:[],selection:{mode:'all'}}};
 const data=Z.zones(app.model.data,config.belowId,'structure',G,S),pick=Z.resolve(data.rows,config.coverageZones);return{...data,pick};
}
function row(label,id,value){return'<label class="jw-row"><span>'+label+'</span><input id="'+id+'" type="number" step="any" value="'+(value??'')+'"></label>';}
function renderStep0(body){
 const ls=levels();body.innerHTML='<label class="jw-row"><span>À partir du niveau (appuis)</span><select id="jwSource">'+ls.slice(0,-1).map(l=>'<option value="'+l.id+'"'+(l.id===config?.belowId?' selected':'')+'>'+l.name+'</option>').join('')+'</select></label>'+
 '<p>Le plancher sera créé entre <b>'+((app.model.level(config?.belowId)||{}).name||'—')+'</b> et <b>'+((app.model.level(config?.aboveId)||{}).name||'—')+'</b>.</p>'+
 '<label class="jw-row"><span>Matériau et composition</span><select id="jwMaterial"><option value="dry">Bois massif C24 · plancher sec</option><option value="screed">Bois massif C24 · avec chape</option></select></label>'+
 '<p class="jw-scenario-note"><b>Scénario standard de préétude :</b> le calcul repart toujours du plan actuel. Après déplacement d’un mur du RDC, la zone unique suit automatiquement le nouveau contour.</p>'+
 '<label class="jw-row"><span>Ambiance du bois</span><select id="jwService"><option value="1">Intérieur sec · classe 1</option><option value="2">Classe de service 2</option></select></label>'+
 '<details open><summary>Charges, panneau et entraxe</summary>'+[
  ['Exploitation Q (kN/m²)','q'],['Charge ponctuelle (kN)','p'],['Revêtements (kN/m²)','finishes'],['Cloisons (kN/m²)','partitions'],['Panneau bois (mm)','panel'],['Chape (mm)','screed'],['Entraxe cible maximal (m)','spacing']
 ].map(([l,k])=>row(l,'jw_'+k,config?.[k])).join('')+'</details>';
 $('#jwService').value=String(config.service||1);$('#jwMaterial').value=material;
 $('#jwSource').onchange=e=>{readStep0();const p=sourcePair(e.target.value);if(!p)return;sourceId=p.below.id;const old=existingFor(p.below,p.above);config=old?clone(old):defaultConfig(p.below,p.above);render();};
 $('#jwMaterial').onchange=e=>{material=e.target.value;if(material==='screed'&&!(Number(config.screed)>0))config.screed=50;};
}
function updateCoverage(id,checked){
 const z=zones(),set=new Set(z.pick.chosen.map(x=>x.id));if(checked)set.add(id);else set.delete(id);
 config.coverageZones=set.size===z.rows.length?{mode:'all',ids:[]}:{mode:'selected',ids:[...set]};render();
}
function drawPreview(){
 const canvas=$('#jwPreview');if(!canvas)return;const ctx=canvas.getContext('2d'),z=zones(),pts=z.rows.flatMap(r=>r.face.points);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f7fafb';ctx.fillRect(0,0,canvas.width,canvas.height);if(!pts.length){ctx.fillStyle='#6d7e87';ctx.fillText('Aucune zone fermée détectée.',20,35);return;}
 const x0=Math.min(...pts.map(p=>p.x)),x1=Math.max(...pts.map(p=>p.x)),y0=Math.min(...pts.map(p=>p.y)),y1=Math.max(...pts.map(p=>p.y)),sc=Math.min((canvas.width-50)/(x1-x0||1),(canvas.height-50)/(y1-y0||1)),ox=(canvas.width-(x1-x0)*sc)/2,oy=(canvas.height-(y1-y0)*sc)/2,xy=p=>({x:ox+(p.x-x0)*sc,y:oy+(p.y-y0)*sc}),chosen=new Set(z.pick.chosen.map(r=>r.id));
 for(const r of z.rows){const ps=r.face.points.map(xy),yes=chosen.has(r.id);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=yes?'#e5eef3':'#f1ece6';ctx.fill();ctx.strokeStyle=yes?'#436f86':'#a89a8d';ctx.stroke();
  if(yes&&r.face.rectangle){const p=r.face.points,a=G.dist(p[0],p[3]),b=G.dist(p[1],p[0]),dir=(a<=b?0:1)^(config.invert?1:0);const A=p[dir],B=p[(dir+1)%4],O=p[(dir+3)%4];ctx.strokeStyle='#9b7746';ctx.lineWidth=1.2;for(let k=1;k<8;k++){const t=k/8,p1=xy({x:A.x+(B.x-A.x)*t,y:A.y+(B.y-A.y)*t}),p2=xy({x:O.x+(B.x-A.x)*t,y:O.y+(B.y-A.y)*t});ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();}}
 }
}
function renderStep1(body){
 const z=zones();body.innerHTML='<p>Choisissez les zones et le sens. La zone unique suit automatiquement les murs lorsque son contour change.</p>'+
 '<div class="jw-directions"><button type="button" id="jwShort" class="'+(!config.invert?'active':'')+'">Auto · portées courtes</button><button type="button" id="jwOther" class="'+(config.invert?'active':'')+'">Auto · autre sens</button></div>'+
 '<canvas id="jwPreview" width="510" height="260"></canvas><div class="jw-zone-list">'+z.rows.map(r=>'<label><input type="checkbox" data-zone="'+r.id+'" '+(z.pick.chosen.some(x=>x.id===r.id)?'checked':'')+'> '+(r.name||'Zone')+' · '+fmt(r.area)+' m²</label>').join('')+'</div>'+
 '<p class="jw-muted">Une zone décochée reste volontairement sans plancher. Si plusieurs zones changent, le logiciel demande une nouvelle sélection au lieu de l’inventer.</p>';
 $('#jwShort').onclick=()=>{config.invert=false;render();};$('#jwOther').onclick=()=>{config.invert=true;render();};
 body.querySelectorAll('[data-zone]').forEach(x=>x.onchange=()=>updateCoverage(x.dataset.zone,x.checked));drawPreview();
}
function calculate(){
 const draft=clone(app.model.data),bd=B.settings(draft.buildingDesign);bd.floors=bd.floors.filter(f=>f.id!==config.id&&f.aboveId!==config.aboveId).concat([clone(config)]);draft.buildingDesign=bd;
 result=C.floor(draft,config.id);return result;
}
function renderStep2(body){
 try{calculate();}catch(e){result=null;body.innerHTML='<p class="jw-error">'+e.message+'</p>';return;}
 const issues=result.issues||[],errors=issues.filter(i=>i.severity==='error');
 body.innerHTML='<div class="jw-result"><b>'+(errors.length?'Éléments à corriger':'Tracé automatique disponible en préétude')+'</b><br>Emprise : '+fmt(result.area)+' m² · '+(result.bays?.length||0)+' travée(s).'+
 (result.section?'<br>Section commune d’essai : <b>'+result.section.b+' × '+result.section.h+' mm</b>':'')+
 '<br>'+(result.count||0)+' solives générées.'+(result.coverage?'<br>Surface couverte : <b>'+fmt(result.coverage.coveredArea)+' / '+fmt(result.coverage.totalArea)+' m²</b>':'')+
 (result.blocking?'<br>Entretoises : '+(result.blocking.memberCount||0)+' pièce(s).':'')+'</div>'+
 '<div class="jw-issues">'+issues.map(i=>'<p class="'+(i.severity==='error'?'jw-error':'jw-muted')+'">'+i.text+'</p>').join('')+'</div>'+
 '<p class="jw-muted">Le calcul utilise le contour actuel des murs. Le résultat est une préétude et ne valide pas la construction.</p>';
}
function render(){
 const body=$('#jwBody');if(!body)return;$('#jwStep').textContent=['1 · Niveau et matériaux','2 · Zones et sens du solivage','3 · Calcul et éléments manquants'][step];$('#jwProgress').textContent=(step+1)+' / 3';$('#jwBack').hidden=step===0;$('#jwNext').hidden=step===2;$('#jwApply').hidden=step!==2;$('#jwNext').textContent=step===1?'Calculer le solivage':'Suivant';
 if(step===0)renderStep0(body);else if(step===1)renderStep1(body);else renderStep2(body);
 $('#jwApply').disabled=step!==2||!result||!result.complete||(result.issues||[]).some(i=>i.severity==='error');
}
function open(){
 const s=app.sheets.active(),id=s.kind==='story'?s.levelId:app.model.activeLevelId,p=sourcePair(id)||sourcePair(levels()[0]?.id);if(!p){alert('Ajoutez d’abord un étage au-dessus du niveau courant.');return;}
 sourceId=p.below.id;const old=existingFor(p.below,p.above);config=old?clone(old):defaultConfig(p.below,p.above);config.assistant=true;config.coverageFollowWalls=true;step=0;result=null;render();$('#joistWizard').showModal();
}
function next(){if(step===0)readStep0();if(step<2){step++;render();}}
function apply(){
 if(step!==2||!result||!result.complete||(result.issues||[]).some(i=>i.severity==='error'))return;
 const saved=clone(config);app.model.mutate(d=>{const bd=B.settings(d.buildingDesign);bd.floors=bd.floors.filter(f=>f.id!==saved.id&&f.aboveId!==saved.aboveId).concat([saved]);d.buildingDesign=bd;},'solivage auto');
 app.sheets.cache.delete('floor:'+saved.id);$('#joistWizard').close();app.sheets.open('floor:'+saved.id);
}
function init(){
 if(!app||$('#joistWizard'))return;
 const style=document.createElement('style');style.textContent=`
 #joistWizard{width:min(620px,95vw);max-height:92vh;overflow:auto}#jwForm{display:block;padding:15px}#jwForm h3{margin:2px 0 8px}
 #jwProgress{float:right;font-size:11px;color:#657985}.jw-row{display:grid!important;grid-template-columns:1fr minmax(130px,42%);gap:8px;align-items:center;margin:8px 0;font-size:12px}
 .jw-row input,.jw-row select{width:100%;padding:6px;border:1px solid #ccd8df;border-radius:5px;background:white}.jw-scenario-note,.jw-result{background:#eef5f8;border:1px solid #d0e0e8;border-radius:7px;padding:9px;font-size:12px;line-height:1.5}
 .jw-muted{font-size:11px;color:#647985;line-height:1.45}.jw-error{font-size:12px;color:#a33e2c;font-weight:650}.jw-directions{display:flex;gap:6px;margin:8px 0}.jw-directions button.active{background:#eaf3f8;border-color:#99bdcf;color:#174d68}
 #jwPreview{width:100%;height:auto;border:1px solid #d2dfe6;border-radius:7px;display:block}.jw-zone-list{display:grid;gap:5px;margin:8px 0}.jw-zone-list label{font-size:12px}
 .jw-actions{display:flex;gap:7px;justify-content:flex-end;position:sticky;bottom:-15px;background:white;border-top:1px solid #dce4eb;padding:12px 15px;margin:12px -15px -15px}#jwApply{background:#245c7d;color:#fff}
 `;document.head.append(style);
 const d=document.createElement('dialog');d.id='joistWizard';d.innerHTML='<form id="jwForm"><span id="jwProgress"></span><h3>Solivage automatique</h3><div id="jwStep"></div><div id="jwBody"></div><div class="jw-actions"><button type="button" id="jwCancel">Annuler</button><button type="button" id="jwBack">Retour</button><button type="button" id="jwNext">Suivant</button><button type="button" id="jwApply">Générer et suivre les murs</button></div></form>';document.body.append(d);
 $('#jwCancel').onclick=()=>d.close();$('#jwBack').onclick=()=>{if(step>0){step--;render();}};$('#jwNext').onclick=next;$('#jwApply').onclick=apply;
 const trigger=$('#ccCreateFloor');if(trigger)trigger.onclick=open;
 root.PBPCleanJoistWizard={open};root.PBPCleanJoistWizardReady=true;
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
