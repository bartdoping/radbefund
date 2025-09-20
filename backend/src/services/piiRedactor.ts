// src/services/piiRedactor.ts
import logger from '../utils/logger';

export interface Placeholder {
  id: string;
  original: string;
  type: string;
  confidence: number;
}

export interface RedactionResult {
  redacted: string;
  placeholders: Placeholder[];
  stats: {
    totalRedactions: number;
    byType: Record<string, number>;
    confidence: {
      high: number;
      medium: number;
      low: number;
    };
  };
}

export class PIIRedactorService {
  private patterns: Map<string, { pattern: RegExp; type: string; confidence: number }> = new Map();

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // High confidence patterns
    this.patterns.set('email', {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      type: 'email',
      confidence: 0.95,
    });

    this.patterns.set('phone', {
      pattern: /\b(?:\+49|0)[1-9]\d{1,4}\s?\d{1,4}\s?\d{1,4}\s?\d{1,4}\b/g,
      type: 'phone',
      confidence: 0.9,
    });

    this.patterns.set('ssn', {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      type: 'ssn',
      confidence: 0.95,
    });

    // Medical-specific patterns
    this.patterns.set('patient_id', {
      pattern: /\b(?:Pat\.?|Patient|Fall)\s*[:\-]?\s*([A-Z0-9]{6,12})\b/gi,
      type: 'patient_id',
      confidence: 0.85,
    });

    this.patterns.set('mrn', {
      pattern: /\b(?:MRN|Fallnummer|Aktenzeichen)\s*[:\-]?\s*([A-Z0-9]{6,12})\b/gi,
      type: 'mrn',
      confidence: 0.9,
    });

    this.patterns.set('dicom_uid', {
      pattern: /\b[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\b/g,
      type: 'dicom_uid',
      confidence: 0.95,
    });

    // Date patterns
    this.patterns.set('date_iso', {
      pattern: /\b\d{4}-\d{2}-\d{2}\b/g,
      type: 'date',
      confidence: 0.8,
    });

    this.patterns.set('date_german', {
      pattern: /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g,
      type: 'date',
      confidence: 0.7,
    });

    this.patterns.set('birth_date', {
      pattern: /\b(?:geb\.?|geboren|DOB)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/gi,
      type: 'birth_date',
      confidence: 0.85,
    });

    // Name patterns
    this.patterns.set('doctor_name', {
      pattern: /\b(?:Dr\.?|Prof\.?|PD\s*Dr\.?)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*\b/g,
      type: 'doctor_name',
      confidence: 0.8,
    });

    this.patterns.set('patient_name', {
      pattern: /\b(?:Name|Patient|Pat\.?|Herr|Frau)\s*[:\-]?\s*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b/gi,
      type: 'patient_name',
      confidence: 0.75,
    });

    // Address patterns
    this.patterns.set('german_postal', {
      pattern: /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß\s]+(?:Straße|Str\.?|Weg|Platz|Allee|Ring)\b/gi,
      type: 'address',
      confidence: 0.7,
    });

    // Insurance patterns
    this.patterns.set('insurance_number', {
      pattern: /\b(?:Versicherung|Vers\.?|Kasse)\s*[:\-]?\s*([A-Z0-9]{8,12})\b/gi,
      type: 'insurance_number',
      confidence: 0.8,
    });

