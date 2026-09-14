import { test } from "node:test";
import assert from "node:assert/strict";
import { groupMapPhotos } from "../.sites-runtime/check-modules/photo-groups.mjs";

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
