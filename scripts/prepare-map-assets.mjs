import { readFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// MapLibre 6 loads a separate ES module worker and shared module at runtime.
// Vite cannot discover its dynamically constructed URLs, so ship both intact.
export async function prepareMapAssets() {
 const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
 const packageRoot=path.join(root,"node_modules/maplibre-gl");
 const {version}=JSON.parse(await readFile(path.join(packageRoot,"package.json"),"utf8"));
 const folder=path.join(root,"public/maplibre",version);
 await mkdir(folder,{recursive:true});
 for(const name of ["maplibre-gl-worker.mjs","maplibre-gl-shared.mjs"])
  await copyFile(path.join(packageRoot,"dist",name),path.join(folder,name));
 await copyFile(path.join(packageRoot,"LICENSE.txt"),path.join(folder,"LICENSE.txt"));
 return `/maplibre/${version}/maplibre-gl-worker.mjs`;
}
