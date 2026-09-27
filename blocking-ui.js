/* Plan Bâtiment Pro v0.16.11 — UI bridge for automatic floor blocking. */
(function(root){
'use strict';
const $=s=>document.querySelector(s),fmt=(v,n=2)=>Number.isFinite(Number(v))?Number(v).toFixed(n).replace('.',','):'—';
function installWizard(){
 const dlg=$('#joistWizard');if(!dlg||!root.PBPJoistWizard)return;
 function enhance(){
  if(!dlg.open)return;const draft=root.PBPJoistWizard.getDraft?.(),step=root.PBPJoistWizard.getStep?.(),body=$('#jwBody');if(!draft||!body)return;
  if(step===0&&!$('#jwBlockingSettings')){
   const box=document.createElement('div');box.id='jwBlockingSettings';box.className='jw-scenario-note';
   const enabled=draft.blockingEnabled!==false,max=Number.isFinite(Number(draft.blockingMaxRun))?Number(draft.blockingMaxRun):2;
   box.innerHTML='<b>Entretoises automatiques</b><label class="jw-row"><span>Calculer les entretoises</span><input id="jwBlockingEnabled" type="checkbox" '+(enabled?'checked':'')+'></label><label class="jw-row"><span>Espacement longitudinal maximal entre lignes (m)</span><input id="jwBlockingMaxRun" type="number" min="0.30" max="5" step="0.05" value="'+max+'"></label><p class="jw-muted">Règle de projet modifiable, pas valeur DTU universelle. Les lignes sont réparties régulièrement, les pièces sont calculées entre faces de solives et sont interrompues aux trémies.</p>';
   const details=body.querySelector('details');(details||body.lastElementChild)?.after(box);if(!box.isConnected)body.append(box);
   $('#jwBlockingEnabled').onchange=e=>{draft.blockingEnabled=e.target.checked;};
   $('#jwBlockingMaxRun').oninput=e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&v>=.30&&v<=5)draft.blockingMaxRun=v;};
  }
  if(step===2){const r=root.PBPJoistWizard.getResult?.();if(r?.blocking&&!$('#jwBlockingResult')){const result=body.querySelector('.jw-result');if(result){const line=document.createElement('div');line.id='jwBlockingResult';line.innerHTML='<br>Entretoises : <b>'+r.blocking.memberCount+' pièce(s)</b> · '+r.blocking.rowCount+' ligne(s) · '+fmt(r.blocking.totalLength)+' m.';result.append(line);}}}
 }
 const obs=new MutationObserver(enhance);obs.observe(dlg,{subtree:true,childList:true});dlg.addEventListener('toggle',enhance);enhance();
}
function init(){installWizard();const v=$('.version');if(v)v.textContent='v0.16.11';document.title='Plan Bâtiment Pro — v0.16.11';root.PBPBlockingUIReady=true;}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
