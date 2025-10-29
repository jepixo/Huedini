import ghpages from "gh-pages";
import path from "path";

const dir = path.resolve("dist");

ghpages.publish(dir, {
  branch: "gh-pages",
  repo: "https://github.com/jepixo/Huedini.git",
  dotfiles: true,
  user: {
    name: "jepixo",
    email: "your-email@example.com"
  },
  message: "Deploying Huedini ✨",
  cwd: process.cwd().replace(/\\/g, "/") // fix for Windows paths
}, err => {
  console.log(err ? `❌ Deploy failed:\n${err}` : "✅ Deploy success!");
});
