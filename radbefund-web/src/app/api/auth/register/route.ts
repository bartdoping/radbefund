import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Passwort muss mindestens ein Sonderzeichen enthalten"),
  name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein"),
  organization: z.string().optional(),
});

// In-memory storage für Demo (später durch PostgreSQL ersetzen)
const users = new Map();
const refreshTokens = new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, organization } = RegisterSchema.parse(body);
    
    // Prüfe ob Benutzer bereits existiert
    if (users.has(email)) {
      return NextResponse.json(
        { error: "Benutzer mit dieser E-Mail existiert bereits" },
        { status: 409 }
      );
    }
    
    // Hash Passwort
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Erstelle neuen Benutzer
    const userId = Date.now().toString();
    const user = {
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      name,
      organization,
      createdAt: new Date(),
      isActive: true
    };
    
    users.set(email, user);
    
    // Generiere Tokens
    const accessToken = jwt.sign(
      { userId, type: 'access' }, 
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' }, 
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    
    // Speichere Refresh Token
    refreshTokens.set(refreshToken, {
      token: refreshToken,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date()
    });
    
    return NextResponse.json({
      message: "Benutzer erfolgreich registriert",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Registration error:', error);
    
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
