// src/services/ai.ts
import OpenAI from 'openai';
import crypto from 'crypto';
import config from '../config';
import { cacheService } from './cache';
import logger from '../utils/logger';

export interface ProcessingOptions {
  mode: "1" | "2" | "3" | "4" | "5";
  stil: "knapp" | "neutral" | "ausführlicher";
  ansprache: "sie" | "neutral";
  layout?: string;
  includeRecommendations?: boolean;
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  cached: boolean;
}

export class AIService {
  private openai: OpenAI | null = null;
  private modelSelector: ModelSelector;

  constructor() {
    this.initializeOpenAI();
    this.modelSelector = new ModelSelector();
  }

  private initializeOpenAI(): void {
    if (config.ai.provider === 'openai' && config.ai.openaiApiKey) {
      this.openai = new OpenAI({ 
        apiKey: config.ai.openaiApiKey,
        timeout: 30000, // 30 seconds timeout
      });
      logger.info('OpenAI initialized successfully');
    } else {
      logger.warn('OpenAI not initialized - missing API key');
    }
  }

  async processText(
    text: string, 
    options: ProcessingOptions,
    userId?: string
  ): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(text, options);
      
      // Check cache first
      const cachedResponse = await cacheService.getAIResponse(cacheKey);
      if (cachedResponse) {
        logger.info('AI response served from cache', { 
          userId, 
          cacheKey: cacheKey.substring(0, 16) + '...',
          duration: Date.now() - startTime 
        });
        
        return {
          content: cachedResponse,
          cached: true,
          model: config.ai.openaiModel,
        };
      }

      // Select optimal model
      const model = this.modelSelector.selectOptimalModel(
        text.length,
        this.assessComplexity(text),
        'premium' // TODO: Get from user context
      );

      // Generate prompt
      const prompt = this.generatePrompt(text, options);
      
      // Call OpenAI
      const response = await this.callOpenAI(prompt, model);
      
      // Cache the response
      await cacheService.setAIResponse(cacheKey, response.content);
      
      const duration = Date.now() - startTime;
      
      // Log AI request
      logger.info('AI request processed', {
        userId,
        textLength: text.length,
        model,
        duration,
        tokensUsed: response.usage?.total_tokens,
        cached: false,
      });

