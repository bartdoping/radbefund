import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

const ProcessSchema = z.object({
  text: z.string().min(1),
  options: z.object({
    mode: z.enum(["1", "2", "3", "4", "5"]),
    layout: z.string().optional(),
    includeRecommendations: z.boolean().optional().default(false),
  }),
  allowContentChanges: z.boolean().optional().default(false),
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI Prompts für verschiedene Modi
const getPromptForMode = (mode: string, layout?: string) => {
  const basePrompts = {
    "1": "OPTION 1 - SPRACHLICHE & GRAMMATIKALISCHE KORREKTUR (IMMER AKTIV):\nKorrigiere ausschließlich Rechtschreibung, Grammatik, Zeichensetzung und offensichtliche Tippfehler.\n- Alle medizinischen Inhalte, Zahlen, Messwerte, Einheiten und Lateralisierung (links/rechts) bleiben exakt unverändert\n- Keine Terminologie-Änderungen, keine Strukturänderungen\n- Behalte den ursprünglichen Stil und die Ansprache bei",
    
    "2": "OPTION 2 - TERMINOLOGIE VERBESSERN, STRUKTUR BLEIBT:\nWie Option 1, zusätzlich:\n- Vereinheitliche radiologische Fachterminologie nach deutscher Standardsprache\n- Verwende konsistente Abkürzungen (z.B. i.v., KM, CT, MRT)\n- Verbessere medizinische Begriffe, aber behalte die ursprüngliche Struktur bei",
    
    "3": "OPTION 3 - TERMINOLOGIE + UMSTRUKTURIERUNG (OBERARZT-NIVEAU) + KURZE BEURTEILUNG:\nWie Option 2, zusätzlich:\n- Strukturiere den Befund professionell um (Klinische Fragestellung → Technik → Befund → Beurteilung)\n- Verwende präzise, fachsprachlich korrekte Formulierungen auf Oberarzt-Niveau\n- Erstelle eine prägnante, medizinisch fundierte Beurteilung",
    
    "4": "OPTION 4 - KLINISCHE EMPFEHLUNG HINZUFÜGEN:\nWie Option 3, zusätzlich:\n- Füge klinisch relevante Empfehlungen hinzu, wenn medizinisch sinnvoll\n- Empfehlungen sollen evidenzbasiert und praxisrelevant sein",
    
    "5": "OPTION 5 - ZUSATZINFOS/DIFFERENTIALDIAGNOSEN:\nWie Option 4, zusätzlich:\n- Ergänze relevante Differentialdiagnosen, wenn klinisch sinnvoll\n- Füge wichtige Zusatzinformationen zur Befundinterpretation hinzu"
  };

  let prompt = basePrompts[mode as keyof typeof basePrompts] || basePrompts["1"];
  
  if (layout) {
    prompt += `\n\nLayout-Anforderung: Verwende das folgende Template:\n${layout}`;
  }
  
  return prompt;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, options, allowContentChanges } = ProcessSchema.parse(body);
    
    const systemPrompt = "Du bist ein Sprach- und Stildienst für radiologische Befunde. Du fügst keine neuen medizinischen Inhalte hinzu. Du änderst keine Zahlen, Einheiten, Messwerte, Seitenangaben oder Serien-/Bildnummern. Du vereinheitlichst Terminologie nach deutscher Fachsprache, schreibst prägnant und vermeidest leere Füllwörter. Antworte ausschließlich mit dem optimierten Text (ohne Kommentare oder Zusatzzeichen).";
    
    const userPrompt = getPromptForMode(options.mode, options.layout);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `AUFGABE:\n${userPrompt}\n\nTEXT:\n---\n${text}\n---\n\nWICHTIG: Keine neuen Diagnosen/Befunde/Therapieempfehlungen. Keine Zahlenänderungen. Keine Lateralisierungsänderungen.`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });
    
    const improvedText = completion.choices[0]?.message?.content || text;
    
    // Einfache Guard-Checks (vereinfacht)
    const hasNumbers = /\d+/.test(text) && /\d+/.test(improvedText);
    const hasLaterality = /(links|rechts|linke|rechte)/i.test(text) && /(links|rechts|linke|rechte)/i.test(improvedText);
    
    if (!hasNumbers || !hasLaterality) {
      return NextResponse.json({
        blocked: true,
        message: "Mögliche inhaltliche Änderungen erkannt. Bitte prüfen Sie das Ergebnis.",
        suggestion: improvedText
      });
    }
    
    return NextResponse.json({
      blocked: false,
      answer: improvedText
    });
    
  } catch (error: any) {
    console.error('AI processing error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungültige Eingabedaten", details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "AI-Verarbeitung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
