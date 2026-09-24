'use strict';
const assert=require('node:assert/strict'),D=require('../drawing-options.js');
let n=0;function test(name,fn){fn();console.log('PASS',++n,name);}
const wall=(id,a,b,extra={})=>({id,a,b,mode:'construction',levelId:'ground',type:'wallExterior',thickness:.32,...extra});
const model={activeLevelId:'ground',elements:[wall('w1',{x:0,y:0},{x:3,y:4}),wall('w2',{x:3,y:4},{x:9,y:4}),wall('upper',{x:0,y:0},{x:5,y:0},{levelId:'r1'}),wall('auto',{x:0,y:0},{x:6,y:0},{generator:'auto'}),wall('wire',{x:0,y:0},{x:7,y:0},{mode:'electricity'}),wall('measure',{x:0,y:0},{x:8,y:0},{type:'dimension'}),wall('zero',{x:0,y:0},{x:0,y:0}),wall('bad',{x:NaN,y:0},{x:0,y:0})]};
test('Old projects get normalized display defaults',()=>assert.deepEqual(D.settings(),{schema:1,dimensions:true,automatic:true,manual:true,selectedOnly:false,grid:true,unit:'m'}));
test('Only current manual structural lines are auto-dimensioned',()=>assert.deepEqual(D.descriptors(model).map(e=>e.id),['w1','w2']));
test('True diagonal length, not horizontal projection',()=>assert.equal(D.descriptors(model)[0].text,'5,00 m'));
test('Master switch hides automatic measurements',()=>assert.equal(D.descriptors(model,{dimensions:false}).length,0));
test('Automatic switch independent from manual dimensions',()=>assert.equal(D.descriptors(model,{automatic:false,manual:true}).length,0));
test('Selection filter excludes other walls',()=>assert.deepEqual(D.descriptors(model,{selectedOnly:true},'w2').map(e=>e.id),['w2']));
test('Selection mode with no selection is empty',()=>assert.equal(D.descriptors(model,{selectedOnly:true}).length,0));
test('Centimetres and millimetres use actual scale',()=>{assert.equal(D.label(.325,'cm'),'32,5 cm');assert.equal(D.label(.325,'mm'),'325 mm');});
test('Invalid unit restores metres',()=>assert.equal(D.settings({unit:'inch'}).unit,'m'));
test('Dimensions track a changed endpoint',()=>{const m=structuredClone(model);m.elements[0].b={x:0,y:7};assert.equal(D.descriptors(m)[0].text,'7,00 m');});
test('No modification of geometry or serialized settings',()=>{const before=JSON.stringify(model);D.descriptors(model,{selectedOnly:true},'w1');assert.equal(JSON.stringify(model),before);const p=D.settings({dimensions:false,unit:'mm',grid:false});assert.deepEqual(D.settings(JSON.parse(JSON.stringify(p))),p);});
test('Missing points and non-finite lengths are ignored',()=>{assert.equal(D.label(NaN),'—');assert.equal(D.descriptors({activeLevelId:'ground',elements:[{...model.elements[0],a:null}]}).length,0);});
console.log(n+' drawing tests passed');
