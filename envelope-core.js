/* Plan Bâtiment Pro v0.12.0 — second œuvre, drywall and insulation engine.
   Geometric quantities are computed from the model. Certified acoustic/thermal system performance is never invented. */
(function(root){
'use strict';
const TAG='pbp-envelope-v1',clone=v=>JSON.parse(JSON.stringify(v)),num=(v,f=null)=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):f;
const defaults=()=>({schema:1,assemblies:[]});
const assemblyDefaults=()=>({id:'',levelId:'ground',hostId:'',kind:'iti',side:1,name:'',
 studSpacing:.6,studWidth:.048,studDepth:.048,doubleStud:false,
 boardWidth:1.2,boardHeight:2.5,boardThickness:.013,boardsInside:1,boardsOutside:0,waste:.08,
 insulationInside:.10,lambdaInside:.035,insulationOutside:0,lambdaOutside:.035,
 acousticRw:null,acousticReference:'',systemReference:'',height:null});
function settings(v){const d=defaults();if(!v||typeof v!=='object')return d;d.assemblies=Array.isArray(v.assemblies)?v.assemblies.slice(0,500).filter(x=>x&&typeof x==='object').map(x=>normalize(x)):[];return d;}
function normalize(v){const d={...assemblyDefaults(),...clone(v)};if(!['iti','ite','mixed','acoustic','partition'].includes(d.kind))d.kind='iti';d.side=Number(d.side)<0?-1:1;
 for(const k of ['studSpacing','studWidth','studDepth','boardWidth','boardHeight','boardThickness','waste','insulationInside','lambdaInside','insulationOutside','lambdaOutside','height']){const x=num(d[k]);d[k]=x===null?assemblyDefaults()[k]:x;}
 for(const k of ['boardsInside','boardsOutside'])d[k]=Math.max(0,Math.min(4,Math.round(num(d[k],assemblyDefaults()[k]))));
 d.doubleStud=d.doubleStud===true;d.acousticRw=num(d.acousticRw);d.id=String(d.id||'').slice(0,100);d.hostId=String(d.hostId||'').slice(0,100);d.levelId=String(d.levelId||'ground').slice(0,100);d.name=String(d.name||'').slice(0,120);d.acousticReference=String(d.acousticReference||'').slice(0,250);d.systemReference=String(d.systemReference||'').slice(0,250);return d;}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),unit=v=>{const L=Math.hypot(v.x,v.y);return L>1e-9?{x:v.x/L,y:v.y/L}:null;},add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),mul=(v,t)=>({x:v.x*t,y:v.y*t});
