/* Plan Bâtiment Pro v0.16.13 — panel layout/support UI. */
(function(root){
'use strict';const $=s=>document.querySelector(s),fmt=(v,n=2)=>Number.isFinite(Number(v))?Number(v).toFixed(n).replace('.',','):'—';
function install(){
 const dlg=$('#joistWizard');if(!dlg||!root.PBPJoistWizard)return;
 function enhance(){if(!dlg.open)return;const d=root.PBPJoistWizard.getDraft?.(),step=root.PBPJoistWizard.getStep?.(),body=$('#jwBody');if(!d||!body)return;
  if(step===0&&!$('#jwPanelSupportSettings')){const box=document.createElement('div');box.id='jwPanelSupportSettings';box.className='jw-scenario-note';const mode=['tongue-groove','square'].includes(d.panelEdgeMode)?d.panelEdgeMode:'unknown';
   box.innerHTML='<b>Panneaux de plancher · appuis des rives</b>'+
   '<label class="jw-row"><span>Type de rives</span><select id="jwPanelEdgeMode"><option value="unknown"'+(mode==='unknown'?' selected':'')+'>À renseigner</option><option value="tongue-groove"'+(mode==='tongue-groove'?' selected':'')+'>Rainure-languette / rives assemblées</option><option value="square"'+(mode==='square'?' selected':'')+'>Bords droits</option></select></label>'+
   '<label class="jw-row"><span>Longueur utile panneau (mm)</span><input id="jwPanelLength" type="number" min="100" max="5000" step="1" value="'+(Number(d.panelUsableLength)>0?Number(d.panelUsableLength):'')+'"></label>'+
   '<label class="jw-row"><span>Largeur utile panneau (mm)</span><input id="jwPanelWidth" type="number" min="100" max="2500" step="1" value="'+(Number(d.panelUsableWidth)>0?Number(d.panelUsableWidth):'')+'"></label>'+
   '<details><summary>Section des supports sous joints à bords droits</summary><label class="jw-row"><span>Largeur support (mm, vide = solive)</span><input id="jwPanelSupportWidth" type="number" min="20" max="300" step="1" value="'+(Number(d.panelSupportWidth)>0?Number(d.panelSupportWidth):'')+'"></label><label class="jw-row"><span>Hauteur support (mm, vide = solive)</span><input id="jwPanelSupportHeight" type="number" min="30" max="500" step="1" value="'+(Number(d.panelSupportHeight)>0?Number(d.panelSupportHeight):'')+'"></label></details>'+
   '<p class="jw-muted">Le contrôle vérifie que les petites rives tombent sur un appui. Pour des bords droits, le logiciel ajoute les supports bois sous les joints longitudinaux. Pour des rives rainurées-languettées/assemblées, ces supports intermédiaires ne sont pas ajoutés automatiquement.</p>';
   const blocking=$('#jwBlockingSettings');if(blocking)blocking.after(box);else body.append(box);
   $('#jwPanelEdgeMode').onchange=e=>d.panelEdgeMode=e.target.value;$('#jwPanelLength').oninput=e=>d.panelUsableLength=e.target.value===''?0:Number(e.target.value);$('#jwPanelWidth').oninput=e=>d.panelUsableWidth=e.target.value===''?0:Number(e.target.value);$('#jwPanelSupportWidth').oninput=e=>d.panelSupportWidth=e.target.value===''?0:Number(e.target.value);$('#jwPanelSupportHeight').oninput=e=>d.panelSupportHeight=e.target.value===''?0:Number(e.target.value);
  }
  if(step===2){const r=root.PBPJoistWizard.getResult?.(),p=r?.panelLayout,l=r?.loadSupport,result=body.querySelector('.jw-result');if(result&&p&&!$('#jwPanelSupportResult')){const div=document.createElement('div');div.id='jwPanelSupportResult';div.innerHTML='<br><b>Panneaux</b> : '+(p.edgeMode==='tongue-groove'?'rives assemblées':p.edgeMode==='square'?'bords droits':'type de rives à renseigner')+(p.shortEdgeSupport===null?'':(' · petites rives '+(p.shortEdgeSupport?'sur appuis ✓':'à corriger'))) +(p.jointSupportCount?'<br>Supports sous joints : '+p.jointSupportCount+' pièce(s) · '+fmt(p.totalSupportLength)+' m':'');result.append(div);}if(result&&l&&!$('#jwLoadSupportResult')){const div=document.createElement('div');div.id='jwLoadSupportResult';div.innerHTML='<br><b>Descente de charges</b> : '+l.direct.length+' ligne(s) directement reprises · '+l.unresolved.length+' reprise(s) à dimensionner.';result.append(div);}}
 }
 const obs=new MutationObserver(enhance);obs.observe(dlg,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});enhance();
}
function init(){install();const v=$('.version');if(v)v.textContent='v0.16.13';document.title='Plan Bâtiment Pro — v0.16.13';root.PBPFloorDetailsUIReady=true;}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
