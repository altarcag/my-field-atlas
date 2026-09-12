import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import {spawnSync} from "node:child_process";
const out=path.resolve(".sites-runtime/check-modules");await fs.mkdir(out,{recursive:true});
const files={server:"lib/server.ts",types:"lib/types.ts",validation:"lib/validation.ts","upload-auth":"lib/upload-auth.ts",access:"app/api/access/route.ts",projects:"app/api/projects/route.ts",trips:"app/api/trips/route.ts",file:"app/api/trips/[id]/route.ts",archive:"app/api/trips/[id]/archive/route.ts",photo:"app/api/trips/[id]/photos/[photo]/route.ts",complete:"app/api/trips/[id]/complete/route.ts",files:"app/api/files/[id]/[...path]/route.ts",uploads:"app/api/uploads/route.ts",worker:"worker/index.ts"};
const names=new Map(Object.entries(files).map(([name,file])=>[path.resolve(file),name]));
for(const [name,file] of Object.entries(files)){
 const source=await fs.readFile(file,"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from "([^"]+)"/g,(match,specifier)=>{
  if(specifier==="cloudflare:workers")return 'from "../../tests/api-runtime.mjs"';
  if(!specifier.startsWith(".")&&!specifier.startsWith("@/"))return match;
  const resolved=specifier.startsWith("@/")?path.resolve(specifier.slice(2)+".ts"):path.resolve(path.dirname(file),specifier+".ts");
  if(!names.has(resolved))throw new Error("Missing test module: "+resolved);
  return 'from "./api-'+names.get(resolved)+'.mjs"';
 });
 await fs.writeFile(path.join(out,"api-"+name+".mjs"),compiled);
}
const result=spawnSync(process.execPath,["--test","tests/api.test.mjs"],{stdio:"inherit"});process.exit(result.status??1);
