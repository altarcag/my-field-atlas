import fs from "node:fs/promises";
import path from "node:path";

const output=path.resolve("dist");
const index=await fs.readFile(path.join(output,"index.html"),"utf8");
for(const route of ["urg-2026"]) {
 const directory=path.join(output,route);
 await fs.mkdir(directory,{recursive:true});
 await fs.writeFile(path.join(directory,"index.html"),index);
}
