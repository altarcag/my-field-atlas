import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { prepareMapAssets } from "./scripts/prepare-map-assets.mjs";
export default defineConfig(async ({mode})=>{
 const values=loadEnv(mode,process.cwd(),"");
 const base=values.VITE_BASE_PATH||"/my-field-atlas/";
 const worker=await prepareMapAssets();
 return {base,plugins:[react()],resolve:{alias:{"@":path.resolve(process.cwd())}},
  define:{__MAPLIBRE_WORKER_URL__:JSON.stringify(base.replace(/\/$/,"")+worker)},
  server:{proxy:{"/api":{target:"http://127.0.0.1:8787",changeOrigin:false}}},
  build:{outDir:"dist",sourcemap:false}
 };
});
