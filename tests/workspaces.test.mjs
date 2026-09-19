import test from 'node:test';
import assert from 'node:assert/strict';
import {projectWorkspace,projectsInWorkspace,workspaceUploadProject,workspacePath,workspaceFromPath,workspaceHash,workspaceFromHash,restoredProjectFiles} from '../.sites-runtime/check-modules/workspaces.mjs';
const projects=[{id:'a',name:'Other trip'},{id:'u',name:'URG-2026'}];
const files=[{id:'a1',projectId:'a'},{id:'u1',projectId:'u'},{id:'u2',projectId:'u'}];
test('clean workspace paths resolve without hashes',()=>{
 assert.equal(workspacePath('field-map'),'/my-field-atlas/');
 assert.equal(workspacePath('urg-2026'),'/my-field-atlas/urg-2026/');
 assert.equal(workspaceFromPath('/my-field-atlas/'),'field-map');
 assert.equal(workspaceFromPath('/my-field-atlas/urg-2026/'),'urg-2026');
 assert.equal(workspaceFromPath('/other'),null);
});
test('legacy hash links remain readable',()=>{
 for(const id of ['field-map','urg-2026'])assert.equal(workspaceFromHash(workspaceHash(id)),id);
 assert.equal(workspaceFromHash('#other'),null);
});
test('reopening remembers the entire project including newly added files',()=>{
 assert.deepEqual(restoredProjectFiles('field-map',projects,files,'u').map(f=>f.id),['u1','u2']);
});
test('workspace link overrides a project from another workspace',()=>{
 assert.deepEqual(restoredProjectFiles('urg-2026',projects,files,'a').map(f=>f.id),['u1','u2']);
});
test('deleted project falls back to an available project and empty workspaces stay empty',()=>{
 assert.deepEqual(restoredProjectFiles('field-map',projects,files,'deleted').map(f=>f.id),['a1']);
 assert.deepEqual(restoredProjectFiles('urg-2026',[],files,null),[]);
});

test('URG projects use explicit membership rather than their name',()=>{
 const list=[...projects,{id:'d',name:'Day 3 — Rhine',workspace:'urg-2026'}];
 assert.deepEqual(projectsInWorkspace('urg-2026',list).map(p=>p.id),['u','d']);
 assert.equal(workspaceUploadProject('urg-2026',list,'a'),'u');
 assert.equal(workspaceUploadProject('urg-2026',list,'d'),'d');
 assert.equal(workspaceUploadProject('urg-2026',[],null),null);
 assert.equal(projectWorkspace({id:'x',name:'URG-2026',workspace:'field-map'}),'field-map');
 assert.deepEqual(restoredProjectFiles('urg-2026',list,[...files,{id:'d1',projectId:'d'}],'d').map(f=>f.id),['d1']);
 assert.deepEqual(projectsInWorkspace('field-map',list),list);
});
