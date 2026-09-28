/* v0.17.0 Clean Core — drawing options bar matching v0.16.16, no renderer patches. */
(function(root){
'use strict';
const $=s=>document.querySelector(s),app=root.PBPCleanApp;
function init(){
 if(!app||$('#drawingToolbar'))return;
 const style=document.createElement('style');style.textContent=`
 #app{grid-template-columns:minmax(0,1fr)}
 .workspace,.topbar{min-width:0}
 .plan-column{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;position:relative;overflow:hidden}
 #drawingToolbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 9px;background:#fff;border-bottom:1px solid #d9e2e8;flex:none;z-index:21}
 #drawingToolbar button,#drawingToolbar select{font-size:11px;min-height:31px;border:1px solid #d4dfe6;border-radius:6px;padding:5px 8px;background:#fff;white-space:nowrap}
 #drawingToolbar button.active{background:#eaf3f8;border-color:#99bdcf;color:#174d68}
 #drawingToolbar .draw-group{display:flex;align-items:center;flex-wrap:wrap;gap:5px;min-width:0;max-width:100%}
 #drawingToolbar .draw-group + .draw-group{border-left:1px solid #e3e9ed;padding-left:7px}
 #drawingToolbar .draw-title{font-size:10px;color:#6d818d;font-weight:700;letter-spacing:.06em;margin-right:3px}
 #drawingToolbar .draw-check{display:flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap;min-height:31px}
 #drawingToolbar .draw-check input{margin:0 2px;accent-color:#245c7d}
 #drawingToolbar #magRef{width:158px;max-width:40vw;min-width:0}
 #drawingToolbar .zoom-controls{margin-left:auto;border:0;padding:0}
 #drawingToolbar .zoom-controls button{min-width:29px;padding:5px}
 #drawingToolbar .zoom-controls .zoom-value{min-width:54px}
 #drawingToolbar #drawOptions{font-weight:600}
 #drawingOptions{position:absolute;right:8px;top:52px;z-index:31;width:min(300px,calc(100% - 16px));padding:12px;background:#fff;border:1px solid #cbd9e2;border-radius:9px;box-shadow:0 8px 26px #203b4d26;font-size:12px;max-height:calc(100% - 70px);overflow:auto}
 #drawingOptions[hidden]{display:none}
 #drawingOptions h3{font-size:13px;margin:0 0 9px}
 #drawingOptions label{display:flex;align-items:center;gap:7px;margin:10px 0;line-height:1.4}
 #drawingOptions select{margin-left:auto;padding:5px;min-width:90px;border:1px solid #d1dce3;border-radius:5px;background:white}
 #drawingOptions p{font-size:11px;line-height:1.45;color:#617681;margin:10px 0}
 .draw-close{float:right;font-size:13px;padding:0 5px;min-height:22px}
 #canvasShell>#propertiesPanel{max-width:calc(100% - 20px)}
 @media(max-width:1100px){#drawingToolbar .draw-title{display:none}#drawingToolbar{gap:5px;padding:6px}#drawingToolbar #magRef{width:137px}}
 @media(max-width:600px){#drawingToolbar .draw-group + .draw-group{border-left:0;padding-left:0}#drawingToolbar button,#drawingToolbar select{font-size:11px}.tools-panel{flex:0 0 135px;width:135px}}
 `;document.head.append(style);
 const shell=$('#canvasShell'),column=document.createElement('div');column.className='plan-column';shell.before(column);
 const bar=document.createElement('div');bar.id='drawingToolbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Options du dessin');
 bar.innerHTML='<span class="draw-title">DESSIN</span>'+
  '<div class="draw-group" id="drawDimensions"><button id="drawCotes" type="button">↔ Cotes ✓</button><button id="drawOptions" type="button">Options ▾</button></div>'+
  '<div class="draw-group" id="drawMagnets"><button id="magToggle" type="button">Aimant murs ✓</button><label class="draw-check"><input id="magCross" type="checkbox" checked> Repères niveaux</label><select id="magRef" aria-label="Niveau de référence"></select></div>'+
  '<div class="draw-group" id="drawViews"><button id="drawGrid" type="button">▦ Grille ✓</button></div>';
 column.append(bar,shell);
 const props=$('#propertiesPanel');if(props)shell.append(props);
 const overlay=$('#overlayBtn');if(overlay)$('#drawViews').append(overlay);
 const zoom=$('.zoom-controls');if(zoom)bar.append(zoom);
 const panel=document.createElement('section');panel.id='drawingOptions';panel.hidden=true;panel.innerHTML=
  '<button type="button" class="draw-close" id="drawCloseOptions">×</button><h3>Affichage des cotes</h3>'+
  '<label><input type="checkbox" id="dimAutomatic" checked> Longueurs des murs automatiques</label>'+
  '<label><input type="checkbox" id="dimManual" checked> Cotes ajoutées avec l’outil Cote</label>'+
  '<label><input type="checkbox" id="dimSelection"> Seulement l’élément sélectionné</label>'+
  '<label>Mode automatique <select id="dimProfile"><option value="architect">Architecte</option><option value="permit">Permis</option><option value="execution">Exécution</option><option value="simple">Simple</option></select></label>'+
  '<label>Unité <select id="dimUnit"><option value="m">Mètres</option><option value="cm">Centimètres</option><option value="mm">Millimètres</option></select></label>'+
  '<p>Les options d’affichage ne changent pas la structure. Les calculs lourds restent liés aux feuillets.</p>';
 column.append(panel);
 function fillRefs(){
  const sel=$('#magRef'),active=app.model.activeLevelId,old=app.magnet.reference;sel.replaceChildren();
  const none=document.createElement('option');none.value='below';none.textContent='Niveau porteur inférieur';sel.append(none);
  for(const l of app.model.storyLevels()){if(l.id===active)continue;const o=document.createElement('option');o.value=l.id;o.textContent=l.name;sel.append(o);}
  sel.value=[...sel.options].some(o=>o.value===old)?old:'below';
  if(sel.value!==old)app.setMagnet({reference:sel.value});
 }
 function sync(){
  $('#drawCotes').classList.toggle('active',app.display.dimensions!==false);$('#drawCotes').textContent='↔ Cotes '+(app.display.dimensions!==false?'✓':'—');
  $('#drawGrid').classList.toggle('active',app.display.grid!==false);$('#drawGrid').textContent='▦ Grille '+(app.display.grid!==false?'✓':'—');
  $('#magToggle').classList.toggle('active',app.magnet.enabled!==false);$('#magToggle').textContent='Aimant murs '+(app.magnet.enabled!==false?'✓':'—');
  $('#magCross').checked=app.magnet.crossLevels!==false;$('#dimAutomatic').checked=app.display.automatic!==false;$('#dimManual').checked=app.display.manual!==false;$('#dimSelection').checked=app.display.selectedOnly===true;$('#dimProfile').value=app.display.profile||'architect';$('#dimUnit').value=app.display.unit||'m';fillRefs();
 }
 function showOptions(show){panel.hidden=!show;$('#drawOptions').setAttribute('aria-expanded',String(show));}
 $('#drawCotes').onclick=()=>app.setDisplay({dimensions:app.display.dimensions===false});
 $('#drawGrid').onclick=()=>app.setDisplay({grid:app.display.grid===false});
 $('#magToggle').onclick=()=>app.setMagnet({enabled:app.magnet.enabled===false});
 $('#magCross').onchange=e=>app.setMagnet({crossLevels:e.target.checked});
 $('#magRef').onchange=e=>app.setMagnet({reference:e.target.value});
 $('#drawOptions').onclick=()=>showOptions(panel.hidden);$('#drawCloseOptions').onclick=()=>showOptions(false);
 $('#dimAutomatic').onchange=e=>app.setDisplay({automatic:e.target.checked});$('#dimManual').onchange=e=>app.setDisplay({manual:e.target.checked});$('#dimSelection').onchange=e=>app.setDisplay({selectedOnly:e.target.checked});$('#dimProfile').onchange=e=>app.setDisplay({profile:e.target.value});$('#dimUnit').onchange=e=>app.setDisplay({unit:e.target.value});
 root.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!$('#drawOptions').contains(e.target))showOptions(false);});
 app.bus.on('displayChanged',sync);app.bus.on('magnetChanged',sync);app.bus.on('sheetChanged',sync);app.bus.on('changed',sync);sync();
 root.PBPCleanToolbarReady=true;
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
