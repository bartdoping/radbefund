const { ChromaClient } = require('chromadb');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');

class RAGService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // ChromaDB Client (lokale Instanz)
    this.chromaClient = new ChromaClient({
      path: "http://localhost:8000"
    });
    
    this.collection = null;
    this.embeddingModel = 'text-embedding-3-large';
    this.chunkSize = 1000;
    this.chunkOverlap = 200;
  }

  async initialize() {
    try {
      // Erstelle oder lade Collection
      const collections = await this.chromaClient.listCollections();
      const collectionName = 'radbefund_knowledge';
      
      if (collections.find(c => c.name === collectionName)) {
        this.collection = await this.chromaClient.getCollection(collectionName);
      } else {
        this.collection = await this.chromaClient.createCollection({
          name: collectionName,
          metadata: { description: 'RadBefund+ Knowledge Base' }
        });
      }
      
      console.log('✅ RAG Service initialized successfully');
    } catch (error) {
      console.error('❌ RAG Service initialization failed:', error);
      throw error;
    }
  }

  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async chunkText(text, metadata = {}) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize) {
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: {
              ...metadata,
              chunkIndex: chunkIndex++,
              chunkSize: currentChunk.length
            }
          });
        }
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          ...metadata,
          chunkIndex: chunkIndex++,
          chunkSize: currentChunk.length
        }
      });
    }
    
    return chunks;
  }

  async processFile(filePath, metadata = {}) {
    const fileExtension = path.extname(filePath).toLowerCase();
    let content = '';
    
    try {
      switch (fileExtension) {
        case '.pdf':
          const pdfBuffer = await fs.readFile(filePath);
          const pdfData = await pdfParse(pdfBuffer);
          content = pdfData.text;
          break;
          
        case '.docx':
          const docxBuffer = await fs.readFile(filePath);
          const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
          content = docxResult.value;
          break;
          
        case '.txt':
          content = await fs.readFile(filePath, 'utf-8');
          break;
          
        case '.jpg':
        case '.jpeg':
        case '.png':
          // OCR für Bilder
          const imageBuffer = await fs.readFile(filePath);
          const ocrResult = await Tesseract.recognize(imageBuffer, 'deu+eng');
          content = ocrResult.data.text;
          break;
          
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }
      
      return {
        content,
        metadata: {
          ...metadata,
          fileType: fileExtension,
          fileSize: (await fs.stat(filePath)).size,
          processedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      throw error;
    }
  }

  async addDocument(content, metadata = {}) {
    try {
      // Text in Chunks aufteilen
      const chunks = await this.chunkText(content, metadata);
      
      // Embeddings für jeden Chunk generieren
      const embeddings = [];
      const documents = [];
      const metadatas = [];
      const ids = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.generateEmbedding(chunk.content);
        
        embeddings.push(embedding);
        documents.push(chunk.content);
        metadatas.push(chunk.metadata);
        ids.push(`${metadata.documentId || 'doc'}_chunk_${i}`);
      }
      
      // Zu ChromaDB hinzufügen
      await this.collection.add({
        ids: ids,
        embeddings: embeddings,
        documents: documents,
        metadatas: metadatas
      });
      
      console.log(`✅ Added ${chunks.length} chunks to knowledge base`);
      return chunks.length;
    } catch (error) {
      console.error('Error adding document to knowledge base:', error);
      throw error;
    }
  }

  async search(query, filters = {}, limit = 5) {
    try {
      // Query-Embedding generieren
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Suche in ChromaDB
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: filters
      });
      
      // Ergebnisse formatieren
      const formattedResults = results.documents[0].map((doc, index) => ({
        content: doc,
        metadata: results.metadatas[0][index],
        distance: results.distances[0][index],
        relevance: 1 - results.distances[0][index] // Konvertiere Distanz zu Relevanz
      }));
      
      return formattedResults;
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      throw error;
    }
  }

  async searchByModality(query, modality, limit = 5) {
    return this.search(query, { modality }, limit);
  }

  async searchByCategory(query, category, limit = 5) {
    return this.search(query, { category }, limit);
  }

  async searchByTags(query, tags, limit = 5) {
    return this.search(query, { tags: { $in: tags } }, limit);
  }

  async getRelevantContext(query, modality, workflowOptions = [], limit = 10) {
    try {
      const results = [];
      
      // 1. Modalitätsspezifische Suche
      if (modality) {
        const modalityResults = await this.searchByModality(query, modality, limit / 2);
        results.push(...modalityResults);
      }
      
      // 2. Workflow-spezifische Suche
      if (workflowOptions.includes('option3')) {
        const layoutResults = await this.searchByCategory(query, 'best_practices', limit / 4);
        results.push(...layoutResults);
      }
      
      // 3. Allgemeine Suche
      const generalResults = await this.search(query, {}, limit / 2);
      results.push(...generalResults);
      
      // 4. Duplikate entfernen und nach Relevanz sortieren
      const uniqueResults = results.reduce((acc, current) => {
        const existing = acc.find(item => item.content === current.content);
        if (!existing) {
          acc.push(current);
        } else if (current.relevance > existing.relevance) {
          acc[acc.indexOf(existing)] = current;
        }
        return acc;
      }, []);
      
      return uniqueResults
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting relevant context:', error);
      throw error;
    }
  }

  async deleteDocument(documentId) {
    try {
      // Alle Chunks für dieses Dokument löschen
      const results = await this.collection.get({
        where: { documentId }
      });
      
      if (results.ids.length > 0) {
        await this.collection.delete({
          ids: results.ids
        });
      }
      
      console.log(`✅ Deleted document ${documentId} from knowledge base`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async getCollectionStats() {
    try {
      const count = await this.collection.count();
      return {
        totalChunks: count,
        collectionName: this.collection.name
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      throw error;
    }
  }
}

module.exports = RAGService;
