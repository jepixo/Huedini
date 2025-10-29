import ghpages from "gh-pages";
import path from "path";

ghpages.publish(path.resolve("dist"), {
  branch: "gh-pages",
  repo: "https://github.com/jepixo/Huedini.git",
  dotfiles: true,
  message: "Deploying Huedini ✨",
  cwd: path.resolve(".") // explicitly set root with .git
}, err => {
  console.log(err ? `❌ Deploy failed:\n${err}` : "✅ Deploy success!");
});
