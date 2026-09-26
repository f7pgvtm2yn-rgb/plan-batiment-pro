/* Presentation only: no engineering input is silently confirmed. */
(function(){'use strict';
const $=s=>document.querySelector(s),fmt=(v,n=1)=>Number.isFinite(v)?v.toFixed(n).replace('.',','):'—';
function decorate(){
 const body=$('#jwBody');if(!body)return;
 if($('#jwMaterial')&&!$('#rimRule')){
  const p=document.createElement('p');p.id='rimRule';p.className='jw-note';p.textContent='Appui automatique : max(5 cm ; épaisseur du mur / 2 − 0,5 cm), calculé portion par portion. Le mur inférieur remonte sur son axe et son épaisseur d’origine jusqu’au dessus des solives, sans remonter dans le panneau. Les rives bois restent distinctes des murs. Aucun connecteur ni sabot n’est pris en compte.';
  $('#jwMaterial').closest('label').after(p);
 }
 const result=body.querySelector('.jw-result'),r=window.PBPRims.getLastPreview();
 if(!result?.querySelector('b')||!r?.rim?.applied||$('#rimSummary'))return;
 const p=document.createElement('div');p.id='rimSummary';p.style.marginTop='8px';
 const title=document.createElement('b');title.textContent='Appuis, rives bois et remontées de murs';p.append(title,document.createElement('br'));
 const seats=[...new Set(r.rim.entries.flatMap(e=>e.seatCount===2?[e.seatA,e.seatB]:[e.seat]).filter(Number.isFinite).map(x=>fmt(x*100)+' cm'))];
 p.append(document.createTextNode('Appuis calculés : '+(seats.join(' / ')||'—')+' · hauteur des rives bois : '+fmt(r.rim.height*100)+' cm.'));
 p.append(document.createElement('br'),document.createTextNode('Longueurs totales des solives avec appuis : '+r.rim.bays.map(b=>fmt(b.cutLength,2)+' m').join(' / ')));
 if(r.rim.commonRims?.length)p.append(document.createElement('br'),document.createTextNode('Appuis communs face à face : '+r.rim.commonRims.length+'.'));
 if(r.rim.longitudinal?.length)p.append(document.createElement('br'),document.createTextNode('Rives bois longitudinales : '+r.rim.longitudinal.length+'.'));
 if(r.rim.wallExtensions?.length)p.append(document.createElement('br'),document.createTextNode('Remontées des murs inférieurs : '+r.rim.wallExtensions.length+' portion(s), arrêtées au-dessus des solives.'));
 result.appendChild(p);
}
function init(){
 if(!$('#jwBody'))throw Error('Assistant de solivage absent.');
 new MutationObserver(decorate).observe($('#jwBody'),{childList:true,subtree:true});
 $('.version').textContent='v0.12.1';document.title='Plan Bâtiment Pro — v0.12.1';
 window.PBPRimUIReady=true;decorate();
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',init);else init();
})();

