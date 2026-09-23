// Regression tests for the requested 150 mm bearing; not an engineering validation.
'use strict';
const assert=require('node:assert/strict');
const B=require('../building-core.js'),G=require('../geometry-tools.js');
const S=require('../structure-core.js'),F=require('../foundations-core.js'),R=require('../rim-core.js');
R.install(B,G,S,F);
let n=0;
const test=(name,fn)=>{fn();console.log('PASS',++n,name);};
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function setup(width=.32,length=8){
 const p=[[0,0],[length,0],[length,4],[0,4]];
 const m={levels:[{id:'foundations',name:'Fondations',elevation:-.8,height:.8},{id:'ground',name:'RDC',elevation:0,height:2.8},{id:'r1',name:'R+1',elevation:3.5,height:2.8}],elements:p.map((q,i)=>({id:'w'+i,type:'wallExterior',mode:'construction',levelId:'ground',a:{x:q[0],y:q[1]},b:{x:p[(i+1)%4][0],y:p[(i+1)%4][1]},thickness:width,height:2.8})),buildingDesign:B.settings(),structureDesign:S.defaults()};
 const f={...B.config(S,m.levels[1],m.levels[2]),grade:'C24',restraint:true,loadsConfirmed:true,transfer:'none'};
 m.buildingDesign.floors=[f];return{m,f};
}
test('Bearing is 150 mm, wall threshold unchanged',()=>{close(R.SEAT,.15);close(R.MIN_WALL,.30);});
for(const [width,rim] of [[.32,.17],[.35,.20],[.45,.30]])test(`Wall ${width*100} cm: correct bearing, rim and cut length`,()=>{
 const {m,f}=setup(width),r=B.floorReport(m,f,G,S);
 assert(r.complete&&r.rim.applied);assert(r.rim.entries.length===4);
 r.rim.entries.forEach(e=>{close(e.seat,.15);close(e.width,rim);close(e.height,r.required);});
 close(r.rim.bays[0].cutLength,4-width+2*.15);
 const joists=r.elements.filter(e=>e.floorRole==='joist');assert(joists.length>0);
 for(const e of joists){close(e.a.y-width/2,-.15);close(e.b.y-(4-width/2),.15);assert.equal(e.bearingDetail,'project-150mm');}
 assert(!r.issues.some(i=>/20 cm|200mm|− 20/.test(i.text)));
});
test('Opposite walls with different widths calculate independently',()=>{
 const {m,f}=setup();m.elements[2].thickness=.45;const r=B.floorReport(m,f,G,S);
 assert(r.complete);close(r.rim.bays[0].cutLength,4-(.32+.45)/2+.30);
 close(r.rim.entries.find(e=>e.wallIds.includes('w2')).width,.30);
});
test('Changing thickness updates geometry without modifying source walls',()=>{
 const {m,f}=setup();B.report(m,G,S,F);m.elements[0].thickness=.40;
 const before=JSON.stringify(m),r=B.report(m,G,S,F);assert.equal(JSON.stringify(m),before);
 close(r.floors[0].rim.entries.find(e=>e.wallIds.includes('w0')).width,.25);
 assert(r.quantities.rows.some(q=>q.label==='Rives de fermeture automatiques'&&q.quantity>0));
});
test('Existing serialized automatic floor recalculates using 150 mm',()=>{
 const {m}=setup(),restored=JSON.parse(JSON.stringify(m)),r=B.report(restored,G,S,F);
 close(r.floors[0].rim.seat,.15);close(r.floors[0].rim.entries[0].width,.17);
 assert(!restored.elements.some(e=>e.generator));
});
test('Two 150 mm seats on a 350 mm shared wall do not overlap',()=>{
 const {m,f}=setup(.35,6);m.elements.push({id:'mid',type:'wallBearing',mode:'construction',levelId:'ground',a:{x:3,y:0},b:{x:3,y:4},thickness:.35,height:2.8});
 const r=B.floorReport(m,f,G,S);assert(r.complete);assert.equal(r.rim.bays.length,2);
 assert(!r.issues.some(i=>i.code==='rim-double-bearing'));
 assert(!r.rim.entries.some(e=>e.wallIds.includes('mid')));
 const ends=r.elements.filter(e=>e.floorRole==='joist').flatMap(e=>[e.a.x,e.b.x]);
 const left=Math.max(...ends.filter(x=>x<3)),right=Math.min(...ends.filter(x=>x>3));close(right-left,.05);
});
test('Walls of 300 mm or less remain outside this project detail',()=>{
 const {m,f}=setup(.30),r=B.floorReport(m,f,G,S);assert.equal(r.rim.applied,false);
});
test('Unknown core location still blocks composed walls',()=>{
 const {m,f}=setup();m.elements[0].materialSpec={type:'block',core:200,insulation:120};
 const r=B.floorReport(m,f,G,S);assert(r.issues.some(i=>i.code==='rim-core-location'));
 assert.equal(r.elements.length,0);
});
test('Missing assumptions still block generation',()=>{
 const {m,f}=setup();f.restraint=false;const r=B.floorReport(m,f,G,S);assert.equal(r.elements.length,0);
});
test('Explicitly disabled rives remain disabled',()=>{
 const {m,f}=setup();f.rimAuto=false;const r=B.floorReport(m,f,G,S);assert(!r.rim);
});
test('Insufficient height never forces generation',()=>{
 const {m,f}=setup();m.levels[2].elevation=2.9;const r=B.floorReport(m,f,G,S);assert(!r.complete);assert.equal(r.elements.length,0);
});
test('Changed bearing does not assert structural approval',()=>{
 const {m,f}=setup(),r=B.floorReport(m,f,G,S);assert.equal(r.validForConstruction,false);
 assert.equal(r.rim.validForConstruction,false);assert(r.issues.some(i=>i.code==='rim-scope'));
});
console.log(n+' rim-15 tests passed');
