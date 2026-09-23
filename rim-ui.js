/* Presentation only: no engineering input is silently confirmed. */
(function(){'use strict';
const $=s=>document.querySelector(s),fmt=(v,n=1)=>Number.isFinite(v)?v.toFixed(n).replace('.',','):'—';
function decorate(){
 const body=$('#jwBody');if(!body)return;
 if($('#jwMaterial')&&!$('#rimRule')){
  const p=document.createElement('p');p.id='rimRule';p.className='jw-note';p.textContent='Rive automatique : largeur du mur − 15 cm d’appui. Pour les murs simples de plus de 30 cm, la largeur restante est calculée sans saisie manuelle ; la hauteur suit le plancher au-dessus du mur.';
  $('#jwMaterial').closest('label').after(p);
 }
 const result=body.querySelector('.jw-result'),r=window.PBPRims.getLastPreview();
 if(!result?.querySelector('b')||!r?.rim?.applied||$('#rimSummary'))return;
 const p=document.createElement('div');p.id='rimSummary';p.style.marginTop='8px';
 const title=document.createElement('b');title.textContent='Rives automatiques';p.append(title,document.createElement('br'));
 p.append(document.createTextNode([...new Set(r.rim.entries.map(e=>fmt(e.width*100)+' cm'))].join(' / ')+' de largeur · '+fmt(r.rim.height*100)+' cm de hauteur.'));
 p.append(document.createElement('br'),document.createTextNode('Longueurs totales des solives avec appuis : '+r.rim.bays.map(b=>fmt(b.cutLength,2)+' m').join(' / ')));
 result.appendChild(p);
}
function init(){
 if(!$('#jwBody'))throw Error('Assistant de solivage absent.');
 new MutationObserver(decorate).observe($('#jwBody'),{childList:true,subtree:true});
 $('.version').textContent='v0.10.3';document.title='Plan Bâtiment Pro — v0.10.3';
 window.PBPRimUIReady=true;decorate();
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',init);else init();
})();

