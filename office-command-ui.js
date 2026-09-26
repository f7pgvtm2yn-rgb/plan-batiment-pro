/* Plan Bâtiment Pro v0.16.3 — Office / Word / Excel / Sheets command language without layout changes. */
(function(root){
'use strict';
const app=root.planApp,$=s=>document.querySelector(s);
if(!app)return;

const ICONS={
 newProjectBtn:'＋',saveBtn:'▣',exportBtn:'⇩',importPlanBtn:'▤',undoBtn:'↶',redoBtn:'↷',
 addLevelBtn:'＋',deleteLevelBtn:'−',overlayBtn:'◫',zoomOutBtn:'−',zoomResetBtn:'⌖',zoomInBtn:'＋',
 autoOpen:'⚙',bOpenMaterials:'▦',bOpenFloors:'▤',faOpen:'▰',stFoundationOpen:'⌗',faShow:'◉',
 joistAutoBtn:'≋',rfOpen:'⌂',envOpen:'▥',spaceNames:'Aa',spaceShow:'⌗',drawOptions:'▾',
 drawCotes:'↔',drawGrid:'▦',togglePlanSource:'▧',magToggle:'⌁'
};
const TOOL_ICONS={select:'↖',wallExterior:'▰',wallBearing:'▰',partition:'▏',column:'■',beam:'▬',door:'◩',window:'▭',opening:'□',stair:'≋',foundation:'▰',slab:'▱',dimension:'↔'};

function textNodeLabel(e){
 const texts=[...e.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim());
 return texts.map(n=>n.textContent.trim()).join(' ').trim()||e.textContent.trim();
}
function decorateButton(b){
 if(!b||b.dataset.officeDecorated==='true')return;
 b.dataset.officeDecorated='true';b.classList.add('office-command');
 const icon=ICONS[b.id]||TOOL_ICONS[b.dataset.tool]||'';
 if(icon&&!b.querySelector('.office-command-icon')){
  const label=textNodeLabel(b);if(label){
   [...b.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.remove());
   const i=document.createElement('span');i.className='office-command-icon';i.textContent=icon;
   const t=document.createElement('span');t.className='office-command-label';t.textContent=label.replace(/^[↖▰▏■▬▱◩▭□≋↔⌂⚙▤▥⌗◉＋−⇩↶↷◫⌖▦▧⌁]+s*/,'');
   b.prepend(i,t);
  }
 }
 if(b.classList.contains('tool'))b.classList.add('office-tool-command');
}
function decorateSelect(s){if(!s||s.dataset.officeDecorated==='true')return;s.dataset.officeDecorated='true';s.classList.add('office-select');}
function decorateLabel(l){if(!l||l.dataset.officeDecorated==='true')return;l.dataset.officeDecorated='true';l.classList.add('office-file-command');}
function decorateScope(scope=document){
 scope.querySelectorAll?.('button').forEach(decorateButton);
 scope.querySelectorAll?.('select').forEach(decorateSelect);
 scope.querySelectorAll?.('label.file-button').forEach(decorateLabel);
}
function markGroups(){
 const top=$('.top-actions');if(top){
  top.classList.add('office-topbar');
  ['newProjectBtn','saveBtn','exportBtn','importPlanBtn','undoBtn','redoBtn','levelSelect','addLevelBtn','deleteLevelBtn','overlayBtn'].forEach(id=>$('#'+id)?.classList.add('office-top-item'));
  ['levelSelect','overlayBtn'].forEach(id=>$('#'+id)?.classList.add('office-separator-before'));
  $('.view-switch')?.classList.add('office-inline-group');$('.zoom-controls')?.classList.add('office-inline-group');
 }
 document.querySelectorAll('.work-category').forEach(card=>{
  card.classList.add('office-category');
  const content=card.querySelector('.work-content');if(content)content.classList.add('office-command-grid');
 });
 document.querySelectorAll('.work-content').forEach(content=>{
  [...content.children].forEach(child=>{
   if(child.matches('small'))child.classList.add('office-group-note');
   else if(child.id==='placementSettings')child.classList.add('office-span-full');
   else if(child.matches('button,.tool,.b-card,.fa-card,.st-card,.env-card,.rf-card,.auto-card'))child.classList.add('office-grid-item');
  });
 });
 const draw=$('#drawingToolbar');if(draw)draw.classList.add('office-drawing-ribbon');
 draw?.querySelectorAll('.draw-group').forEach(g=>g.classList.add('office-mini-group'));
 const props=$('#propertiesPanel');if(props)props.classList.add('office-properties');
}
function future(){
 const obs=new MutationObserver(records=>{
  for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1){decorateScope(n.matches?.('button,select,label.file-button')?n.parentElement:n);markGroups();}
 });
 obs.observe(document.body,{childList:true,subtree:true});
 root.PBPOfficeCommands={decorate:decorateScope,refresh:()=>{decorateScope();markGroups();}};
}
function init(){
 const style=document.createElement('style');style.textContent=`
:root{--office-blue:#245c7d;--office-blue-soft:#eaf2f7;--office-line:#d4dde3;--office-hover:#f1f5f7;--office-active:#dcecf4;--office-text:#243642}
button.office-command,.office-file-command,.office-select{font-family:inherit}
button.office-command{border:1px solid transparent!important;background:transparent!important;border-radius:4px!important;color:var(--office-text)!important;box-shadow:none!important;transition:background .12s,border-color .12s}
button.office-command:hover{background:var(--office-hover)!important;border-color:#dbe4e9!important}
button.office-command:active,button.office-command.active,button.office-command[aria-pressed="true"]{background:var(--office-active)!important;border-color:#9fc0d0!important;color:#174b65!important}
button.office-command:disabled{opacity:.42!important;background:transparent!important}
.office-command-icon{display:inline-grid;place-items:center;min-width:14px;font-size:12px;line-height:1}
.office-command-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.top-actions .office-command,.top-actions .office-file-command,.top-actions .office-select{height:30px!important;min-height:30px!important;font-size:10px!important;padding:4px 7px!important}
.top-actions button.office-command{display:inline-flex;align-items:center;gap:4px}
.top-actions .office-file-command{display:inline-flex;align-items:center;border:1px solid transparent!important;background:transparent!important;border-radius:4px!important;color:var(--office-text)!important}
.top-actions .office-file-command:hover{background:var(--office-hover)!important;border-color:#dbe4e9!important}
.office-separator-before{margin-left:5px!important;border-left:1px solid var(--office-line)!important;padding-left:9px!important}
select.office-select{border:1px solid var(--office-line)!important;border-radius:4px!important;background:#fff!important;color:var(--office-text)!important}
.office-inline-group{display:flex!important;align-items:center!important;gap:2px!important;border-left:1px solid var(--office-line)!important;padding-left:5px!important;margin-left:2px!important}
.office-category{border:1px solid #d7e0e5!important;border-radius:5px!important;background:#fff!important;box-shadow:none!important}
.office-category>summary{background:#f5f7f9!important;color:#335569!important;border-bottom:1px solid transparent!important;padding:8px 7px!important}
.office-category[open]>summary{background:#eef4f7!important;border-bottom-color:#dbe4e9!important}
.office-command-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px!important;padding:6px!important}
.office-group-note{grid-column:1/-1;margin:0 0 3px!important;padding:2px 1px!important;font-size:9px!important;color:#748691!important}
.office-command-grid>button.office-command,.office-command-grid .office-command{width:100%!important;min-width:0!important;min-height:42px!important;padding:4px 3px!important;margin:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;text-align:center!important;font-size:9.5px!important;line-height:1.1}
.office-command-grid .office-command-icon{font-size:15px!important;height:16px}
.office-command-grid .office-command-label{white-space:normal!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.office-command-grid>.office-span-full,.office-command-grid>#placementSettings,.office-command-grid>small{grid-column:1/-1}
.office-command-grid #placementSettings{background:#f8fafb!important;border:1px solid #e0e7eb!important;border-radius:4px!important;margin:2px 0!important;padding:6px!important}
.office-command-grid #placementSettings .setting-row{font-size:9px!important;margin:3px 0!important}
.office-command-grid #placementSettings input{font-size:9px!important;padding:3px!important}
.office-drawing-ribbon{background:#fff!important;border-bottom:1px solid #d3dde3!important;gap:3px!important;padding:4px 6px!important}
.office-drawing-ribbon button.office-command,.office-drawing-ribbon select.office-select{min-height:27px!important;height:27px!important;font-size:9.5px!important;padding:3px 6px!important;display:inline-flex!important;align-items:center!important;gap:3px!important}
.office-mini-group{gap:3px!important;padding:0 5px!important;border-left:1px solid #e0e6ea}
.office-mini-group:first-of-type{border-left:0!important}
.office-properties{border-color:#d3dde3!important;border-radius:5px!important;box-shadow:0 5px 18px #2b435219!important}
.office-properties .properties-header{background:#f5f7f9!important;font-size:10px!important;letter-spacing:.03em}
.office-properties button.office-command{min-height:26px!important;padding:3px 6px!important;font-size:9.5px!important}
dialog button.office-command{min-height:29px!important;padding:4px 8px!important;font-size:10px!important;border-color:#d7e0e5!important;background:#fff!important}
dialog button.office-command:hover{background:#f1f5f7!important}
dialog .danger.office-command{background:#a54334!important;color:white!important;border-color:#8b362a!important}
dialog select.office-select{font-size:10px!important;padding:4px 6px!important}
@media(max-width:850px){.office-command-grid{grid-template-columns:1fr!important}.office-command-grid .office-command{min-height:34px!important;flex-direction:row!important;justify-content:flex-start!important;text-align:left!important}.office-command-grid .office-command-icon{font-size:12px!important}.office-separator-before{margin-left:2px!important;padding-left:5px!important}}
@media(max-width:550px){.top-actions .office-command-label{display:none}.top-actions button.office-command{min-width:28px!important;justify-content:center!important}.office-inline-group{padding-left:2px!important}}
`;document.head.append(style);
 decorateScope();markGroups();future();
 $('.version').textContent='v0.16.3';document.title='Plan Bâtiment Pro — v0.16.3';root.PBPOfficeCommandsReady=true;
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