      return {
        ...response,
        cached: false,
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('AI processing error', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration 
      });
      throw error;
    }
  }

  private async callOpenAI(messages: any[], model: string): Promise<AIResponse> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    const completion = await this.openai.chat.completions.create({
      model,
      messages,
      temperature: 0.0,
      max_tokens: 4000,
    });

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No response from OpenAI');
    }

    return {
      content: choice.message.content.trim(),
      usage: completion.usage ? {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens,
      } : undefined,
      model,
      cached: false,
    };
  }

  private generateCacheKey(text: string, options: ProcessingOptions): string {
    const normalized = text.toLowerCase().trim();
    const optionsStr = JSON.stringify(options);
    return crypto.createHash('sha256')
      .update(normalized + optionsStr)
      .digest('hex');
  }

  private assessComplexity(text: string): 'low' | 'medium' | 'high' {
    const length = text.length;
    const medicalTerms = (text.match(/\b(?:tumor|metastase|fraktur|infarkt|embol|aneurysma)\b/gi) || []).length;
    
    if (length > 3000 || medicalTerms > 5) return 'high';
    if (length > 1000 || medicalTerms > 2) return 'medium';
    return 'low';
  }

  private generatePrompt(text: string, options: ProcessingOptions): any[] {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.getUserPrompt(text, options);
    
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  private getSystemPrompt(): string {
    return `Du bist ein hochspezialisierter Sprach- und Stildienst für radiologische Befunde. 

WICHTIGE REGELN:
- Du fügst KEINE neuen medizinischen Inhalte hinzu
- Du änderst KEINE Zahlen, Einheiten, Messwerte, Seitenangaben oder Serien-/Bildnummern
- Du vereinheitlichst Terminologie nach deutscher Fachsprache
- Du schreibst prägnant und vermeidest leere Füllwörter
- Antworte ausschließlich mit dem optimierten Text (ohne Kommentare oder Zusatzzeichen)
- Fehlen Angaben, schreibe wörtlich: [keine Angabe]

MEDIZINISCHE PRÄZISION:
- Verwende korrekte anatomische Terminologie
- Halte dich an etablierte radiologische Standards
- Berücksichtige die klinische Relevanz der Befunde`;
  }

  private getUserPrompt(text: string, options: ProcessingOptions): string {
    const levelPrompt = this.getLevelPrompt(options.mode);
    const layoutPrompt = options.layout ? this.getLayoutPrompt(options.layout) : '';
    const structuredPrompt = options.includeRecommendations ? this.getStructuredPrompt() : '';
    
    return `AUFGABE:
${levelPrompt}

${layoutPrompt}

${structuredPrompt}

TEXT ZU OPTIMIEREN:
---
${text}
---

WICHTIG: Keine neuen Diagnosen/Befunde/Therapieempfehlungen. Keine Zahlenänderungen. Keine Lateralisierungsänderungen.`;
  }

  private getLevelPrompt(level: string): string {
    const prompts = {
      "1": `OPTION 1 - SPRACHLICHE & GRAMMATIKALISCHE KORREKTUR (IMMER AKTIV):
Korrigiere ausschließlich Rechtschreibung, Grammatik, Zeichensetzung und offensichtliche Tippfehler.
- Alle medizinischen Inhalte, Zahlen, Messwerte, Einheiten und Lateralisierung (links/rechts) bleiben exakt unverändert
- Keine Terminologie-Änderungen, keine Strukturänderungen
- Behalte den ursprünglichen Stil und die Ansprache bei`,

      "2": `OPTION 2 - TERMINOLOGIE VERBESSERN, STRUKTUR BLEIBT:
Wie Option 1, zusätzlich:
- Vereinheitliche radiologische Fachterminologie nach deutscher Standardsprache (RadLex-orientiert)
- Verwende konsistente Abkürzungen (z.B. i.v., KM, CT, MRT)
- Verbessere medizinische Begriffe, aber behalte die ursprüngliche Struktur bei`,

      "3": `OPTION 3 - TERMINOLOGIE + UMSTRUKTURIERUNG (OBERARZT-NIVEAU) + KURZE BEURTEILUNG:
Wie Option 2, zusätzlich:
- Strukturiere den Befund professionell um (Klinische Fragestellung → Technik → Befund → Beurteilung)
- Verwende präzise, fachsprachlich korrekte Formulierungen auf Oberarzt-Niveau
- Erstelle eine prägnante, medizinisch fundierte Beurteilung basierend auf den Befunden`,

      "4": `OPTION 4 - KLINISCHE EMPFEHLUNG HINZUFÜGEN (OPTIONAL):
Wie Option 3, zusätzlich:
- Füge klinisch relevante Empfehlungen hinzu, wenn medizinisch sinnvoll
- Empfehlungen sollen evidenzbasiert und praxisrelevant sein
- Formuliere konkrete, umsetzbare Handlungsempfehlungen`,

      "5": `OPTION 5 - ZUSATZINFOS/DIFFERENTIALDIAGNOSEN (OPTIONAL):
Wie Option 4, zusätzlich:
- Ergänze relevante Differentialdiagnosen, wenn klinisch sinnvoll
- Füge wichtige Zusatzinformationen zur Befundinterpretation hinzu
- Berücksichtige aktuelle Leitlinien und Evidenz`,
    };

    return prompts[level as keyof typeof prompts] || prompts["1"];
  }

  private getLayoutPrompt(layout: string): string {
    if (layout.includes('[') && layout.includes(']')) {
      // Custom template
      return `LAYOUT-TEMPLATE:
Verwende das folgende Template exakt für die Formatierung:
${layout}

Ersetze die Platzhalter:
- [BEFUND] → Der optimierte Befundtext
- [BEURTEILUNG] → Die medizinische Beurteilung (falls aktiviert)
- [EMPFEHLUNGEN] → Klinische Empfehlungen (falls aktiviert)
- [ZUSATZINFOS] → Zusatzinformationen/Differentialdiagnosen (falls aktiviert)`;
    } else {
      // Predefined layout
      const layouts = {
        'standard': 'Formatiere den Text im klassischen radiologischen Befundformat mit klarer Struktur.',
        'strukturiert': 'Gliedere den Text nach Organsystemen und verwende klare Abschnitte mit Überschriften.',
        'tabellarisch': 'Formatiere wichtige Befunde in übersichtlicher Tabellenform oder als strukturierte Aufzählung.',
        'konsiliar': 'Erstelle eine kompakte, überweisungsgerechte Kurzfassung mit den wichtigsten Befunden.',
      };
      
      return `LAYOUT-ANFORDERUNG: ${layouts[layout as keyof typeof layouts] || layouts.standard}`;
    }
  }

  private getStructuredPrompt(): string {
    return `STRUKTURIERTE AUSGABE:
Erstelle eine strukturierte Ausgabe basierend auf den aktivierten Optionen:

BEFUND:
[Der optimierte Befundtext - immer vorhanden]

BEURTEILUNG:
[Prägnante medizinische Beurteilung - nur wenn Option 3, 4 oder 5 aktiv]

EMPFEHLUNGEN:
[Klinisch relevante Empfehlungen - nur wenn Option 4 oder 5 aktiv und medizinisch sinnvoll]

ZUSATZINFORMATIONEN:
[Differentialdiagnosen und Zusatzinfos - nur wenn Option 5 aktiv und medizinisch wertvoll]

WICHTIG: Erstelle nur die Abschnitte, die den aktivierten Optionen entsprechen.`;
  }
}

class ModelSelector {
  private models = {
    'gpt-4o': { cost: 0.03, quality: 'high', speed: 'medium' },
    'gpt-4o-mini': { cost: 0.0015, quality: 'good', speed: 'fast' },
  };

  selectOptimalModel(
    textLength: number,
    complexity: 'low' | 'medium' | 'high',
    userTier: 'free' | 'premium' | 'enterprise'
  ): string {
    if (userTier === 'free') return 'gpt-4o-mini';
    if (complexity === 'high' && userTier === 'enterprise') return 'gpt-4o';
    if (textLength > 5000) return 'gpt-4o-mini'; // Better for long texts
    return 'gpt-4o-mini';
  }
}

export const aiService = new AIService();
