// src/docs/swagger.ts
import { OpenAPIV3 } from 'openapi-types';

export const swaggerDocument: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'RadBefund+ API',
    version: '1.0.0',
    description: 'Enterprise-grade AI-powered radiological report optimization API',
    contact: {
      name: 'RadBefund+ Support',
      email: 'support@radbefund-plus.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'https://api.radbefund-plus.com',
      description: 'Production server'
    },
    {
      url: 'https://localhost:3001',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique user identifier'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          name: {
            type: 'string',
            description: 'User full name'
          },
          organization: {
            type: 'string',
            description: 'User organization'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp'
          },
          lastLogin: {
            type: 'string',
            format: 'date-time',
            description: 'Last login timestamp'
          }
        },
        required: ['id', 'email', 'name', 'createdAt']
      },
      AuthResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Success message'
          },
          user: {
            $ref: '#/components/schemas/User'
          },
          accessToken: {
            type: 'string',
            description: 'JWT access token'
          },
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token'
          }
        },
        required: ['message', 'user', 'accessToken', 'refreshToken']
      },
      RegisterRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Password (min 8 chars, 1 uppercase, 1 lowercase, 1 special char)'
          },
          name: {
            type: 'string',
            minLength: 2,
            description: 'User full name'
          },
          organization: {
            type: 'string',
            description: 'User organization (optional)'
          }
        },
        required: ['email', 'password', 'name']
      },
      LoginRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          password: {
            type: 'string',
            description: 'User password'
          }
        },
        required: ['email', 'password']
      },
      RefreshTokenRequest: {
        type: 'object',
        properties: {
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token'
          }
        },
        required: ['refreshToken']
      },
      ProcessingOptions: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['1', '2', '3', '4', '5'],
            description: 'Processing level (1=basic, 2=terminology, 3=restructuring, 4=recommendations, 5=full)'
          },
          stil: {
            type: 'string',
            enum: ['knapp', 'neutral', 'ausführlicher'],
            description: 'Writing style'
          },
          ansprache: {
            type: 'string',
            enum: ['sie', 'neutral'],
            description: 'Address style'
          },
          layout: {
            type: 'string',
            description: 'Custom layout template or predefined layout name'
          },
          includeRecommendations: {
            type: 'boolean',
            default: false,
            description: 'Include clinical recommendations'
          }
        },
        required: ['mode', 'stil', 'ansprache']
      },
      ProcessRequest: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            minLength: 1,
            description: 'Text to process'
          },
          options: {
            $ref: '#/components/schemas/ProcessingOptions'
          },
          allowContentChanges: {
            type: 'boolean',
            default: false,
            description: 'Allow content modifications'
          }
        },
        required: ['text', 'options']
      },
      StructuredResponse: {
        type: 'object',
        properties: {
          blocked: {
            type: 'boolean',
            description: 'Whether processing was blocked due to content changes'
          },
          answer: {
            type: 'object',
            properties: {
              befund: {
                type: 'string',
                description: 'Optimized report text'
              },
              beurteilung: {
                type: 'string',
                description: 'Medical assessment (if requested)'
              },
              empfehlungen: {
                type: 'string',
                description: 'Clinical recommendations (if requested)'
              },
              zusatzinformationen: {
                type: 'string',
                description: 'Additional information/differential diagnoses (if requested)'
              }
            }
          },
          reasons: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Reasons for blocking (if blocked)'
          },
          diff: {
            type: 'object',
            properties: {
              addedNumbers: {
                type: 'array',
                items: { type: 'string' }
              },
              removedNumbers: {
                type: 'array',
                items: { type: 'string' }
              },
              lateralityChanged: {
                type: 'boolean'
              },
              newMedicalKeywords: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          message: {
            type: 'string',
            description: 'Blocking message (if blocked)'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message'
          },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                path: { type: 'array', items: { type: 'string' } }
              }
            },
            description: 'Validation error details'
          }
        },
        required: ['error']
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ok', 'error'],
            description: 'Service health status'
          },
          provider: {
            type: 'string',
            description: 'AI provider being used'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp'
          }
        },
        required: ['status', 'provider', 'timestamp']
      }
    }
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register new user',
        description: 'Create a new user account with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterRequest'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse'
                }
              }
            }
          },
          '400': {
            description: 'Invalid input data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '409': {
            description: 'User already exists',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '429': {
            description: 'Rate limit exceeded'
          }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticate user with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse'
                }
              }
            }
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '429': {
            description: 'Rate limit exceeded'
          }
        }
      }
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Get new access token using refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RefreshTokenRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid refresh token',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'User logout',
        description: 'Logout user and invalidate tokens',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logout successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Access token required'
          },
          '403': {
            description: 'Invalid or expired token'
          }
        }
      }
    },
    '/auth/profile': {
      get: {
        tags: ['Authentication'],
        summary: 'Get user profile',
        description: 'Retrieve current user profile information',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Access token required'
          },
          '403': {
            description: 'Invalid or expired token'
          }
        }
      }
    },
    '/structured': {
      post: {
        tags: ['AI Processing'],
        summary: 'Process text with structured output',
        description: 'Process radiological text with AI and return structured output including report, assessment, recommendations, and additional information',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ProcessRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Processing completed successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/StructuredResponse'
                }
              }
            }
          },
          '400': {
            description: 'Invalid request data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '401': {
            description: 'Access token required'
          },
          '403': {
            description: 'Invalid or expired token'
          },
          '429': {
            description: 'Rate limit exceeded'
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/process': {
      post: {
        tags: ['AI Processing'],
        summary: 'Process text (legacy endpoint)',
        description: 'Process radiological text with AI (legacy endpoint, use /structured for new implementations)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ProcessRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Processing completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    blocked: { type: 'boolean' },
                    answer: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid request data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '401': {
            description: 'Access token required'
          },
          '403': {
            description: 'Invalid or expired token'
          },
          '429': {
            description: 'Rate limit exceeded'
          }
        }
      }
    },
    '/impression': {
      post: {
        tags: ['AI Processing'],
        summary: 'Generate medical impression',
        description: 'Generate a concise medical impression/summary of the radiological findings',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    minLength: 1,
                    description: 'Text to generate impression from'
                  }
                },
                required: ['text']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Impression generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    blocked: { type: 'boolean' },
                    answer: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Invalid request data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '401': {
            description: 'Access token required'
          },
          '403': {
            description: 'Invalid or expired token'
          }
        }
      }
    },
    '/healthz': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        description: 'Check if the service is healthy and ready to accept requests',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse'
                }
              }
            }
          },
          '503': {
            description: 'Service is unhealthy'
          }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Basic health check',
        description: 'Basic health check endpoint',
        responses: {
          '200': {
            description: 'Service is running',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse'
                }
              }
            }
          }
        }
      }
    },
    '/metrics': {
      get: {
        tags: ['Monitoring'],
        summary: 'Prometheus metrics',
        description: 'Expose Prometheus metrics for monitoring',
        responses: {
          '200': {
            description: 'Metrics in Prometheus format',
            content: {
              'text/plain': {
                schema: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    }
  }
};
