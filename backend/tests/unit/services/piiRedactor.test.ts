// tests/unit/services/piiRedactor.test.ts
import { piiRedactorService } from '../../../src/services/piiRedactor';

describe('PIIRedactorService', () => {
  describe('redactPII', () => {
    it('should redact email addresses', () => {
      const input = 'Patient email: john.doe@example.com';
      const result = piiRedactorService.redactPII(input);
      
      expect(result.redacted).toContain('[EMAIL_');
      expect(result.redacted).not.toContain('john.doe@example.com');
      expect(result.placeholders).toHaveLength(1);
      expect(result.placeholders[0].original).toBe('john.doe@example.com');
      expect(result.placeholders[0].type).toBe('email');
      expect(result.placeholders[0].confidence).toBe(0.95);
    });

    it('should redact phone numbers', () => {
      const input = 'Kontakt: +49 30 12345678';
      const result = piiRedactorService.redactPII(input);
      
      expect(result.redacted).toContain('[PHONE_');
      expect(result.redacted).not.toContain('+49 30 12345678');
      expect(result.placeholders[0].type).toBe('phone');
    });

    it('should redact patient IDs', () => {
      const input = 'Patient: Pat. 123456789';
      const result = piiRedactorService.redactPII(input);
      
      expect(result.redacted).toContain('[PATIENT_ID_');
      expect(result.placeholders[0].type).toBe('patient_id');
    });

    it('should redact dates', () => {
      const input = 'Geburtsdatum: 15.03.1985';
      const result = piiRedactorService.redactPII(input);
      
      expect(result.redacted).toContain('[DATE_');
      expect(result.placeholders[0].type).toBe('date');
    });

    it('should redact doctor names', () => {
      const input = 'Untersucht von Dr. Max Mustermann';
      const result = piiRedactorService.redactPII(input);
      
      expect(result.redacted).toContain('[DOCTOR_NAME_');
      expect(result.placeholders[0].type).toBe('doctor_name');
    });

    it('should handle multiple PII types', () => {
      const input = `
        Patient: Max Mustermann
        Email: max@example.com
        Telefon: +49 30 12345678
        Geburtsdatum: 15.03.1985
      `;
      const result = piiRedactorService.redactPII(input);
      
      expect(result.stats.totalRedactions).toBeGreaterThan(3);
      expect(result.stats.byType).toHaveProperty('email');
      expect(result.stats.byType).toHaveProperty('phone');
      expect(result.stats.byType).toHaveProperty('date');
    });

    it('should not redact medical measurements', () => {
      const input = 'Tumor: 2.5 cm, Gewicht: 75 kg';
      const result = piiRedactorService.redactPII(input);
      
      expect(result.redacted).toContain('2.5 cm');
      expect(result.redacted).toContain('75 kg');
    });

    it('should provide accurate statistics', () => {
      const input = 'Email: test@example.com, Phone: +49 30 12345678';
      const result = piiRedactorService.redactPII(input);
      
      expect(result.stats.totalRedactions).toBe(2);
      expect(result.stats.byType.email).toBe(1);
      expect(result.stats.byType.phone).toBe(1);
      expect(result.stats.confidence.high).toBeGreaterThan(0);
    });
  });

  describe('reinsertPlaceholders', () => {
    it('should correctly reinsert all placeholders', () => {
      const original = 'Email: test@example.com, Phone: +49 30 12345678';
      const redaction = piiRedactorService.redactPII(original);
      const reinserted = piiRedactorService.reinsertPlaceholders(redaction.redacted, redaction.placeholders);
      
      expect(reinserted).toBe(original);
    });

    it('should handle empty placeholders array', () => {
      const text = 'No PII in this text';
      const result = piiRedactorService.reinsertPlaceholders(text, []);
      
      expect(result).toBe(text);
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const placeholders = [
        { id: '[EMAIL_0]', original: 'test@example.com', type: 'email', confidence: 0.95 }
      ];
      const text = 'Contact: [EMAIL_0] or [EMAIL_0]';
      const result = piiRedactorService.reinsertPlaceholders(text, placeholders);
      
      expect(result).toBe('Contact: test@example.com or test@example.com');
    });
  });

  describe('validateRedaction', () => {
    it('should validate successful redaction', () => {
      const original = 'Email: test@example.com';
      const redaction = piiRedactorService.redactPII(original);
      const reinserted = piiRedactorService.reinsertPlaceholders(redaction.redacted, redaction.placeholders);
      const validation = piiRedactorService.validateRedaction(original, reinserted, redaction.placeholders);
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.score).toBe(100);
    });

    it('should detect data leaks', () => {
      const original = 'Email: test@example.com';
      const redaction = piiRedactorService.redactPII(original);
      // Simulate incomplete redaction
      const incomplete = redaction.redacted.replace('[EMAIL_0]', 'test@example.com');
      const validation = piiRedactorService.validateRedaction(original, incomplete, redaction.placeholders);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain(expect.stringContaining('data leaks'));
      expect(validation.score).toBeLessThan(100);
    });

    it('should detect missed PII', () => {
      const original = 'Email: test@example.com';
      const redaction = piiRedactorService.redactPII(original);
      // Add unredacted PII
      const withLeak = redaction.redacted + ' Phone: +49 30 12345678';
      const validation = piiRedactorService.validateRedaction(original, withLeak, redaction.placeholders);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain(expect.stringContaining('Missed PII'));
    });
  });

  describe('addPattern', () => {
    it('should add custom pattern', () => {
      const customPattern = /\bCUSTOM_\d+\b/g;
      piiRedactorService.addPattern('custom_id', customPattern, 'custom', 0.8);
      
      const input = 'ID: CUSTOM_12345';
      const result = piiRedactorService.redactPII(input);
      
      expect(result.redacted).toContain('[CUSTOM_');
      expect(result.placeholders[0].type).toBe('custom');
    });
  });

  describe('getRedactionStats', () => {
    it('should return redaction statistics', () => {
      const stats = piiRedactorService.getRedactionStats();
      
      expect(stats).toHaveProperty('totalPatterns');
      expect(stats).toHaveProperty('types');
      expect(stats).toHaveProperty('averageConfidence');
      expect(stats).toHaveProperty('highConfidencePatterns');
      expect(stats.totalPatterns).toBeGreaterThan(0);
      expect(stats.types).toBeGreaterThan(0);
    });
  });
});
