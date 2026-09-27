/* Plan Bâtiment Pro v0.16.15 — render scheduler and visibility gating.
   Coalesces repeated draw calls to one per animation frame and skips hidden views. */
(function(root){
'use strict';
const app=root.planApp,$=s=>document.querySelector(s);
const metrics=root.PBPPerformanceMetrics=root.PBPPerformanceMetrics||{};
function visible2D(){return app.viewMode!=='3d'&&!$('#view2d')?.classList.contains('hidden');}
function visible3D(){return app.viewMode!=='2d'&&!$('#view3d')?.classList.contains('hidden');}
function schedule(proto,name,visible,key){
 const original=proto?.[name];if(typeof original!=='function'||original._pbpPerformanceWrapped)return;
 function wrapped(...args){
  this[key+'Args']=args;
  if(!visible()){this[key+'Dirty']=true;return;}
  if(this[key+'Frame'])return;
  this[key+'Frame']=root.requestAnimationFrame(()=>{
   this[key+'Frame']=0;if(!visible()){this[key+'Dirty']=true;return;}
   const callArgs=this[key+'Args']||[],t=performance.now();this[key+'Dirty']=false;original.apply(this,callArgs);
   metrics[key+'Frames']=(metrics[key+'Frames']||0)+1;metrics[key+'LastMs']=performance.now()-t;
  });
 }
 wrapped._pbpPerformanceWrapped=true;wrapped._pbpOriginal=original;proto[name]=wrapped;
}
function install(){
 schedule(root.PlanRenderer2D?.prototype,'draw',visible2D,'draw2D');
 schedule(root.ConstructionRenderer3D?.prototype,'draw',visible3D,'draw3D');
 const redrawVisible=()=>{
  if(visible2D())app.renderer2d?.draw();
  if(visible3D())app.renderer3d?.draw();
 };
 root.addEventListener('resize',redrawVisible,{passive:true});
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>root.requestAnimationFrame(redrawVisible)));
 const level=$('#levelSelect');level?.addEventListener('change',()=>root.requestAnimationFrame(redrawVisible));
 root.PBPPerformance={
  version:'0.16.15',
  metrics,
  revision:()=>Number(app.model?._pbpRevision)||0,
  invalidate:()=>{app.model._pbpRevision=(Number(app.model._pbpRevision)||0)+1;redrawVisible();},
  redraw:redrawVisible
 };
 const v=$('.version');if(v)v.textContent='v0.16.15';document.title='Plan Bâtiment Pro — v0.16.15';root.PBPPerformanceReady=true;
}
if(document.readyState==='loading')root.addEventListener('DOMContentLoaded',install);else install();
})(window);
