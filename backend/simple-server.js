// Railway-optimized server using native Node.js HTTP module
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3001;

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
    // Mock registration response
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: "Benutzer erfolgreich registriert",
      user: {
        id: "mock-user-id",
        email: "user@example.com",
        name: "Test User",
        organization: "Test Org",
        createdAt: new Date().toISOString()
      },
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token"
    }));
    return;
  }

  if (path === '/auth/login' && method === 'POST') {
    // Mock login response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: "Erfolgreich angemeldet",
      user: {
        id: "mock-user-id",
        email: "user@example.com",
        name: "Test User",
        organization: "Test Org",
        lastLogin: new Date().toISOString()
      },
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token"
    }));
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