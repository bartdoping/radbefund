// src/services/database.ts
import { Pool, PoolClient, QueryResult } from 'pg';
import logger from '../utils/logger';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  organization?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
}

export interface UserLayout {
  id: string;
  userId: string;
  name: string;
  description?: string;
  template: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiUsage {
  id: string;
  userId: string;
  endpoint: string;
  method: string;
  requestSize?: number;
  responseSize?: number;
  processingTimeMs?: number;
  statusCode: number;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

class DatabaseService {
  private pool: Pool | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'radbefund_plus',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database disconnected');
    }
  }

  private getPool(): Pool {
    if (!this.pool || !this.isConnected) {
      throw new Error('Database not connected');
    }
    return this.pool;
  }

  // User Operations
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const query = `
      INSERT INTO users (email, password_hash, name, organization, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, password_hash, name, organization, is_active, created_at, updated_at, last_login
    `;
    
    const values = [userData.email, userData.passwordHash, userData.name, userData.organization, userData.isActive];
    const result = await this.getPool().query(query, values);
    
    return this.mapUserFromDb(result.rows[0]);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.getPool().query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapUserFromDb(result.rows[0]);
  }

  async getUserById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.getPool().query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapUserFromDb(result.rows[0]);
  }

  async updateUserLastLogin(id: string): Promise<void> {
    const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
    await this.getPool().query(query, [id]);
  }

  // Refresh Token Operations
  async createRefreshToken(tokenData: Omit<RefreshToken, 'id' | 'createdAt'>): Promise<RefreshToken> {
    const query = `
      INSERT INTO refresh_tokens (token, user_id, expires_at, is_revoked)
      VALUES ($1, $2, $3, $4)
      RETURNING id, token, user_id, expires_at, created_at, is_revoked
    `;
    
    const values = [tokenData.token, tokenData.userId, tokenData.expiresAt, tokenData.isRevoked];
    const result = await this.getPool().query(query, values);
    
    return this.mapRefreshTokenFromDb(result.rows[0]);
  }

  async getRefreshToken(token: string): Promise<RefreshToken | null> {
    const query = 'SELECT * FROM refresh_tokens WHERE token = $1 AND is_revoked = false';
    const result = await this.getPool().query(query, [token]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRefreshTokenFromDb(result.rows[0]);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const query = 'UPDATE refresh_tokens SET is_revoked = true WHERE token = $1';
    await this.getPool().query(query, [token]);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const query = 'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1';
    await this.getPool().query(query, [userId]);
  }

  async cleanupExpiredTokens(): Promise<number> {
    const query = 'SELECT cleanup_expired_tokens()';
    const result = await this.getPool().query(query);
    return parseInt(result.rows[0].cleanup_expired_tokens);
  }

  // User Layout Operations
  async createUserLayout(layoutData: Omit<UserLayout, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserLayout> {
    const query = `
      INSERT INTO user_layouts (user_id, name, description, template, is_default)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, name, description, template, is_default, created_at, updated_at
    `;
    
    const values = [layoutData.userId, layoutData.name, layoutData.description, layoutData.template, layoutData.isDefault];
    const result = await this.getPool().query(query, values);
    
    return this.mapUserLayoutFromDb(result.rows[0]);
  }

  async getUserLayouts(userId: string): Promise<UserLayout[]> {
    const query = 'SELECT * FROM user_layouts WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await this.getPool().query(query, [userId]);
    
    return result.rows.map(row => this.mapUserLayoutFromDb(row));
  }

  async getUserLayoutById(id: string, userId: string): Promise<UserLayout | null> {
    const query = 'SELECT * FROM user_layouts WHERE id = $1 AND user_id = $2';
    const result = await this.getPool().query(query, [id, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapUserLayoutFromDb(result.rows[0]);
  }

  async updateUserLayout(id: string, userId: string, updates: Partial<Pick<UserLayout, 'name' | 'description' | 'template' | 'isDefault'>>): Promise<UserLayout | null> {
    const setClause = [];
    const values = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      setClause.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClause.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }
    if (updates.template !== undefined) {
      setClause.push(`template = $${paramCount++}`);
      values.push(updates.template);
    }
    if (updates.isDefault !== undefined) {
      setClause.push(`is_default = $${paramCount++}`);
      values.push(updates.isDefault);
    }

    if (setClause.length === 0) {
      return this.getUserLayoutById(id, userId);
    }

    values.push(id, userId);
    const query = `
      UPDATE user_layouts 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount++} AND user_id = $${paramCount++}
      RETURNING id, user_id, name, description, template, is_default, created_at, updated_at
    `;

    const result = await this.getPool().query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapUserLayoutFromDb(result.rows[0]);
  }

  async deleteUserLayout(id: string, userId: string): Promise<boolean> {
    const query = 'DELETE FROM user_layouts WHERE id = $1 AND user_id = $2';
    const result = await this.getPool().query(query, [id, userId]);
    
    return result.rowCount > 0;
  }

  // API Usage Tracking
  async logApiUsage(usageData: Omit<ApiUsage, 'id' | 'createdAt'>): Promise<void> {
    const query = `
      INSERT INTO api_usage (user_id, endpoint, method, request_size, response_size, processing_time_ms, status_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    const values = [
      usageData.userId,
      usageData.endpoint,
      usageData.method,
      usageData.requestSize,
      usageData.responseSize,
      usageData.processingTimeMs,
      usageData.statusCode
    ];
    
    await this.getPool().query(query, values);
  }

  async getUserApiUsage(userId: string, limit = 100): Promise<ApiUsage[]> {
    const query = `
      SELECT * FROM api_usage 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    const result = await this.getPool().query(query, [userId, limit]);
    
    return result.rows.map(row => this.mapApiUsageFromDb(row));
  }

  // Audit Logging
  async logAuditEvent(auditData: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    const query = `
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    const values = [
      auditData.userId,
      auditData.action,
      auditData.resourceType,
      auditData.resourceId,
      auditData.details ? JSON.stringify(auditData.details) : null,
      auditData.ipAddress,
      auditData.userAgent
    ];
    
    await this.getPool().query(query, values);
  }

  async getUserAuditLogs(userId: string, limit = 100): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    const result = await this.getPool().query(query, [userId, limit]);
    
    return result.rows.map(row => this.mapAuditLogFromDb(row));
  }

  // User Statistics
  async getUserStats(userId: string): Promise<any> {
    const query = 'SELECT get_user_stats($1)';
    const result = await this.getPool().query(query, [userId]);
    
    return result.rows[0].get_user_stats;
  }

  // Transaction Support
  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Helper Methods
  private mapUserFromDb(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      organization: row.organization,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login
    };
  }

  private mapRefreshTokenFromDb(row: any): RefreshToken {
    return {
      id: row.id,
      token: row.token,
      userId: row.user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      isRevoked: row.is_revoked
    };
  }

  private mapUserLayoutFromDb(row: any): UserLayout {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      template: row.template,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapApiUsageFromDb(row: any): ApiUsage {
    return {
      id: row.id,
      userId: row.user_id,
      endpoint: row.endpoint,
      method: row.method,
      requestSize: row.request_size,
      responseSize: row.response_size,
      processingTimeMs: row.processing_time_ms,
      statusCode: row.status_code,
      createdAt: row.created_at
    };
  }

  private mapAuditLogFromDb(row: any): AuditLog {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    };
  }
}

export const databaseService = new DatabaseService();