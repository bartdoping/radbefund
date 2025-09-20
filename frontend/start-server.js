const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }
  
  // Prüfe verschiedene Verzeichnisse
  const possiblePaths = [
    filePath,
    './dist' + req.url,
    './dist/index.html',
    './index.html',
    './dist/taskpane.js',
    './taskpane.js'
  ];
  
  let foundPath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      foundPath = testPath;
      break;
    }
  }
  
  if (!foundPath) {
    console.log(`File not found: ${req.url}`);
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>404 - Datei nicht gefunden</title></head>
        <body>
          <h1>404 - Datei nicht gefunden</h1>
          <p>Angeforderte Datei: ${req.url}</p>
          <p>Verfügbare Dateien:</p>
          <ul>
            ${fs.readdirSync('.').map(f => `<li>${f}</li>`).join('')}
          </ul>
          ${fs.existsSync('./dist') ? `
            <p>Dist-Verzeichnis:</p>
            <ul>
              ${fs.readdirSync('./dist').map(f => `<li>${f}</li>`).join('')}
            </ul>
          ` : ''}
        </body>
      </html>
    `, 'utf-8');
    return;
  }
  
  const extname = String(path.extname(foundPath)).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(foundPath, (error, content) => {
    if (error) {
      console.error(`Error reading file ${foundPath}:`, error);
      res.writeHead(500);
      res.end(`Server Error: ${error.code}`);
    } else {
      console.log(`Serving: ${foundPath} (${mimeType})`);
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 RadBefund+ Frontend läuft auf http://localhost:${PORT}`);
  console.log(`📁 Working directory: ${process.cwd()}`);
  console.log(`📂 Available files:`);
  
  // Zeige verfügbare Dateien
  try {
    const files = fs.readdirSync('.');
    files.forEach(file => {
      const stat = fs.statSync(file);
      console.log(`   ${stat.isDirectory() ? '📁' : '📄'} ${file}`);
    });
    
    if (fs.existsSync('./dist')) {
      console.log(`📂 Dist directory:`);
      const distFiles = fs.readdirSync('./dist');
      distFiles.forEach(file => {
        console.log(`   📄 dist/${file}`);
      });
    }
  } catch (error) {
    console.error('Error listing files:', error);
  }
  
  console.log(`🌐 Open: http://localhost:${PORT}`);
});
