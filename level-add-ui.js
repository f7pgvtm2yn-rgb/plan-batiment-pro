/* Plan Bâtiment Pro v0.16.8 — coherent story insertion. */
(function(root){
'use strict';
const app=root.planApp,$=s=>document.querySelector(s);
if(!app||!root.ProjectModel)return;
const isRoof=l=>l?.id==='roof'||/^toiture$/i.test(String(l?.name||'').trim());
const isStory=l=>l&&!l.autoFloor&&l.id!=='foundations'&&!isRoof(l)&&Number.isFinite(Number(l.elevation))&&Number.isFinite(Number(l.height));
function stories(model=app.model){return (model.levels||[]).filter(isStory).sort((a,b)=>Number(a.elevation)-Number(b.elevation));}
function nextName(rows){
 let max=0;
 for(const l of rows){const m=String(l.name||'').match(/^R\+(\d+)$/i);if(m)max=Math.max(max,Number(m[1]));}
 return 'R+'+(max+1);
}
function insertion(model=app.model){
 const rows=stories(model),last=rows.at(-1);if(!last)return null;
 return{last,elevation:Number(last.elevation)+Number(last.height),height:Number(last.height)>0?Number(last.height):2.8,name:nextName(rows)};
}
function alignRoof(model,top){
 const roof=(model.levels||[]).find(isRoof);if(!roof||!Number.isFinite(top))return false;
 if(Math.abs(Number(roof.elevation)-top)<1e-9)return false;
 roof.elevation=top;return true;
}
function refresh(level){
 app.model.activeLevelId=level.id;
 root.PBPBuildingUI?.refresh?.();
 root.PBPRoofUI?.refresh?.();
 root.PBPSpacesUI?.refresh?.();
 root.PBPLevelReferences?.sync?.(app.model,root);
 const select=$('#levelSelect');
 if(select){select.value=level.id;select.dispatchEvent(new Event('change',{bubbles:true}));}
 app.renderer2d?.draw();app.renderer3d?.draw();
}
function add(){
 const plan=insertion();if(!plan){alert('Aucun niveau habitable de référence.');return null;}
 const name=prompt('Nom du niveau :',plan.name);if(!name?.trim())return null;
 app.model.commit();
 const level={id:'level-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:name.trim().slice(0,80),elevation:plan.elevation,height:plan.height};
 app.model.levels.push(level);
 alignRoof(app.model,plan.elevation+plan.height);
 app.model.levels.sort((a,b)=>Number(a.elevation)-Number(b.elevation));
 refresh(level);return level;
}
function init(){
 const b=$('#addLevelBtn');if(!b)return;
 b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();add();},true);
 b.title='Ajouter un étage directement au-dessus du dernier étage habitable présent';
 root.PBPLevelAdd={stories,insertion,alignRoof,add};root.PBPLevelAddReady=true;
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',init);else init();
})(window);
