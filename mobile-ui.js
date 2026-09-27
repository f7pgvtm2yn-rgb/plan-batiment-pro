/* Plan Bâtiment Pro v0.16.15 — mobile adaptive workspace. */
(function(root){
'use strict';
const $=s=>document.querySelector(s),app=root.planApp,MOBILE_MAX=700;
let active=false,panMode=false,panDrag=null,moreOpen=false,toolsOpen=false;
const mq=root.matchMedia('(max-width:'+MOBILE_MAX+'px)');
function isMobile(){return mq.matches;}
function currentView(){return app.viewMode==='3d'?'3d':'2d';}
function renderLevelSelect(select){
 const source=$('#levelSelect');if(!select||!source)return;
 const sig=[...source.options].map(o=>o.value+'|'+o.textContent).join('||');
 if(select.dataset.signature!==sig){select.replaceChildren(...[...source.options].map(o=>{const n=document.createElement('option');n.value=o.value;n.textContent=o.textContent.replace(/^▤\\s*/,'');return n;}));select.dataset.signature=sig;}
 select.value=source.value;
}
function sync(){
 if(!active)return;renderLevelSelect($('#mobileLevel'));
 const view=$('#mobileView'),pan=$('#mobilePan');if(view)view.innerHTML=currentView()==='3d'?'▱<span>2D</span>':'◇<span>3D</span>';
 if(pan){pan.classList.toggle('active',panMode);pan.setAttribute('aria-pressed',String(panMode));}
 document.body.classList.toggle('mobile-tools-open',toolsOpen);document.body.classList.toggle('mobile-more-open',moreOpen);
 const menu=$('#mobileMoreSheet');if(menu)menu.hidden=!moreOpen;const backdrop=$('#mobileBackdrop');if(backdrop)backdrop.hidden=!(toolsOpen||moreOpen);
}
function closeSheets(){toolsOpen=false;moreOpen=false;sync();}
function setPanMode(on){panMode=!!on;panDrag=null;sync();}
function toggleView(){document.querySelector('[data-view="'+(currentView()==='3d'?'2d':'3d')+'"]')?.click();setPanMode(false);sync();}
function build(){
 if($('#mobileBar'))return;
 const backdrop=document.createElement('div');backdrop.id='mobileBackdrop';backdrop.hidden=true;backdrop.addEventListener('pointerdown',closeSheets);document.body.append(backdrop);
 const bar=document.createElement('nav');bar.id='mobileBar';bar.setAttribute('aria-label','Commandes mobiles');bar.innerHTML=
 '<button id="mobileTools" type="button">☰<span>Outils</span></button>'+
 '<label class="mobile-level-wrap"><span>Niveau</span><select id="mobileLevel" aria-label="Niveau actif"></select></label>'+
 '<button id="mobilePan" type="button" aria-pressed="false">✥<span>Déplacer</span></button>'+
 '<button id="mobileView" type="button">◇<span>3D</span></button>'+
 '<button id="mobileMore" type="button">•••<span>Plus</span></button>';document.body.append(bar);
 const more=document.createElement('div');more.id='mobileMoreSheet';more.hidden=true;more.innerHTML=
 '<div class="mobile-sheet-handle"></div><div class="mobile-sheet-title">Commandes</div><div class="mobile-command-grid">'+
 [['#saveBtn','💾','Enregistrer'],['#undoBtn','↶','Annuler'],['#redoBtn','↷','Rétablir'],['#zoomOutBtn','−','Dézoomer'],['#zoomResetBtn','◎','Centrer'],['#zoomInBtn','＋','Zoomer'],['#overlayBtn','◫','Superposer'],['#newProjectBtn','＋','Nouveau'],['#exportBtn','⇧','Exporter']].map(x=>'<button data-mobile-proxy="'+x[0]+'">'+x[1]+'<span>'+x[2]+'</span></button>').join('')+
 '<button id="mobileOpenJson">⇩<span>Ouvrir JSON</span></button><button id="mobileImportPlan">▧<span>Importer plan</span></button></div>';document.body.append(more);
 $('#mobileTools').onclick=()=>{toolsOpen=!toolsOpen;moreOpen=false;sync();};$('#mobileMore').onclick=()=>{moreOpen=!moreOpen;toolsOpen=false;sync();};$('#mobilePan').onclick=()=>{setPanMode(!panMode);closeSheets();};$('#mobileView').onclick=toggleView;
 $('#mobileLevel').onchange=e=>{const source=$('#levelSelect');if(source){source.value=e.target.value;source.dispatchEvent(new Event('change',{bubbles:true}));}closeSheets();};
 more.querySelectorAll('[data-mobile-proxy]').forEach(b=>b.onclick=()=>{document.querySelector(b.dataset.mobileProxy)?.click();if(!['#zoomOutBtn','#zoomResetBtn','#zoomInBtn'].includes(b.dataset.mobileProxy))closeSheets();});
 $('#mobileOpenJson').onclick=()=>{$('#importInput')?.click();closeSheets();};$('#mobileImportPlan').onclick=()=>{$('#importPlanBtn')?.click();closeSheets();};
 const source=$('#levelSelect');if(source){source.addEventListener('change',sync);new MutationObserver(sync).observe(source,{childList:true,subtree:true,attributes:true});}
 document.querySelector('.tools-panel')?.addEventListener('click',e=>{if(e.target.closest('button.tool')||e.target.closest('.work-content>button')){toolsOpen=false;sync();}});
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setTimeout(sync,0)));
}
function bindPan(){
 const canvas=$('#planCanvas');if(!canvas||canvas.dataset.mobilePanBound)return;canvas.dataset.mobilePanBound='1';
 canvas.addEventListener('pointerdown',e=>{if(!active||!panMode||e.pointerType!=='touch')return;e.preventDefault();e.stopImmediatePropagation();panDrag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:{...app.renderer2d.pan}};canvas.setPointerCapture?.(e.pointerId);},true);
 canvas.addEventListener('pointermove',e=>{if(!active||!panMode||!panDrag||e.pointerId!==panDrag.id)return;e.preventDefault();e.stopImmediatePropagation();app.renderer2d.pan={x:panDrag.pan.x+e.clientX-panDrag.x,y:panDrag.pan.y+e.clientY-panDrag.y};app.renderer2d.draw();},true);
 const end=e=>{if(!panDrag||e.pointerId!==panDrag.id)return;if(active&&panMode){e.preventDefault();e.stopImmediatePropagation();}panDrag=null;};
 canvas.addEventListener('pointerup',end,true);canvas.addEventListener('pointercancel',end,true);
}
function addStyle(){
 if($('#mobileStyle'))return;const s=document.createElement('style');s.id='mobileStyle';s.textContent=`
#mobileBar,#mobileMoreSheet,#mobileBackdrop{display:none}
@media(max-width:${MOBILE_MAX}px){
 html,body{height:100%;height:100dvh;overscroll-behavior:none}
 body.pbp-mobile{--mobile-bar:calc(62px + env(safe-area-inset-bottom));--mobile-top:calc(46px + env(safe-area-inset-top))}
 body.pbp-mobile #app{height:100dvh;grid-template-rows:var(--mobile-top) minmax(0,1fr) var(--mobile-bar)!important}
 body.pbp-mobile .topbar{min-height:var(--mobile-top)!important;height:var(--mobile-top);padding:env(safe-area-inset-top) 8px 0!important;flex-wrap:nowrap!important;overflow:hidden;background:rgba(255,255,255,.97)}
 body.pbp-mobile .brand{display:flex!important;font-size:11px!important;align-items:center;gap:5px;max-width:45vw;overflow:hidden;white-space:nowrap}
 body.pbp-mobile .top-actions{display:flex!important;justify-content:flex-end!important;flex-wrap:nowrap!important;gap:3px!important;min-width:0}
 body.pbp-mobile .top-actions>*{display:none!important}
 body.pbp-mobile .top-actions #saveBtn,body.pbp-mobile .top-actions #undoBtn,body.pbp-mobile .top-actions #redoBtn{display:inline-flex!important;width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;align-items:center;justify-content:center}
 body.pbp-mobile .top-actions #saveBtn{font-size:0!important}body.pbp-mobile .top-actions #saveBtn:before{content:'💾';font-size:17px}body.pbp-mobile .top-actions #undoBtn,body.pbp-mobile .top-actions #redoBtn{font-size:18px!important}
 body.pbp-mobile .workspace{position:relative;overflow:hidden}body.pbp-mobile .canvas-shell{position:absolute!important;inset:0!important;width:100%!important;height:100%!important}
 body.pbp-mobile .tools-panel{display:block!important;position:fixed!important;z-index:160!important;left:0!important;top:0!important;bottom:0!important;width:min(88vw,360px)!important;max-width:none!important;transform:translateX(-104%);transition:transform .2s ease;padding:calc(12px + env(safe-area-inset-top)) 10px calc(80px + env(safe-area-inset-bottom))!important;background:#fff;box-shadow:12px 0 32px rgba(20,38,50,.24);overflow:auto!important}
 body.pbp-mobile.mobile-tools-open .tools-panel{transform:translateX(0)}body.pbp-mobile .tools-panel button,body.pbp-mobile .tools-panel select{min-height:44px;font-size:14px!important}body.pbp-mobile .work-category>summary{min-height:48px;display:flex;align-items:center;font-size:14px!important}
 body.pbp-mobile .properties-panel{position:fixed!important;z-index:145!important;left:0!important;right:0!important;top:auto!important;bottom:var(--mobile-bar)!important;width:auto!important;max-width:none!important;max-height:58dvh!important;border-radius:16px 16px 0 0!important;border-left:0;border-right:0;border-bottom:0;box-shadow:0 -10px 30px rgba(20,38,50,.20)}
 body.pbp-mobile .properties-header{min-height:44px;padding:8px 14px!important}body.pbp-mobile #propertiesBody{padding:10px 14px calc(16px + env(safe-area-inset-bottom))!important}body.pbp-mobile .prop-row{grid-template-columns:1fr minmax(110px,42%)!important;font-size:13px!important}body.pbp-mobile .prop-row input,body.pbp-mobile .prop-row select{min-height:42px;font-size:16px!important}
 body.pbp-mobile .statusbar{display:none!important}
 body.pbp-mobile #mobileBar{display:grid;grid-template-columns:1fr 1.3fr 1fr 1fr 1fr;position:fixed;z-index:180;left:0;right:0;bottom:0;height:var(--mobile-bar);padding:5px max(5px,env(safe-area-inset-right)) env(safe-area-inset-bottom) max(5px,env(safe-area-inset-left));background:rgba(255,255,255,.98);border-top:1px solid #d5dfe5;box-shadow:0 -4px 16px rgba(30,50,65,.10)}
 body.pbp-mobile #mobileBar button,body.pbp-mobile .mobile-level-wrap{border:0!important;background:transparent!important;border-radius:9px!important;min-width:0;min-height:52px;padding:4px 2px!important;color:#35586b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:20px;line-height:1}
 body.pbp-mobile #mobileBar button span,body.pbp-mobile .mobile-level-wrap>span{font-size:9px;font-weight:700;line-height:1.1}body.pbp-mobile #mobileBar button.active{background:#e7f1f6!important;color:#174d68!important}
 body.pbp-mobile .mobile-level-wrap select{width:100%;height:31px;min-height:31px;border:0;background:transparent;color:#234c61;font-size:11px;font-weight:700;text-align:center;text-overflow:ellipsis;padding:0 2px}
 body.pbp-mobile #mobileBackdrop{display:block;position:fixed;z-index:150;inset:0;background:rgba(20,35,45,.28)}body.pbp-mobile #mobileBackdrop[hidden]{display:none}
 body.pbp-mobile #mobileMoreSheet{display:block;position:fixed;z-index:170;left:8px;right:8px;bottom:calc(var(--mobile-bar) + 7px);max-height:62dvh;overflow:auto;background:#fff;border:1px solid #d6e0e6;border-radius:16px;box-shadow:0 15px 45px rgba(25,45,60,.28);padding:7px 10px 12px}body.pbp-mobile #mobileMoreSheet[hidden]{display:none}
 body.pbp-mobile .mobile-sheet-handle{width:38px;height:4px;background:#c3ced5;border-radius:10px;margin:2px auto 7px}.mobile-sheet-title{font-size:12px;font-weight:800;color:#34596b;padding:3px 4px 8px}.mobile-command-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.mobile-command-grid button{min-height:62px;border:1px solid #d9e2e7;border-radius:10px;background:#f9fbfc;padding:7px 3px;font-size:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}.mobile-command-grid button span{font-size:10px;font-weight:650;color:#45616f}
 body.pbp-mobile dialog{position:fixed!important;inset:auto 0 0 0!important;margin:0!important;width:100vw!important;max-width:100vw!important;max-height:90dvh!important;border-radius:18px 18px 0 0!important;border-left:0!important;border-right:0!important;border-bottom:0!important;overflow:auto!important}
 body.pbp-mobile dialog form{padding:15px 14px calc(18px + env(safe-area-inset-bottom))!important}body.pbp-mobile dialog input:not([type=checkbox]),body.pbp-mobile dialog select,body.pbp-mobile dialog textarea{font-size:16px!important;min-height:44px}body.pbp-mobile dialog button{min-height:44px!important;font-size:13px!important}
 body.pbp-mobile .b-row,body.pbp-mobile .jw-row{grid-template-columns:1fr minmax(120px,45%)!important;gap:8px!important}body.pbp-mobile #joistWizard,body.pbp-mobile #bDialog{width:100vw!important;max-width:100vw!important}
 body.pbp-mobile #splitter{display:none!important}body.pbp-mobile #view2d,body.pbp-mobile #view3d{flex:1 1 100%!important;width:100%!important}
 body.pbp-mobile #drawingToolbar{left:6px!important;right:6px!important;bottom:6px!important;max-width:none!important;overflow-x:auto;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch}body.pbp-mobile #drawingToolbar button{min-width:44px;min-height:40px}
}
@media(max-width:420px){body.pbp-mobile .brand{max-width:34vw}body.pbp-mobile .b-row,body.pbp-mobile .jw-row{grid-template-columns:1fr!important}}
`;document.head.append(s);
}
function activate(){
 active=isMobile();document.body.classList.toggle('pbp-mobile',active);
 if(!active){toolsOpen=false;moreOpen=false;panMode=false;document.body.classList.remove('mobile-tools-open','mobile-more-open');return;}
 const meta=document.querySelector('meta[name="viewport"]');if(meta&&!meta.content.includes('viewport-fit'))meta.content='width=device-width,initial-scale=1,viewport-fit=cover';
 if(app.viewMode==='split')document.querySelector('[data-view="2d"]')?.click();build();bindPan();setTimeout(()=>{app.renderer2d?.resize();app.renderer3d?.resize();sync();},30);
}
function init(){addStyle();build();bindPan();activate();mq.addEventListener?.('change',activate);root.addEventListener('orientationchange',()=>setTimeout(activate,80));root.addEventListener('resize',()=>{if(isMobile()!==active)activate();else if(active)setTimeout(()=>{app.renderer2d?.resize();app.renderer3d?.resize();sync();},30);});const v=$('.version');if(v)v.textContent='v0.16.15';document.title='Plan Bâtiment Pro — v0.16.15';root.PBPMobileReady=true;}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
