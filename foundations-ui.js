/* v0.6 extension: keep the tested v0.5 editor and corner gestures unchanged. */
(function(){
'use strict';
const F=window.PBPFoundations,app=window.planApp;
if(!F||!app)throw new Error('Le moteur de fondations ne peut pas être initialisé.');
const $=s=>document.querySelector(s);
const clone=v=>JSON.parse(JSON.stringify(v));
let panelReady=false,lastReport=null,cacheKey='',cached=null,rendering=0;
const prototype=window.ProjectModel.prototype;
const oldSnapshot=prototype.snapshot,oldRestore=prototype.restore;
prototype.snapshot=function(){
  const data=JSON.parse(oldSnapshot.call(this));
  data.elements=data.elements.filter(e=>!F.generated(e));
  data.foundationAutomation=F.settings(this.foundationAutomation);
  return JSON.stringify(data);
};
prototype.restore=function(serialized){
  const data=JSON.parse(serialized);
  oldRestore.call(this,serialized);
  this.elements=this.elements.filter(e=>!F.generated(e));
  this.foundationAutomation=F.settings(data.foundationAutomation);
  cacheKey='';
};
function report(){
  const m=app.model;
  const key=JSON.stringify([m.foundationAutomation,m.levels,m.elements]);
  if(key!==cacheKey){cached=F.compute(m);cacheKey=key;}
  return cached;
}
function refresh(){app.renderer2d?.draw();app.renderer3d?.draw();}
function badge(r){
  if(!panelReady)return;
  const s=r.settings,active=s.enabled;
  $('#faState').textContent=active?'Suivi lié aux murs activé':'Suivi désactivé';
  $('#faShow').disabled=!active;
  const el=$('#faBadge');el.hidden=!active;
  if(active){
    const counts=s.system==='longrines'?`${r.spanCount} longrines · ${r.padCount} semelles`:`${r.spanCount} semelles filantes`;
    const errors=r.issues.filter(i=>i.severity==='error').length;
    el.textContent=`Fondations liées : ${counts}${errors?' · '+errors+' alerte(s)':''} — AVANT-PROJET NON DIMENSIONNÉ`;
  }
}
// Generated objects exist only while drawing. They cannot be moved/deleted by
// selection, or mistaken for source walls, and are never serialized as manual work.
for(const Renderer of [window.PlanRenderer2D,window.ConstructionRenderer3D]){
  const base=Renderer.prototype.draw;
  Renderer.prototype.draw=function(...args){
    if(rendering)return base.apply(this,args);
    const m=this.app.model,r=report(),original=m.elements;
    lastReport=r;rendering++;
    const hidden=new Set(r.settings.enabled&&r.settings.hideDemo?F.demoIds(original):[]);
    try{m.elements=original.filter(e=>!hidden.has(e.id)).concat(r.elements);return base.apply(this,args);}
    finally{m.elements=original;rendering--;badge(r);}
  };
}
// A hidden pristine demonstration must not leave invisible editable handles.
for(const method of ['hitTest','hitTestCorner']){
  const base=window.PlanRenderer2D.prototype[method];
  window.PlanRenderer2D.prototype[method]=function(...args){
    const m=this.app.model,s=F.settings(m.foundationAutomation),original=m.elements;
    const hidden=new Set(s.enabled&&s.hideDemo?F.demoIds(original):[]);
    try{m.elements=original.filter(e=>!hidden.has(e.id));return base.apply(this,args);}
    finally{m.elements=original;}
  };
}
// Footings under beams in plan view; retain existing wall-junction rendering.
const oldLayer=window.PlanRenderer2D.prototype.drawLayer;
window.PlanRenderer2D.prototype.drawLayer=function(elements,alpha,overlay){
  const pads=elements.filter(e=>F.generated(e)&&['pad','pedestal'].includes(e.foundationRole));
  for(const e of pads)this.drawRectElement(e,alpha,overlay);
  return oldLayer.call(this,elements.filter(e=>!pads.includes(e)),alpha,overlay);
};
for(const method of ['wall','box']){
  const original=window.ConstructionRenderer3D.prototype[method];
  window.ConstructionRenderer3D.prototype[method]=function(el,level,alpha){
    return original.call(this,el,F.generated(el)?{...level,elevation:el.zBase}:level,alpha);
  };
}
function init(){
  const style=document.createElement('style');style.textContent=`
.fa-card{padding:8px 0;border-bottom:1px solid #e1e6eb}.fa-card button{width:100%;font-size:12px;margin-bottom:5px}.fa-card small{font-size:10px;color:#687782;display:block;line-height:1.4}.fa-card .fa-small{width:auto;font-size:10px;padding:3px 6px;margin-top:5px}
#faBadge{position:absolute;z-index:4;left:8px;bottom:8px;max-width:calc(100% - 16px);background:rgba(255,250,233,.96);color:#77510e;border:1px solid #dec590;border-radius:6px;padding:5px 8px;font-size:10px;pointer-events:none;line-height:1.4}
#faDialog{width:min(510px,94vw);max-height:90vh;overflow:auto}#faForm{display:block;padding:16px}#faForm h3{font-size:17px;margin:0 0 12px}#faForm p{font-size:12px;line-height:1.45}#faForm details{margin:12px 0;border-top:1px solid #e4e8ec;padding-top:10px}#faForm summary{cursor:pointer;font-weight:700;font-size:12px;margin-bottom:8px}#faForm .fa-row{display:grid;grid-template-columns:1fr minmax(115px,44%);gap:10px;align-items:center;font-size:12px;margin:8px 0}#faForm input:not([type=checkbox]),#faForm select{min-width:0;width:100%;border:1px solid #ccd5dd;border-radius:5px;padding:6px;background:white}#faForm .fa-check{font-size:12px;display:flex;align-items:center;gap:8px;margin:10px 0}.fa-notice{background:#fff8e8;border-left:3px solid #bf8e37;padding:9px;color:#785419;font-size:12px;line-height:1.45}.fa-muted{color:#64727e;font-size:11px!important;line-height:1.4}.fa-actions{position:sticky;bottom:-16px;background:white;display:flex;justify-content:flex-end;gap:7px;border-top:1px solid #dde3e8;margin:12px -16px -16px;padding:12px 16px}.fa-actions button{font-size:12px}.fa-primary{background:#245c7d;color:white}#faForm ul{padding-left:18px;font-size:11px;line-height:1.45}#faForm li{margin:7px 0}#faForm .fa-error{color:#9c3424;font-weight:600}#faForm a{color:#245c7d}#faSummary{padding:8px;background:#eff4f7;border-radius:6px;font-size:12px;line-height:1.4}
`;
  document.head.appendChild(style);
  const card=document.createElement('div');card.className='fa-card';
  card.innerHTML='<button id="faOpen">▱ Fondations auto</button><small id="faState"></small><button id="faShow" class="fa-small">Voir les fondations</button>';
  $('.mode-title').after(card);
  const b=document.createElement('div');b.id='faBadge';b.hidden=true;$('#canvasShell').appendChild(b);
  const dlg=document.createElement('dialog');dlg.id='faDialog';
  dlg.innerHTML=`<form id="faForm">
<h3>Fondations automatiques</h3>
<div class="fa-notice"><strong>Avant-projet non dimensionné.</strong> Les valeurs initiales sont des exemples de dessin, pas des dimensions recommandées. Le logiciel ne certifie pas la conformité d’un ouvrage.</div>
<label class="fa-check"><input id="faEnabled" type="checkbox"> Activer le suivi automatique des murs extérieurs</label>
<label class="fa-check"><input data-fa="hideDemo" type="checkbox"> Masquer les 4 traits de l’exemple initial s’ils sont intacts</label>
<label class="fa-row">Murs sources<select id="faSource"></select></label>
<label class="fa-row">Niveau des fondations<select id="faTarget"></select></label>
<label class="fa-row">Système représenté<select id="faSystem"><option value="longrines">Longrines + semelles isolées</option><option value="strips">Semelles filantes seules</option></select></label>
<p class="fa-muted">Un seul niveau source, normalement le RDC. Les étages ne créent pas de fondations supplémentaires. Éléments générés verrouillés : modifiez le mur ou ces réglages.</p>
<details open><summary>Dimensions de représentation — mètres</summary>
<div data-fa-system="longrines">
<label class="fa-row">Largeur longrine (m)<input data-fa="beamWidth" type="number" min="0.01" max="20" step="any" required></label>
<label class="fa-row">Hauteur longrine (m)<input data-fa="beamHeight" type="number" min="0.01" max="20" step="any" required></label>
<label class="fa-row">Largeur semelle isolée (m)<input data-fa="padWidth" type="number" min="0.01" max="50" step="any" required></label>
<label class="fa-row">Longueur semelle isolée (m)<input data-fa="padLength" type="number" min="0.01" max="50" step="any" required></label>
<label class="fa-row">Épaisseur semelle (m)<input data-fa="padHeight" type="number" min="0.01" max="20" step="any" required></label>
<label class="fa-row">Entraxe de dessin maximal (m)<input data-fa="maxSpacing" type="number" min="0.05" max="1000" step="any" placeholder="Non défini"></label>
<p class="fa-muted">Sans entraxe saisi : appuis aux extrémités et jonctions des axes. Avec entraxe : appuis intermédiaires géométriques. Ce n’est pas une portée admissible. Les plots de liaison comblent la hauteur entre semelles et longrines ; ils restent à dimensionner.</p>
</div>
<div data-fa-system="strips">
<label class="fa-row">Largeur semelle (m)<input data-fa="stripWidth" type="number" min="0.01" max="50" step="any" required></label>
<label class="fa-row">Épaisseur semelle (m)<input data-fa="stripHeight" type="number" min="0.01" max="20" step="any" required></label>
</div>
<label class="fa-row">Sous-face fondations : altitude (m)<input data-fa="baseZ" type="number" step="any" required></label>
<label class="fa-row">Arase longrines / murs : décalage (m)<input data-fa="topOffset" type="number" step="any" required></label>
<p class="fa-muted">Altitude relative au repère du projet, pas profondeur sous terrain. Décalage 0 : haut des longrines au pied des murs sources. Terrain en pente et fondations étagées non traités.</p>
</details>
<details><summary>Sol, prescriptions et règles françaises</summary>
<label class="fa-row">Altitude terrain horizontal (m)<input data-fa="terrainZ" type="number" step="any" placeholder="À renseigner"></label>
<label class="fa-row">Profondeur minimale prescrite (m)<input data-fa="minDepth" type="number" min="0" step="any" placeholder="Étude / hors-gel"></label>
<label class="fa-row">Exposition argiles<select data-fa="rga"><option value="unknown">À vérifier</option><option value="low">Faible / non classée</option><option value="medium">Moyenne</option><option value="high">Forte</option></select></label>
<label class="fa-row">Voie argiles applicable<select data-fa="rgaMethod"><option value="unknown">À déterminer</option><option value="study">Prescriptions de l’étude</option><option value="standard">Dispositions types de l’arrêté</option></select></label>
<p class="fa-muted">Application à vérifier selon le contrat et le terrain. La voie « dispositions types » compare seulement la profondeur aux seuils 0,80 m / 1,20 m ; l’exception de sol dur non argileux doit être justifiée par étude. Les autres prescriptions ne sont pas contrôlées.</p>
<label class="fa-row">Référence étude géotechnique<input data-fa="soilRef" maxlength="250" placeholder="Référence du rapport"></label>
<label class="fa-row">Référence note structure<input data-fa="structureRef" maxlength="250" placeholder="Référence de la note"></label>
<p class="fa-muted">Renseigner une référence n’analyse pas le document et ne valide ni les données ni les sections.</p>
</details>
<div id="faSummary" role="status"></div>
<details><summary>Vigilances et limites des contrôles</summary><ul id="faIssues"></ul></details>
<details><summary>Références consultées — 23 septembre 2026</summary>
<p class="fa-muted">Références de contexte, pas un moteur de calcul normatif. Les fiches AFNOR ne donnent pas accès à toutes les clauses des normes. Vérifier les textes complets et leur applicabilité au projet.</p>
<ul>
<li><a href="https://www.boutique.afnor.org/fr-fr/norme/nf-dtu-131-p11/dtu-131-travaux-de-batiment-fondations-superficielles-partie-11-cahier-des-/fa193423/323032" target="_blank" rel="noopener">NF DTU 13.1 (2019) : exécution des fondations superficielles</a></li>
<li><a href="https://www.boutique.afnor.org/fr-fr/norme/nf-p94261-compil1/justification-des-ouvrages-geotechniques-norme-dapplication-nationale-de-le/fa191352/335850" target="_blank" rel="noopener">NF P94-261 + A1 : justification géotechnique, Eurocode 7</a></li>
<li><a href="https://www.boutique.afnor.org/fr-fr/norme/nf-en-199211-na-a1/eurocode-2-calcul-des-structures-en-beton-partie-11-regles-generales-et-reg/fa300801/598195" target="_blank" rel="noopener">Eurocode 2 : béton, amendement national publié en avril 2026</a></li>
<li><a href="https://www.legifrance.gouv.fr/loda/id/JORFTEXT000042238448" target="_blank" rel="noopener">Arrêté du 22 juillet 2020 : dispositions constructives argiles</a></li>
<li><a href="https://www.georisques.gouv.fr/donnees/bases-de-donnees/retrait-gonflement-des-argiles-version-2026" target="_blank" rel="noopener">Géorisques : carte RGA 2026 (contrats concernés à compter du 1er juillet 2026)</a></li>
<li><a href="https://qualiteconstruction.com/ressource/batiment/lecons-macons-fondations-massifs-longrines/" target="_blank" rel="noopener">Agence Qualité Construction : principe massifs–longrines</a></li>
</ul></details>
<div class="fa-actions"><button type="button" id="faCancel">Annuler</button><button type="submit" class="fa-primary">Appliquer</button></div>
</form>`;
  document.body.appendChild(dlg);
  $('#faOpen').onclick=open;
  $('#faCancel').onclick=()=>dlg.close();
  $('#faShow').onclick=()=>{
    const select=$('#levelSelect'),id=F.settings(app.model.foundationAutomation).targetLevelId;
    if([...select.options].some(o=>o.value===id)){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}
  };
  $('#faForm').addEventListener('input',preview);
  $('#faForm').addEventListener('change',preview);
  $('#faForm').addEventListener('submit',e=>{
    e.preventDefault();if(!$('#faForm').reportValidity())return;
    app.model.commit();app.model.foundationAutomation=readDraft();
    if(app.model.foundationAutomation.enabled){app.overlay.foundations=true;$('#overlayFoundations').checked=true;}
    cacheKey='';dlg.close();refresh();
  });
  document.title='Plan Bâtiment Pro — v0.6';$('.version').textContent='v0.6';
  panelReady=true;window.PBPFoundationReady=true;refresh();
}
function open(){
  const s=F.settings(app.model.foundationAutomation),m=app.model;
  for(const [id,value] of [['#faSource',s.sourceLevelId],['#faTarget',s.targetLevelId]]){
    const select=$(id);select.replaceChildren();
    for(const l of m.levels.filter(l=>id!=='#faTarget'||l.id==='foundations')){const opt=document.createElement('option');opt.value=l.id;opt.textContent=l.name;select.appendChild(opt);}
    select.value=value;
  }
  $('#faEnabled').checked=s.enabled;$('#faSystem').value=s.system;
  for(const el of document.querySelectorAll('[data-fa]')){
    const k=el.dataset.fa;
    if(el.type==='checkbox'){el.checked=s[k];continue;}
    el.value=k==='baseZ'?(s.baseZ??m.levels.find(l=>l.id===s.targetLevelId)?.elevation??-.8):(s[k]??'');
  }
  preview();$('#faDialog').showModal();
}
function readDraft(){
  const d={enabled:$('#faEnabled').checked,sourceLevelId:$('#faSource').value,targetLevelId:$('#faTarget').value,system:$('#faSystem').value};
  for(const el of document.querySelectorAll('[data-fa]'))d[el.dataset.fa]=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?null:Number(el.value)):el.value;
  return F.settings(d);
}
function preview(){
  const draft=readDraft();
  for(const group of document.querySelectorAll('[data-fa-system]')){
    const hide=group.dataset.faSystem!==draft.system;group.hidden=hide;
    group.querySelectorAll('input').forEach(el=>{el.disabled=hide;});
  }
  const r=F.compute({...app.model,foundationAutomation:draft});
  const errors=r.issues.filter(i=>i.severity==='error').length;
  const counts=draft.system==='longrines'?`${r.spanCount} longrines et ${r.padCount} semelles isolées`:`${r.spanCount} semelles filantes`;
  $('#faSummary').textContent=draft.enabled?`${r.wallCount} murs extérieurs · ${r.totalLength.toFixed(2)} m d’axes → ${counts}. ${errors?errors+' alerte(s) à corriger. ':''}Non dimensionné.`:'Suivi désactivé : les fondations automatiques ne sont pas affichées. Les éléments manuels restent inchangés.';
  $('#faIssues').replaceChildren();
  for(const item of r.issues){const li=document.createElement('li');li.textContent=item.text;if(item.severity==='error')li.className='fa-error';$('#faIssues').appendChild(li);}
}
window.PBPFoundationUI={getReport:()=>clone(report()),refresh,open};
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',init);else init();
})();
