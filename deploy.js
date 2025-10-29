import ghpages from 'gh-pages';

ghpages.publish('dist', {
  branch: 'gh-pages',
  repo: 'https://github.com/jepixo/Huedini.git',
  dotfiles: true
}, err => {
  console.log(err ? `❌ Deploy failed: ${err}` : '✅ Deploy success!');
});
