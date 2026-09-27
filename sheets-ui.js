/* Plan Bâtiment Pro v0.16.16 — Excel-like sheet navigation and lazy compute UX. */
(function(root){
'use strict';
const app=root.planApp,S=root.PBPSheets,$=s=>document.querySelector(s);
if(!app||!S)throw Error('Feuillets indisponibles.');
let last2D=null,internalView=false,mobileOpen=false,pendingRevision=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sheetStatusLabel(x){return x==='current'?'À jour':x==='stale'?'À actualiser':'Jamais calculé';}
function setView(mode){const b=document.querySelector('[data-view="'+mode+'"]');if(!b)return;internalView=true;b.click();internalView=false;}
function setLevel(id){if(!id)return;app.model.activeLevelId=id;const sel=$('#levelSelect');if(sel&&[...sel.options].some(o=>o.value===id)){sel.value=id;sel.dispatchEvent(new Event('change',{bubbles:true}));}}
function computeActive(sheet){
 if(sheet.kind==='floor'){root.PBPBuildingUI?.calculateNow?.();S.markCalculated(sheet.id);return;}
 if(sheet.kind==='foundations'){root.PBPFoundationUI?.getReport?.();S.markCalculated(sheet.id);return;}
 if(sheet.kind==='roof'){root.PBPRoofUI?.getReport?.();S.markCalculated(sheet.id);return;}
 if(sheet.kind==='3d'){root.PBPBuildingUI?.getReport?.();root.PBPFoundationUI?.getReport?.();root.PBPStructureUI?.getReport?.();root.PBPRoofUI?.getReport?.();S.markCalculated(sheet.id);}
}
function activate(id,opts={}){
 const sheet=S.setActive(id);if(!sheet)return;
 if(sheet.kind!=='3d')last2D=sheet.id;
 if(sheet.kind==='3d'){setView(opts.keepView?app.viewMode:'3d');computeActive(sheet);app.renderer3d?.draw();}
 else{setView(opts.keepView?app.viewMode:'2d');setLevel(sheet.levelId);computeActive(sheet);if(sheet.kind==='floor')setLevel(sheet.levelId);app.renderer2d?.draw();}
 renderAll();
}
function tabButton(sheet){
 const st=S.status(sheet.id),state=st==='current'?'current':st==='stale'?'stale':'never';
 return '<button type="button" class="sheet-tab '+state+'" data-sheet-id="'+esc(sheet.id)+'" title="'+esc(sheetStatusLabel(st))+'"><span class="sheet-icon">'+esc(sheet.icon)+'</span><span class="sheet-label">'+esc(sheet.label)+'</span>'+(sheet.subtitle?'<span class="sheet-sub">'+esc(sheet.subtitle)+'</span>':'')+(sheet.kind==='story'?'':'<span class="sheet-state-dot" aria-label="'+esc(sheetStatusLabel(st))+'"></span>')+'</button>';
}
function renderDesktop(){
 const bar=$('#sheetBar');if(!bar)return;const active=S.active(),rows=S.sheets();
 bar.innerHTML='<div class="sheet-caption">FEUILLETS</div><div class="sheet-scroll">'+rows.map(tabButton).join('')+'</div>';
 bar.querySelectorAll('[data-sheet-id]').forEach(b=>{b.classList.toggle('active',b.dataset.sheetId===active?.id);b.onclick=()=>activate(b.dataset.sheetId);});
}
function renderMobile(){
 const list=$('#mobileSheetList'),button=$('#mobileSheets');if(!list||!button)return;const active=S.active();
 button.innerHTML=(active?.icon||'▱')+'<span>Feuillets</span>';list.innerHTML=S.sheets().map(tabButton).join('');
 list.querySelectorAll('[data-sheet-id]').forEach(b=>{b.classList.toggle('active',b.dataset.sheetId===active?.id);b.onclick=()=>{mobileOpen=false;document.body.classList.remove('mobile-sheets-open');$('#sheetMobileBackdrop').hidden=true;$('#mobileSheetDrawer').hidden=true;activate(b.dataset.sheetId);};});
}
function renderAll(){renderDesktop();renderMobile();}
function build(){
 if(!$('#sheetBar')){const bar=document.createElement('nav');bar.id='sheetBar';bar.setAttribute('aria-label','Feuillets du projet');document.querySelector('.statusbar')?.before(bar);}
 const mobileBar=$('#mobileBar');
 if(mobileBar&&!$('#mobileSheets')){
  const old=mobileBar.querySelector('.mobile-level-wrap');if(old)old.hidden=true;
  const b=document.createElement('button');b.id='mobileSheets';b.type='button';b.innerHTML='▱<span>Feuillets</span>';mobileBar.insertBefore(b,mobileBar.firstChild);
  const drawer=document.createElement('div');drawer.id='mobileSheetDrawer';drawer.hidden=true;drawer.innerHTML='<div class="sheet-mobile-handle"></div><div class="sheet-mobile-title">Feuillets du projet</div><div id="mobileSheetList"></div>';document.body.append(drawer);
  const back=document.createElement('div');back.id='sheetMobileBackdrop';back.hidden=true;back.onclick=()=>{mobileOpen=false;drawer.hidden=true;back.hidden=true;document.body.classList.remove('mobile-sheets-open');};document.body.append(back);
  const closeMobile=()=>{mobileOpen=false;drawer.hidden=true;back.hidden=true;document.body.classList.remove('mobile-sheets-open');};
  b.onclick=()=>{mobileOpen=!mobileOpen;drawer.hidden=!mobileOpen;back.hidden=!mobileOpen;document.body.classList.toggle('mobile-sheets-open',mobileOpen);renderMobile();};
  for(const id of ['#mobileMore','#mobileTools'])$(id)?.addEventListener('click',closeMobile,true);
 }
}
function bindViews(){
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{
  if(internalView)return;const mode=b.dataset.view;
  if(mode==='3d'||mode==='split'){if(S.active()?.kind!=='3d')activate('3d',{keepView:true});}
  else if(mode==='2d'&&S.active()?.kind==='3d'){const id=last2D&&S.sheets().some(s=>s.id===last2D)?last2D:S.sheets().find(s=>s.kind==='story')?.id;if(id)activate(id,{keepView:true});}
 }));
}
function init(){
 const style=document.createElement('style');style.id='sheetStyle';style.textContent=`
 #sheetBar{height:38px;display:flex;align-items:stretch;background:#f6f8fa;border-top:1px solid #d5dfe5;border-bottom:1px solid #d5dfe5;min-width:0;overflow:hidden}
 .sheet-caption{display:flex;align-items:center;padding:0 9px;font-size:9px;font-weight:800;color:#718591;border-right:1px solid #d5dfe5;letter-spacing:.5px}
 .sheet-scroll{display:flex;align-items:stretch;gap:1px;overflow-x:auto;overflow-y:hidden;min-width:0;scrollbar-width:thin}
 .sheet-tab{position:relative;display:grid;grid-template-columns:auto auto auto;align-items:center;gap:5px;min-width:max-content;height:37px;border:0!important;border-right:1px solid #e0e6ea!important;border-radius:0!important;background:#f6f8fa!important;padding:0 11px!important;color:#48606e!important;font-size:10px!important}
 .sheet-tab:hover{background:#eef4f7!important}.sheet-tab.active{background:white!important;color:#174d68!important;box-shadow:inset 0 3px 0 #3f7895}
 .sheet-icon{font-size:13px}.sheet-label{font-weight:700}.sheet-sub{font-size:8px;color:#83939c}.sheet-state-dot{width:7px;height:7px;border-radius:50%;margin-left:2px;background:#adb8be}
 .sheet-tab.current .sheet-state-dot{background:#4f9b68}.sheet-tab.stale .sheet-state-dot{background:#d49336}.sheet-tab.never .sheet-state-dot{background:#aeb9bf}
 body:not(.pbp-mobile) #app{grid-template-rows:auto minmax(0,1fr) 38px 30px!important}
 #mobileSheetDrawer,#sheetMobileBackdrop{display:none}
 @media(max-width:700px){
  #sheetBar{display:none!important}
  body.pbp-mobile #mobileBar{grid-template-columns:1fr 1fr 1fr 1fr 1fr!important}
  body.pbp-mobile #mobileBar .mobile-level-wrap{display:none!important}
  body.pbp-mobile #mobileSheetDrawer{display:block;position:fixed;z-index:176;left:8px;right:8px;bottom:calc(var(--mobile-bar) + 7px);max-height:68dvh;overflow:auto;background:#fff;border:1px solid #d6e0e6;border-radius:16px;box-shadow:0 15px 45px rgba(25,45,60,.28);padding:7px 10px 12px}
  body.pbp-mobile #mobileSheetDrawer[hidden]{display:none}
  body.pbp-mobile #sheetMobileBackdrop{display:block;position:fixed;z-index:168;inset:0;background:rgba(20,35,45,.28)}
  body.pbp-mobile #sheetMobileBackdrop[hidden]{display:none}
  .sheet-mobile-handle{width:38px;height:4px;background:#c3ced5;border-radius:10px;margin:2px auto 7px}.sheet-mobile-title{font-size:13px;font-weight:800;color:#34596b;padding:4px 3px 9px}
  #mobileSheetList{display:grid;grid-template-columns:1fr;gap:5px}
  #mobileSheetList .sheet-tab{height:auto;min-height:50px;border:1px solid #dbe3e8!important;border-radius:10px!important;background:#f8fafb!important;padding:7px 10px!important;grid-template-columns:26px 1fr auto;text-align:left}
  #mobileSheetList .sheet-tab.active{background:#eaf3f7!important;box-shadow:none!important;border-color:#9fc1d2!important}
  #mobileSheetList .sheet-label{font-size:13px}#mobileSheetList .sheet-sub{font-size:10px;grid-column:2}
 }
 `;document.head.append(style);
 build();bindViews();
 $('#rfOpen')?.addEventListener('click',()=>{if(S.active()?.kind!=='roof')activate('roof');},true);
 for(const id of ['#faOpen','#stFoundationOpen'])$(id)?.addEventListener('click',()=>{if(S.active()?.kind!=='foundations')activate('foundations');},true);
 renderAll();
 root.addEventListener('pbp:model-revision',()=>{S.invalidateAll();if(app.dragWall){pendingRevision=true;return;}renderAll();});
 $('#planCanvas')?.addEventListener('pointerup',()=>{if(pendingRevision){pendingRevision=false;renderAll();}},true);
 $('#planCanvas')?.addEventListener('pointercancel',()=>{if(pendingRevision){pendingRevision=false;renderAll();}},true);
 root.addEventListener('pbp:sheet-status',()=>{if(app.dragWall){pendingRevision=true;return;}renderAll();});root.addEventListener('pbp:sheet-change',renderAll);
 const levels=$('#levelSelect');if(levels)new MutationObserver(renderAll).observe(levels,{childList:true,subtree:true});
 const current=S.active();if(current)activate(current.id);
 const v=$('.version');if(v)v.textContent='v0.16.16';document.title='Plan Bâtiment Pro — v0.16.16';root.PBPSheetsUI={activate,render:renderAll};root.PBPSheetsUIReady=true;
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
