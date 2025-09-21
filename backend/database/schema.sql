-- RadBefund+ Database Schema
-- PostgreSQL Database für Benutzer, Sessions und Layouts

-- Erstelle Database (falls nicht existiert)
-- CREATE DATABASE radbefund_plus;

-- Verwende die Database
-- \c radbefund_plus;

-- Erstelle Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Add email_verified column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(500) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT false
);

-- Email Verification Codes Table
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_used BOOLEAN DEFAULT false
);

-- Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_used BOOLEAN DEFAULT false
);

-- User Layouts Table
CREATE TABLE IF NOT EXISTS user_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Usage Tracking Table
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_size INTEGER,
    response_size INTEGER,
    processing_time_ms INTEGER,
    status_code INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes für Performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_layouts_user_id ON user_layouts(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Row Level Security (RLS) aktivieren
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users können nur ihre eigenen Daten sehen
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (id = current_setting('app.current_user_id')::uuid);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (id = current_setting('app.current_user_id')::uuid);

-- Refresh Tokens
CREATE POLICY "Users can manage own tokens" ON refresh_tokens
    FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

-- User Layouts
CREATE POLICY "Users can manage own layouts" ON user_layouts
    FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

-- API Usage (nur eigene)
CREATE POLICY "Users can view own usage" ON api_usage
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::uuid);

-- Audit Logs (nur eigene)
CREATE POLICY "Users can view own audit logs" ON audit_logs
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::uuid);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_layouts_updated_at BEFORE UPDATE ON user_layouts
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Funktionen für häufige Operationen
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW() OR is_revoked = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Funktion für Benutzer-Statistiken
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_layouts', COUNT(ul.id),
        'total_api_calls', COUNT(au.id),
        'last_login', u.last_login,
        'account_created', u.created_at
    ) INTO result
    FROM users u
    LEFT JOIN user_layouts ul ON u.id = ul.user_id
    LEFT JOIN api_usage au ON u.id = au.user_id
    WHERE u.id = user_uuid
    GROUP BY u.id, u.last_login, u.created_at;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Initiale Daten (optional)
-- INSERT INTO users (email, password_hash, name, organization) VALUES
-- ('admin@radbefund.de', crypt('admin123', gen_salt('bf')), 'Admin User', 'RadBefund+');

-- Kommentare
COMMENT ON TABLE users IS 'Benutzer-Accounts für RadBefund+';
COMMENT ON TABLE refresh_tokens IS 'JWT Refresh Tokens für Session-Management';
COMMENT ON TABLE user_layouts IS 'Benutzerdefinierte Layout-Templates';
COMMENT ON TABLE api_usage IS 'API-Nutzungsstatistiken';
COMMENT ON TABLE audit_logs IS 'Audit-Logs für Sicherheit und Compliance';