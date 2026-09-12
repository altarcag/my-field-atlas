import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const config=JSON.parse(await fs.readFile("wrangler.jsonc","utf8"));
const databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID||config.d1_databases[0].database_id;
if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(databaseId))throw new Error("Set CLOUDFLARE_D1_DATABASE_ID to the ID of your existing my-field-atlas-db database.");
config.d1_databases[0].database_id=databaseId;
if(process.env.CLOUDFLARE_ACCOUNT_ID)config.account_id=process.env.CLOUDFLARE_ACCOUNT_ID;
const filename="wrangler.deploy.json";
await fs.writeFile(filename,JSON.stringify(config,null,2));
const executable=path.resolve("node_modules/wrangler/bin/wrangler.js");
try{
 for(const args of [["d1","migrations","apply","DB","--remote","--config",filename],["deploy","--config",filename]]){
  const result=spawnSync(process.execPath,[executable,...args],{stdio:"inherit",env:process.env});
  if(result.status!==0)process.exitCode=result.status||1;
  if(result.status!==0)break;
 }
}finally{await fs.rm(filename,{force:true});}
