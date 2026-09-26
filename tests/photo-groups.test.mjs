import { test } from "node:test";
import assert from "node:assert/strict";
import { groupMapPhotos, groupPhotosOnScreen } from "../.sites-runtime/check-modules/photo-groups.mjs";

const radius=6371008.8;
const point=(id,meters,lat=0)=>({
 id,name:id,description:"",coordinates:[meters/radius*180/Math.PI,lat,123],
 photos:[{id:"photo-"+id,url:id,name:id}],
});
const trip=(id,points)=>({id,points});
test("five metre boundary and original coordinates",()=>{
 const a=point("a",0),b=point("b",5),c=point("c",10.01);
 const before=JSON.stringify([a,b,c]);
 const groups=groupMapPhotos([trip("t",[a,b,c])]);
 assert.deepEqual(groups.map(g=>g.count),[2,1]);
 assert.equal(groups[0].members[1].point,b);
 assert.equal(JSON.stringify([a,b,c]),before);
});
test("no chains spanning more than five metres",()=>{
 assert.deepEqual(groupMapPhotos([trip("t",[point("a",0),point("b",4),point("c",8)])])
 .map(g=>g.count),[2,1]);
});
test("counts every photo across files and keeps original ownership",()=>{
 const a=point("a",0),b=point("b",1);
 a.photos.push({id:"extra",url:"extra",name:"extra"});
 const t1=trip("1",[a]),t2=trip("2",[b]);
 const groups=groupMapPhotos([t2,t1]);
 assert.equal(groups.length,1);
 assert.equal(groups[0].count,3);
 assert.equal(groups[0].members[1].trip,t2);
 assert.deepEqual(groupMapPhotos([t1,t2]),groups);
});
test("handles identical coordinates, empty photos and longitude wrapping",()=>{
 const a=point("a",0),b=point("b",0),empty=point("e",0);
 empty.photos=[];
 assert.equal(groupMapPhotos([trip("t",[a,b,empty])])[0].count,2);
 a.coordinates[0]=179.99999;b.coordinates[0]=-179.99999;
 assert.equal(groupMapPhotos([trip("t",[a,b])]).length,1);
});

test("screen collisions combine on zoom out and separate on zoom in",()=>{
 const a=point("a",0),b=point("b",30),c=point("c",200);
 const groups=groupMapPhotos([trip("t",[a,b,c])]);
 const before=JSON.stringify(groups);
 const project=scale=>p=>({x:p.coordinates[0]*radius*Math.PI/180*scale,y:0});
 assert.deepEqual(groupPhotosOnScreen(groups,project(1)).map(g=>g.count),[2,1]);
 assert.deepEqual(groupPhotosOnScreen(groups,project(4)).map(g=>g.count),[1,1,1]);
 assert.equal(JSON.stringify(groups),before);
 assert.equal(groupPhotosOnScreen(groups,project(1))[0].members[1].point,b);
});
test("screen grouping preserves five metre groups and all photos across files",()=>{
 const a=point("a",0),b=point("b",4),c=point("c",40);
 c.photos.push({id:"extra",url:"extra",name:"extra"});
 const t1=trip("1",[a,b]),t2=trip("2",[c]);
 const base=groupMapPhotos([t2,t1]);
 const result=groupPhotosOnScreen(base,()=>({x:0,y:0}));
 assert.equal(result.length,1);
 assert.equal(result[0].count,4);
 assert.equal(result[0].members[2].trip,t2);
 assert.deepEqual(groupPhotosOnScreen(base,p=>({x:p===a?0:1000,y:0})).map(g=>g.count),[2,2]);
});
test("screen footprint considers both axes without chaining an entire route",()=>{
 const groups=groupMapPhotos([trip("t",[point("a",0),point("b",100),point("c",200)])]);
 const positions={a:{x:0,y:0},b:{x:60,y:0},c:{x:120,y:0}};
 const result=groupPhotosOnScreen(groups,p=>positions[p.id]);
 assert.deepEqual(result.map(g=>g.count),[2,1]);
 assert.equal(groupPhotosOnScreen(groups,p=>({x:0,y:{a:0,b:82,c:164}[p.id]})).length,3);
 assert.equal(groupPhotosOnScreen(groups,p=>({x:{a:0,b:72,c:144}[p.id],y:0})).length,3);
 assert.deepEqual(groupPhotosOnScreen([],()=>({x:0,y:0})),[]);
});
