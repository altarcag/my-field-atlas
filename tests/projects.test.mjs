import test from "node:test";
import assert from "node:assert/strict";
import { groupFiles,groupVisibility } from "../.sites-runtime/check-modules/projects.mjs";
import { passwordMatches,sessionDigest,digest } from "../.sites-runtime/check-modules/upload-auth.mjs";
import { beginSchema } from "../.sites-runtime/check-modules/validation.mjs";
const projectId="018df2ec-cb8c-4a1f-9ed0-73d25ad7825f";
const project={id:projectId,name:"URG-2026",createdAt:"2026-09-01"};
test("one project contains multiple files with independent authors and partial visibility",()=>{
 const files=[{id:"2",projectId,name:"Day 2",date:null,author:"Friend"},{id:"1",projectId,name:"Day 1",date:null,author:"Altar"}];
 const [group]=groupFiles([project],files);
 assert.deepEqual(group.files.map(file=>file.id),["1","2"]);
 assert.deepEqual(group.files.map(file=>file.author),["Altar","Friend"]);
 assert.equal(groupVisibility(group.files,new Set()),false);
 assert.equal(groupVisibility(group.files,new Set(["1"])),"indeterminate");
 assert.equal(groupVisibility(group.files,new Set(["1","2"])),true);
});
test("pre-project uploads remain accessible without inventing a project or author",()=>{
 const old={id:"old",name:"Earlier file",projectId:null,author:""};
 const groups=groupFiles([project],[old]);
 assert.equal(groups.length,2);assert.equal(groups[0].files.length,0);
 assert.equal(groups[1].unassigned,true);assert.equal(groups[1].files[0],old);
});
test("both file types require a valid parent project and retain author metadata",()=>{
 const metadata={projectId,name:"Day 1",author:"Altar",date:null,note:"",color:"#b6324d",fileName:"day1.kmz",size:2048};
 assert.equal(beginSchema.safeParse(metadata).success,true);
 assert.equal(beginSchema.safeParse({...metadata,fileName:"day1.kml"}).success,true);
 assert.equal(beginSchema.safeParse({...metadata,projectId:undefined}).success,false);
 assert.equal(beginSchema.safeParse({...metadata,fileName:"day1.kml",size:13*1024*1024}).success,false);
});
test("server-configured password is exact, and rotating it invalidates previous sessions",async()=>{
 const secret="unit-test-secret",token="a".repeat(64);
 assert.equal(await passwordMatches(secret,secret),true);
 assert.equal(await passwordMatches("wrong",secret),false);
 assert.equal(await passwordMatches("", ""),false);
 const current=await sessionDigest(token,secret);
 assert.notEqual(current,await digest(token),"v1 sessions must not bypass the new password");
 assert.notEqual(current,await sessionDigest(token,"different-secret"));
 assert.equal(current,await sessionDigest(token,secret));
});
