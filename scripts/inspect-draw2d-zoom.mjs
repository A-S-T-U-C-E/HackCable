import fs from "fs";

const s = fs.readFileSync("node_modules/draw2d/dist/draw2d.js", "utf8");
const i = s.indexOf("policy.canvas.ZoomPolicy =");
console.log(s.slice(i, i + 3500));
