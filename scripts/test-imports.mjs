import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out=path.join(root,".sites-runtime","check-modules");
await fs.mkdir(out,{recursive:true});
for(const name of ["types","parse-track","kmz","validation","projects","upload-auth","workspaces"]) {
 const source=await fs.readFile(path.join(root,"lib",name+".ts"),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from "(\.\/[^"]+)"/g,'from "$1.mjs"');
 await fs.writeFile(path.join(out,name+".mjs"),compiled);
}
const result=spawnSync(process.execPath,["--test","tests/import.test.mjs","tests/projects.test.mjs","tests/workspaces.test.mjs"],{cwd:root,stdio:"inherit"});
process.exit(result.status??1);