function host(model,a){return (model.elements||[]).find(e=>e.id===a.hostId&&e.levelId===a.levelId&&e.a&&e.b&&['wallExterior','wallBearing','partition'].includes(e.type));}
function openings(model,h){return (model.elements||[]).filter(e=>['door','window'].includes(e.type)&&(e.hostWallId===h.id||e.sourceWallId===h.id));}
function layerInfo(a){
 const inside=['iti','mixed','acoustic','partition'].includes(a.kind)?Math.max(0,a.insulationInside):0,outside=['ite','mixed'].includes(a.kind)?Math.max(0,a.insulationOutside):0;
 const Ri=inside>0&&a.lambdaInside>0?inside/a.lambdaInside:0,Ro=outside>0&&a.lambdaOutside>0?outside/a.lambdaOutside:0;
 const boardIn=a.boardsInside*Math.max(0,a.boardThickness),boardOut=a.boardsOutside*Math.max(0,a.boardThickness);
 return{inside,outside,Ri,Ro,R:Ri+Ro,boardIn,boardOut,total:inside+outside+boardIn+boardOut};
}
function quantity(model,input){
 const a=normalize(input),h=host(model,a),issues=[];if(!h)return{assembly:a,host:null,issues:[{severity:'error',text:'Mur support introuvable.'}],complete:false};
 const L=dist(h.a,h.b),H=a.height>0?a.height:Number(h.height)||2.8,gross=L*H,ops=openings(model,h),openingArea=ops.reduce((n,e)=>n+Math.max(0,Number(e.width)||0)*Math.max(0,Number(e.height)||0),0),net=Math.max(0,gross-openingArea);
 if(!ops.length&&(model.elements||[]).some(e=>['door','window'].includes(e.type)&&e.levelId===a.levelId))issues.push({severity:'warning',text:'Ouvertures non liées au mur : elles ne sont pas déduites du métré de cette paroi.'});
 const li=layerInfo(a),spacing=Math.max(.15,a.studSpacing||.6),studBase=Math.ceil(L/spacing)+1,studs=studBase*(a.doubleStud?2:1),rails=2*L;
 const faces=Math.max(0,a.boardsInside)+Math.max(0,a.boardsOutside),boardArea=Math.max(.01,a.boardWidth*a.boardHeight),boardRequired=net*faces*(1+Math.max(0,a.waste)),boards=Math.ceil(boardRequired/boardArea);
 const insulationArea=net*((li.inside>0?1:0)+(li.outside>0?1:0)),insulationVolume=net*(li.inside+li.outside);
 if((li.inside>0&&!(a.lambdaInside>0))||(li.outside>0&&!(a.lambdaOutside>0)))issues.push({severity:'error',text:'Lambda isolant manquant ou invalide : résistance thermique impossible à calculer.'});
 if(['acoustic','partition'].includes(a.kind)&&a.acousticRw===null)issues.push({severity:'warning',text:'Performance acoustique non renseignée : aucune valeur Rw/RA n’est déduite de la seule composition.'});
 if(a.acousticRw!==null&&!a.acousticReference.trim())issues.push({severity:'warning',text:'Rw/RA renseigné sans référence de système ou essai.'});
 return{assembly:a,host:h,L,H,grossArea:gross,openingArea,netArea:net,studs,studBase,rails,boards,boardRequired,insulationArea,insulationVolume,thermalR:li.R,layers:li,issues,complete:!issues.some(i=>i.severity==='error')};
}
function visual(model,q){
 if(!q.host)return[];const a=q.assembly,h=q.host,u=unit({x:h.b.x-h.a.x,y:h.b.y-h.a.y});if(!u)return[];const n={x:-u.y,y:u.x},wallT=Number(h.thickness)||.2,li=q.layers,side=a.side;
 const es=[],z=Number((model.levels||[]).find(l=>l.id===a.levelId)?.elevation)||0,H=q.H;
 function line(role,offset,t){if(!(t>0))return;const c=offset+side*t/2,p=mul(n,c);es.push({id:TAG+':'+a.id+':'+role,generator:TAG,mode:'construction',levelId:a.levelId,type:'beam',role,a:add(h.a,p),b:add(h.b,p),thickness:t,height:H,zBase:z,locked:true,designStatus:'prestudy',hostId:h.id});}
 if(a.kind==='iti'||a.kind==='acoustic'||a.kind==='mixed'){const t=li.inside+li.boardIn;line(a.kind==='acoustic'?'acousticLining':'liningInside',side*(wallT/2),t);}
 if(a.kind==='ite'||a.kind==='mixed'){const t=li.outside+li.boardOut;line('liningOutside',-side*(wallT/2),t);}
 if(a.kind==='partition'){const t=Math.max(a.studDepth,li.inside+li.boardIn+li.boardOut);line('drywallPartition',0,t);}
 return es;
}
function report(model){const s=settings(model.envelopeDesign),rows=s.assemblies.map(a=>quantity(model,a)),elements=rows.flatMap(q=>visual(model,q)),hiddenHostIds=rows.filter(q=>q.assembly.kind==='partition'&&q.host).map(q=>q.host.id);return{settings:s,rows,elements,hiddenHostIds,issues:rows.flatMap(q=>q.issues.map(i=>({...i,assemblyId:q.assembly.id})))};}
const api={TAG,defaults,assemblyDefaults,settings,normalize,quantity,report,layerInfo};
if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root){root.PBPEnvelope=api;root.PBPEnvelopeReady=true;}
})(typeof window!=='undefined'?window:globalThis);
