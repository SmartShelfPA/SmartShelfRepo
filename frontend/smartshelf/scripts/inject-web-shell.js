const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'dist', 'index.html');
const html = fs.readFileSync(file, 'utf8');

if (html.includes('rel="manifest"')) {
  process.exit(0);
}

const tags = [
  '<meta name="description" content="SmartShelf in the browser. Read, study, and practice with the same account as the apps." />',
  '<meta name="theme-color" content="#000000" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="SmartShelf" />',
  '<link rel="manifest" href="/manifest.json" />',
  '<link rel="apple-touch-icon" href="/icon-192.png" />',
].join('\n    ');

fs.writeFileSync(file, html.replace('</head>', `    ${tags}\n  </head>`));
