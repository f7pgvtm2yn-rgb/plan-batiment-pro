/* v0.17.0 Clean Core — workspace layout matching final v0.16.16, without prototype patches. */
(function(root){
'use strict';
const $=s=>document.querySelector(s),app=root.PBPCleanApp;
function init(){
 if(!app||document.querySelector('#cleanWorkspaceReady'))return;
 const marker=document.createElement('i');marker.id='cleanWorkspaceReady';marker.hidden=true;document.body.append(marker);
 const style=document.createElement('style');style.textContent=`
 #app{grid-template-rows:auto minmax(0,1fr) 38px 30px}
 .topbar{min-height:54px;flex-wrap:wrap;padding:8px 10px;align-content:center;gap:7px}
 .top-actions{flex-wrap:wrap;overflow:visible;justify-content:flex-end;flex:1}
 .top-actions button,.top-actions select,.top-actions .file-button{font-size:11px;padding:6px 8px}
 .brand{font-size:13px}
 .tools-panel{flex:0 0 220px;width:220px;padding:10px;min-height:0;overflow:auto}
 .tools-panel .mode-title{font-size:11px;color:#486578;text-transform:uppercase;margin-bottom:0;padding:3px}
 .work-guide{font-size:10px;color:#7a8d98;padding:0 3px 7px}
 .work-category{border:1px solid #cddbe4;border-radius:8px;margin:8px 0;overflow:hidden;background:#f8fbfc}
 .work-category>summary{padding:10px 8px;font-size:12px;font-weight:700;color:#2f5569;cursor:pointer;background:#eef4f7;list-style:none}
 .work-category>summary:before{content:'▸ ';font-size:10px}.work-category[open]>summary:before{content:'▾ '}
 .work-content{padding:8px}.work-content>button{width:100%;text-align:left;margin:3px 0;padding:7px 6px;font-size:11px}
 .work-content>small{display:block;font-size:10px;color:#69808e;line-height:1.4;margin:4px 0 8px}
 .work-content .placement-settings{padding:7px;margin:8px 0 0}.work-content .setting-row{grid-template-columns:1fr 68px}
 .reconnect-placeholder{width:100%;text-align:left;opacity:.55;cursor:default}
 @media(max-width:850px){.tools-panel{flex-basis:166px;width:166px}.topbar{padding:6px}.work-category>summary{font-size:11px}}
 @media(max-width:550px){.tools-panel{flex-basis:132px;width:132px;padding:5px}.work-content{padding:5px}.work-content>small{font-size:9px}.work-content .placement-settings{display:none}.top-actions{justify-content:flex-start}}
 `;document.head.append(style);
 const sidebar=$('.tools-panel'),title=$('.mode-title');title.textContent='OUTILS';
 const guide=document.createElement('div');guide.className='work-guide';guide.textContent='Choisis ce que tu veux faire';title.after(guide);
 const makePlaceholder=text=>{const b=document.createElement('button');b.type='button';b.disabled=true;b.className='reconnect-placeholder';b.textContent=text;return b;};
 const defs=[
  ['✏️ Dessiner le plan','Tracer les murs, placer les ouvertures et modifier le plan.',[
   '[data-tool="select"]','[data-tool="wallExterior"]','[data-tool="wallBearing"]','[data-tool="partition"]','[data-tool="door"]','[data-tool="window"]','[data-tool="opening"]','[data-tool="stair"]','#placementSettings'
  ]],
  ['🧱 Structure','Poteaux, poutres, fondations et dalles.',[
   '[data-tool="column"]','[data-tool="beam"]','[data-tool="foundation"]','[data-tool="slab"]','#ccFoundationsSheet'
  ]],
  ['🪵 Planchers & solivage','Assistant complet : niveau, charges, zones, sens et calcul.',[
   '#ccCreateFloor'
  ]],
  ['⌂ Toiture & charpente','Calcul uniquement à l’ouverture du feuillet toiture.',[
   '#ccRoofSheet'
  ]],
  ['▧ Isolation & cloisons','Doublages, isolation et second œuvre.',[]],
  ['⌖ Pièces & annotations','Cotes et noms/surfaces des pièces.',[
   '[data-tool="dimension"]'
  ]],
  ['✓ Projet & contrôles','Vues, contrôles et accès à la version de secours.',[
   '#cc3DSheet','#ccLegacy'
  ]]
 ];
 const groups=[];
 defs.forEach(([name,note,selectors],i)=>{
  const d=document.createElement('details');d.className='work-category';d.id='workCategory'+i;
  const sum=document.createElement('summary');sum.textContent=name;
  const body=document.createElement('div');body.className='work-content';
  const small=document.createElement('small');small.textContent=note;body.append(small);
  selectors.forEach(sel=>{const el=$(sel);if(el)body.append(el);});
  if(i===4)body.append(makePlaceholder('▥ Second œuvre / Isolation — reconnexion v0.17'));
  if(i===5)body.append(makePlaceholder('Pièces · noms / surfaces — reconnexion v0.17'));
  d.append(sum,body);d.open=i===0;sidebar.append(d);groups.push(d);
  d.addEventListener('toggle',()=>{if(d.open)groups.forEach(o=>{if(o!==d)o.open=false;});});
 });
 sidebar.querySelectorAll(':scope>.tool-section').forEach(x=>{if(!x.closest('.work-content'))x.hidden=true;});
 const hint=sidebar.querySelector(':scope>.hint');if(hint)sidebar.append(hint);
 root.PBPCleanWorkspaceReady=true;
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
