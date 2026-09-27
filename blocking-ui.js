/* Plan Bâtiment Pro v0.16.12 — UI for normative automatic floor blocking. */
(function(root){
'use strict';
const $=s=>document.querySelector(s),fmt=(v,n=2)=>Number.isFinite(Number(v))?Number(v).toFixed(n).replace('.',','):'—';
function installWizard(){
 const dlg=$('#joistWizard');if(!dlg||!root.PBPJoistWizard)return;
 function enhance(){
  if(!dlg.open)return;const draft=root.PBPJoistWizard.getDraft?.(),step=root.PBPJoistWizard.getStep?.(),body=$('#jwBody');if(!draft||!body)return;
  if(step===0&&!$('#jwBlockingSettings')){
   const box=document.createElement('div');box.id='jwBlockingSettings';box.className='jw-scenario-note';
   const enabled=draft.blockingEnabled!==false,project=Number.isFinite(Number(draft.blockingMaxRun))&&Number(draft.blockingMaxRun)>0?Number(draft.blockingMaxRun):'';
   const bw=Number(draft.blockingWidth)>0?Number(draft.blockingWidth):'',bh=Number(draft.blockingHeight)>0?Number(draft.blockingHeight):'',pattern=draft.blockingPattern==='aligned'?'aligned':'staggered';
   box.innerHTML='<b>Entretoisement du solivage</b>'+
    '<label class="jw-row"><span>Calculer les entretoises</span><input id="jwBlockingEnabled" type="checkbox" '+(enabled?'checked':'')+'></label>'+
    '<label class="jw-row"><span>Disposition</span><select id="jwBlockingPattern"><option value="staggered"'+(pattern==='staggered'?' selected':'')+'>Quinconce</option><option value="aligned"'+(pattern==='aligned'?' selected':'')+'>Alignée</option></select></label>'+
    '<label class="jw-row"><span>Limite projet plus stricte (m, optionnel)</span><input id="jwBlockingMaxRun" type="number" min="0.30" max="5" step="0.01" placeholder="Auto : 40 × épaisseur solive" value="'+project+'"></label>'+
    '<label class="jw-row"><span>Largeur entretoise (mm, vide = solive)</span><input id="jwBlockingWidth" type="number" min="20" max="300" step="1" placeholder="Même largeur que solive" value="'+bw+'"></label>'+
    '<label class="jw-row"><span>Hauteur entretoise (mm, vide = solive)</span><input id="jwBlockingHeight" type="number" min="40" max="500" step="1" placeholder="Même hauteur que solive" value="'+bh+'"></label>'+
    '<p class="jw-muted">Le logiciel calcule automatiquement la limite de liaisonnement à <b>40 × l’épaisseur de la solive</b>. La limite projet ci-dessus ne peut qu’être plus stricte : si elle est plus grande, elle sera ramenée automatiquement à la limite calculée. Le quinconce tient compte de son décalage dans le contrôle de l’écart.</p>';
   const details=body.querySelector('details');(details||body.lastElementChild)?.after(box);if(!box.isConnected)body.append(box);
   $('#jwBlockingEnabled').onchange=e=>{draft.blockingEnabled=e.target.checked;};
   $('#jwBlockingPattern').onchange=e=>{draft.blockingPattern=e.target.value;};
   $('#jwBlockingMaxRun').oninput=e=>{draft.blockingMaxRun=e.target.value===''?null:Number(e.target.value);};
   $('#jwBlockingWidth').oninput=e=>{draft.blockingWidth=e.target.value===''?0:Number(e.target.value);};
   $('#jwBlockingHeight').oninput=e=>{draft.blockingHeight=e.target.value===''?0:Number(e.target.value);};
  }
  if(step===2){const r=root.PBPJoistWizard.getResult?.();if(r?.blocking&&!$('#jwBlockingResult')){const result=body.querySelector('.jw-result');if(result){const b=r.blocking,line=document.createElement('div');line.id='jwBlockingResult';
    line.innerHTML='<br><b>Entretoises</b> : '+b.memberCount+' pièce(s) · '+b.rowCount+' ligne(s) · '+fmt(b.totalLength)+' m.'+
      '<br>Limite 40 × épaisseur : <b>'+fmt(b.normativeMaxRun)+' m</b> · limite retenue : <b>'+fmt(b.effectiveMaxRun)+' m</b>.'+
      '<br>Disposition : '+(b.pattern==='staggered'?'quinconce':'alignée')+
      (b.section?'<br>Section entretoises : '+fmt(b.section.b,0)+' × '+fmt(b.section.h,0)+' mm.':'');
    result.append(line);}}}
 }
 const obs=new MutationObserver(enhance);obs.observe(dlg,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});dlg.addEventListener('toggle',enhance);enhance();
}
function init(){installWizard();const v=$('.version');if(v)v.textContent='v0.16.12';document.title='Plan Bâtiment Pro — v0.16.12';root.PBPBlockingUIReady=true;}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
