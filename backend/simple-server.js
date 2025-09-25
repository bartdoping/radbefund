// Railway-optimized server using native Node.js HTTP module
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3001;

// Simple in-memory user storage for demo
const users = new Map();
users.set('admin@mylovelu.de', {
  id: 'admin-user-id',
  email: 'admin@mylovelu.de',
  password: 'admin123', // In production: hashed password
  name: 'Admin User',
  organization: 'RadBefund+',
  createdAt: new Date().toISOString()
});

// Helper function to parse JSON body
function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

// CORS headers - allow both mylovelu.de and www.mylovelu.de
const allowedOrigins = [
  'https://mylovelu.de',
  'https://www.mylovelu.de'
];

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;
  const origin = req.headers.origin;

  // Check if origin is allowed
  const isAllowedOrigin = allowedOrigins.includes(origin);
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0];

  // Prepare CORS headers with dynamic origin
  const responseCorsHeaders = {
    ...corsHeaders,
    'Access-Control-Allow-Origin': corsOrigin
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, responseCorsHeaders);
    res.end();
    return;
  }

  // Add CORS headers to all responses
  Object.entries(responseCorsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Health check endpoint
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production'
    }));
    return;
  }

  // Test endpoint
  if (path === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: "Railway backend is running!" }));
    return;
  }

  // Auth routes
  if (path === '/auth/register' && method === 'POST') {
    parseJSONBody(req).then(data => {
      const { email, password, name, organization } = data;
      
      // Basic validation
      if (!email || !password || !name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Email, Passwort und Name sind erforderlich" }));
        return;
      }
      
      // Check if user already exists
      if (users.has(email.toLowerCase())) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Benutzer mit dieser E-Mail existiert bereits" }));
        return;
      }
      
      // Create new user
      const userId = 'user-' + Date.now();
      const newUser = {
        id: userId,
        email: email.toLowerCase(),
        password: password, // In production: hash password
        name: name,
        organization: organization || '',
        createdAt: new Date().toISOString()
      };
      
      users.set(email.toLowerCase(), newUser);
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: "Benutzer erfolgreich registriert",
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          organization: newUser.organization,
          createdAt: newUser.createdAt
        },
        accessToken: "access-token-" + userId,
        refreshToken: "refresh-token-" + userId
      }));
    }).catch(error => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Ungültige JSON-Daten" }));
    });
    return;
  }

  if (path === '/auth/login' && method === 'POST') {
    parseJSONBody(req).then(data => {
      const { email, password } = data;
      
      // Basic validation
      if (!email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Email und Passwort sind erforderlich" }));
        return;
      }
      
      // Check if user exists
      const user = users.get(email.toLowerCase());
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Ungültige Anmeldedaten" }));
        return;
      }
      
      // Check password
      if (user.password !== password) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Ungültige Anmeldedaten" }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: "Erfolgreich angemeldet",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          organization: user.organization,
          lastLogin: new Date().toISOString()
        },
        accessToken: "access-token-" + user.id,
        refreshToken: "refresh-token-" + user.id
      }));
    }).catch(error => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Ungültige JSON-Daten" }));
    });
    return;
  }

  if (path === '/auth/refresh' && method === 'POST') {
    // Mock refresh response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      accessToken: "new-mock-access-token",
      refreshToken: "new-mock-refresh-token"
    }));
    return;
  }

  if (path === '/auth/logout' && method === 'POST') {
    // Mock logout response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: "Erfolgreich abgemeldet" }));
    return;
  }

  if (path === '/auth/profile' && method === 'GET') {
    // Mock profile response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      user: {
        id: "mock-user-id",
        email: "user@example.com",
        name: "Test User",
        organization: "Test Org",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      }
    }));
    return;
  }

  // Structured report generation endpoint
  if (path === '/structured' && method === 'POST') {
    // Mock structured report response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      blocked: false,
      answer: {
        befund: "**Befund:**\n\nEs wurde eine CT-Untersuchung des Thorax durchgeführt. Die Lungen zeigen eine unauffällige Struktur ohne pathologische Veränderungen. Das Herz ist normal konfiguriert. Die mediastinalen Strukturen sind regelrecht dargestellt.\n\n**Beurteilung:**\n\nUnauffälliger CT-Thorax ohne pathologische Befunde.\n\n**Empfehlungen:**\n\nKeine weiteren Maßnahmen erforderlich.\n\n**Zusatzinformationen:**\n\nDie Untersuchung wurde in Standardtechnik durchgeführt."
      }
    }));
    return;
  }

  // Default response
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route not found' }));
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Railway Backend läuft auf Port ${PORT}`);
  console.log(`📊 Health Check: http://0.0.0.0:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🔗 Server listening on all interfaces`);
  console.log(`✅ Using native Node.js HTTP module - no Express dependencies`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

module.exports = server;