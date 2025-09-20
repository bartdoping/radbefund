// tests/load/load-test-processor.js
module.exports = {
  // Custom processor for load testing
  beforeRequest: (requestParams, context, ee, next) => {
    // Add custom headers or modify request
    if (requestParams.url.includes('/auth/')) {
      requestParams.headers = {
        ...requestParams.headers,
        'User-Agent': 'Artillery-LoadTest/1.0',
        'X-Test-Session': context.vars.testSessionId || 'default'
      };
    }
    
    // Log request details
    console.log(`Making request to: ${requestParams.url}`);
    next();
  },

  afterResponse: (requestParams, response, context, ee, next) => {
    // Log response details
    console.log(`Response: ${response.statusCode} for ${requestParams.url}`);
    
    // Track response times
    if (response.timings) {
      context.vars.responseTime = response.timings.response;
    }
    
    // Handle rate limiting
    if (response.statusCode === 429) {
      console.log('Rate limited - backing off');
      context.vars.rateLimited = true;
    }
    
    next();
  },

  // Custom function to generate test data
  generateTestData: (context, events, done) => {
    context.vars.testSessionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    context.vars.randomEmail = `loadtest${Math.floor(Math.random() * 10000)}@example.com`;
    context.vars.randomName = `Load Test User ${Math.floor(Math.random() * 10000)}`;
    done();
  },

  // Custom function to validate responses
  validateResponse: (context, events, done) => {
    const response = context.vars.response;
    
    if (response && response.statusCode >= 400) {
      console.log(`Error response: ${response.statusCode} - ${response.body}`);
    }
    
    done();
  }
};
