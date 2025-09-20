import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

// In-memory storage (gleiche Instanz wie in register)
const users = new Map();
const refreshTokens = new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = LoginSchema.parse(body);
    
    // Finde Benutzer
    const user = users.get(email.toLowerCase());
    if (!user) {
      return NextResponse.json(
        { error: "Ungültige Anmeldedaten" },
        { status: 401 }
      );
    }
    
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Benutzerkonto ist deaktiviert" },
        { status: 401 }
      );
    }
    
    // Prüfe Passwort
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Ungültige Anmeldedaten" },
        { status: 401 }
      );
    }
    
    // Aktualisiere letzte Anmeldung
    user.lastLogin = new Date();
    users.set(email.toLowerCase(), user);
    
    // Generiere Tokens
    const accessToken = jwt.sign(
      { userId: user.id, type: 'access' }, 
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' }, 
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    // Speichere Refresh Token
    refreshTokens.set(refreshToken, {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date()
    });
    
    return NextResponse.json({
      message: "Erfolgreich angemeldet",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        lastLogin: user.lastLogin
      },
      accessToken,
      refreshToken
    });
    
  } catch (error: any) {
    console.error('Login error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingabedaten", details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