    // Medical record numbers
    this.patterns.set('medical_record', {
      pattern: /\b(?:Akte|Krankenakte|Befund)\s*[:\-]?\s*([A-Z0-9]{4,10})\b/gi,
      type: 'medical_record',
      confidence: 0.75,
    });
  }

  redactPII(input: string): RedactionResult {
    const placeholders: Placeholder[] = [];
    let redacted = input;
    const stats = {
      totalRedactions: 0,
      byType: {} as Record<string, number>,
      confidence: { high: 0, medium: 0, low: 0 },
    };

    // Process each pattern
    for (const [name, { pattern, type, confidence }] of this.patterns) {
      const matches = redacted.match(pattern);
      if (matches) {
        redacted = redacted.replace(pattern, (match) => {
          const id = `[${type.toUpperCase()}_${placeholders.length}]`;
          placeholders.push({
            id,
            original: match,
            type,
            confidence,
          });

          // Update stats
          stats.totalRedactions++;
          stats.byType[type] = (stats.byType[type] || 0) + 1;
          
          if (confidence >= 0.8) {
            stats.confidence.high++;
          } else if (confidence >= 0.6) {
            stats.confidence.medium++;
          } else {
            stats.confidence.low++;
          }

          return id;
        });
      }
    }

    // Additional context-based redaction
    redacted = this.performContextualRedaction(redacted, placeholders);

    logger.info('PII redaction completed', {
      originalLength: input.length,
      redactedLength: redacted.length,
      totalRedactions: stats.totalRedactions,
      types: stats.byType,
    });

    return {
      redacted,
      placeholders,
      stats,
    };
  }

  private performContextualRedaction(text: string, placeholders: Placeholder[]): string {
    let redacted = text;

    // Redact sequences of numbers that might be IDs
    redacted = redacted.replace(/\b\d{6,12}\b/g, (match) => {
      // Skip if already redacted or if it's a medical measurement
      if (match.includes('[') || this.isMedicalMeasurement(match, text)) {
        return match;
      }

      const id = `[ID_${placeholders.length}]`;
      placeholders.push({
        id,
        original: match,
        type: 'numeric_id',
        confidence: 0.6,
      });
      return id;
    });

    // Redact potential names in medical context
    redacted = redacted.replace(
      /\b(?:Untersucht|Beurteilt|Befundet)\s+von\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)\b/gi,
      (match, name) => {
        const id = `[EXAMINER_${placeholders.length}]`;
        placeholders.push({
          id,
          original: name,
          type: 'examiner_name',
          confidence: 0.7,
        });
        return match.replace(name, id);
      }
    );

    return redacted;
  }

  private isMedicalMeasurement(number: string, context: string): boolean {
    // Check if the number appears to be a medical measurement
    const medicalUnits = ['mm', 'cm', 'ml', 'mg', 'kg', '°C', 'mmHg', 'bpm', 'Hz'];
    const surroundingText = context.substring(
      Math.max(0, context.indexOf(number) - 20),
      Math.min(context.length, context.indexOf(number) + number.length + 20)
    ).toLowerCase();

    return medicalUnits.some(unit => surroundingText.includes(unit));
  }

  reinsertPlaceholders(text: string, placeholders: Placeholder[]): string {
    let result = text;
    
    // Sort placeholders by confidence (high to low) to avoid conflicts
    const sortedPlaceholders = [...placeholders].sort((a, b) => b.confidence - a.confidence);
    
    for (const placeholder of sortedPlaceholders) {
      result = result.replaceAll(placeholder.id, placeholder.original);
    }

    return result;
  }

  // Validate redaction quality
  validateRedaction(original: string, redacted: string, placeholders: Placeholder[]): {
    isValid: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 100;

    // Check if all placeholders were reinserted
    const unreinsertedPlaceholders = placeholders.filter(p => 
      !redacted.includes(p.original) && redacted.includes(p.id)
    );
    
    if (unreinsertedPlaceholders.length > 0) {
      issues.push(`${unreinsertedPlaceholders.length} placeholders not reinserted`);
      score -= unreinsertedPlaceholders.length * 10;
    }

    // Check for potential data leakage
    const potentialLeaks = this.detectPotentialLeaks(original, redacted);
    if (potentialLeaks.length > 0) {
      issues.push(`Potential data leaks detected: ${potentialLeaks.join(', ')}`);
      score -= potentialLeaks.length * 15;
    }

    // Check redaction completeness
    const missedPII = this.detectMissedPII(redacted);
    if (missedPII.length > 0) {
      issues.push(`Missed PII: ${missedPII.join(', ')}`);
      score -= missedPII.length * 20;
    }

    return {
      isValid: issues.length === 0,
      issues,
      score: Math.max(0, score),
    };
  }

  private detectPotentialLeaks(original: string, redacted: string): string[] {
    const leaks: string[] = [];
    
    // Check for email patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const originalEmails = original.match(emailPattern) || [];
    const redactedEmails = redacted.match(emailPattern) || [];
    
    if (redactedEmails.length > 0) {
      leaks.push('email addresses');
    }

    // Check for phone numbers
    const phonePattern = /\b(?:\+49|0)[1-9]\d{1,4}\s?\d{1,4}\s?\d{1,4}\s?\d{1,4}\b/g;
    const redactedPhones = redacted.match(phonePattern) || [];
    
    if (redactedPhones.length > 0) {
      leaks.push('phone numbers');
    }

    return leaks;
  }

  private detectMissedPII(text: string): string[] {
    const missed: string[] = [];
    
    // Check for common PII patterns that might have been missed
    const patterns = [
      { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
      { name: 'credit card', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
      { name: 'IP address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
    ];

    for (const { name, pattern } of patterns) {
      if (pattern.test(text)) {
        missed.push(name);
      }
    }

    return missed;
  }

  // Add custom pattern
  addPattern(name: string, pattern: RegExp, type: string, confidence: number): void {
    this.patterns.set(name, { pattern, type, confidence });
    logger.info('Custom PII pattern added', { name, type, confidence });
  }

  // Get redaction statistics
  getRedactionStats(): any {
    const patterns = Array.from(this.patterns.values());
    const types = [...new Set(patterns.map(p => p.type))];
    
    return {
      totalPatterns: patterns.length,
      types: types.length,
      averageConfidence: patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length,
      highConfidencePatterns: patterns.filter(p => p.confidence >= 0.8).length,
    };
  }
}

// Singleton instance
export const piiRedactorService = new PIIRedactorService();
