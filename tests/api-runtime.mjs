import { DatabaseSync } from "node:sqlite";
export const sqlite=new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
function statement(sql,args=[]){return {
 bind(...values){return statement(sql,values);},
 async first(){return sqlite.prepare(sql).get(...args)||null;},
 async all(){return {results:sqlite.prepare(sql).all(...args)};},
 async run(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};}
};}
const objects=new Map(),uploads=new Map();
export const env={UPLOAD_PASSWORD:"test-secret",ADMIN_PASSWORD:"owner-test-secret",ALLOWED_ORIGIN:"https://altarcag.github.io",DB:{prepare:statement,async batch(statements){sqlite.exec("BEGIN");try{const results=[];for(const item of statements)results.push(await item.run());sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}}},BUCKET:{
 async put(key,value){objects.set(key,typeof value==="string"?new TextEncoder().encode(value):value);},
 async head(key){return objects.has(key)?{size:objects.get(key).length}:null;},
 async get(key){const bytes=objects.get(key);return bytes?{json:async()=>JSON.parse(new TextDecoder().decode(bytes))}:null;},
 async list({prefix}){return {objects:[...objects.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false};},
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key);},
 async createMultipartUpload(key){const uploadId=crypto.randomUUID();uploads.set(uploadId,{key,parts:new Map()});return {uploadId,abort:async()=>uploads.delete(uploadId)};},
 resumeMultipartUpload(key,id){const upload=uploads.get(id);return {async uploadPart(partNumber,bytes){upload.parts.set(partNumber,bytes);return {partNumber,etag:"test-"+partNumber};},async complete(parts){objects.set(key,Buffer.concat(parts.map(part=>upload.parts.get(part.partNumber))));uploads.delete(id);},async abort(){uploads.delete(id);}};}
}};
