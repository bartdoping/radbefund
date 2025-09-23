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
      // PostgreSQL Database connection for persistent storage
      const { Pool } = require('pg');
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'radbefund_db',
        user: process.env.DB_USER || 'radbefund_user',
        password: process.env.DB_PASSWORD || 'radbefund_password',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Initialize PostgreSQL tables for persistent storage
      await this.createTables();
      
      // Load existing documents from PostgreSQL
      await this.loadDocumentsFromDB();
      
      // Initialize in-memory fallback
      if (!this.documents) {
        this.documents = [];
      }
      if (!this.documentList) {
        this.documentList = [];
      }
      this.isInitialized = true;
      
      console.log('✅ RAG Service initialized successfully (PostgreSQL + In-Memory Fallback)');
      
    } catch (error) {
      console.error('❌ RAG Service initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    try {
      // Create knowledge_documents table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          file_path VARCHAR(500),
          content_type VARCHAR(100),
          file_size INTEGER,
          modality VARCHAR(50),
          category VARCHAR(100),
          tags TEXT[],
          priority VARCHAR(20) DEFAULT 'medium',
          chunk_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create knowledge_chunks table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          chunk_index INTEGER,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('✅ Knowledge base tables created/verified');
    } catch (error) {
      console.error('❌ Error creating knowledge base tables:', error);
      throw error;
    }
  }

  async loadDocumentsFromDB() {
    try {
      const result = await this.pool.query('SELECT * FROM knowledge_documents ORDER BY created_at DESC');
      this.documentList = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        filePath: row.file_path,
        contentType: row.content_type,
        fileSize: row.file_size,
        modality: row.modality,
        category: row.category,
        tags: row.tags || [],
        priority: row.priority,
        chunkCount: row.chunk_count,
        createdAt: row.created_at
      }));
      
      console.log(`✅ Loaded ${this.documentList.length} documents from PostgreSQL`);
    } catch (error) {
      console.warn('⚠️ Could not load documents from PostgreSQL, using in-memory fallback:', error.message);
      this.documentList = [];
    }
  }

  async saveDocumentToDB(document) {
    try {
      if (!this.pool) {
        console.warn('⚠️ No database connection, document not saved to PostgreSQL');
        return null;
      }

      const result = await this.pool.query(`
        INSERT INTO knowledge_documents (
          title, description, file_path, content_type, file_size, 
          modality, category, tags, priority, chunk_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        document.title,
        document.description,
        document.filePath || null,
        document.contentType || null,
        document.fileSize || null,
        document.modality || null,
        document.category || null,
        document.tags || [],
        document.priority || 'medium',
        document.chunkCount || 0
      ]);

      console.log(`✅ Document "${document.title}" saved to PostgreSQL`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error saving document to PostgreSQL:', error);
      return null;
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
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      console.log('📝 Adding document:', metadata.title);
      
      // Text in Chunks aufteilen
      let chunks = [];
      try {
        chunks = await this.chunkText(content, metadata);
        console.log(`📄 Created ${chunks.length} chunks`);
      } catch (chunkError) {
        console.warn('⚠️ Chunking failed, using simple chunk:', chunkError.message);
        // Fallback: Einfacher Chunk
        chunks = [{
          content: content,
          metadata: {
            ...metadata,
            chunkIndex: 0,
            chunkSize: content.length
          }
        }];
      }
      
      // Erstelle Dokumenten-Eintrag
      const documentEntry = {
        id: metadata.documentId || `doc_${Date.now()}`,
        title: metadata.title || 'Unbenanntes Dokument',
        description: metadata.description || '',
        modality: metadata.modality || '',
        category: metadata.category || '',
        tags: metadata.tags || [],
        priority: metadata.priority || 'medium',
        chunkCount: chunks.length,
        fileSize: metadata.fileSize || content.length,
        fileType: metadata.fileType || 'text',
        type: metadata.type || 'text',
        uploadedAt: new Date().toISOString()
      };
      
      // Save to PostgreSQL database
      if (this.pool) {
        try {
          const docResult = await this.pool.query(
            `INSERT INTO knowledge_documents (title, description, file_path, content_type, file_size, modality, category, tags, priority, chunk_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [
              documentEntry.title,
              documentEntry.description,
              null, // file_path (nicht für Text-Dokumente)
              'text/plain', // content_type
              documentEntry.fileSize,
              documentEntry.modality,
              documentEntry.category,
              documentEntry.tags,
              documentEntry.priority,
              documentEntry.chunkCount
            ]
          );
          
          const savedDoc = docResult.rows[0];
          documentEntry.id = savedDoc.id; // Verwende die generierte UUID
          
          // Save chunks to database
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            await this.pool.query(
              `INSERT INTO knowledge_chunks (document_id, content, chunk_index, metadata)
               VALUES ($1, $2, $3, $4)`,
              [
                documentEntry.id,
                chunk.content,
                i,
                JSON.stringify({
                  ...chunk.metadata,
                  chunkIndex: i,
                  documentId: documentEntry.id
                })
              ]
            );
          }
          
          console.log(`✅ Document "${documentEntry.title}" saved to PostgreSQL database`);
        } catch (dbError) {
          console.error('Database save error:', dbError);
          // Fallback to in-memory storage
        }
      }
      
      // Füge zur In-Memory Liste hinzu (für Fallback)
      this.documentList.push(documentEntry);
      
      // Zu In-Memory Knowledge Base hinzufügen
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        this.documents.push({
          content: chunk.content,
          metadata: {
            ...chunk.metadata,
            chunkIndex: i,
            documentId: documentEntry.id
          }
        });
      }
      
      console.log(`✅ Added ${chunks.length} chunks to knowledge base (PostgreSQL + In-Memory Mode)`);
      return { document: documentEntry, chunkCount: chunks.length };
    } catch (error) {
      console.error('Error adding document to knowledge base:', error);
      throw error;
    }
  }

  async search(query, filters = {}, limit = 5) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Einfache Textsuche in In-Memory Knowledge Base
      const queryLower = query.toLowerCase();
      const results = [];
      
      for (const doc of this.documents) {
        let relevance = 0;
        
        // Einfache Relevanz-Berechnung basierend auf Text-Übereinstimmung
        if (doc.content.toLowerCase().includes(queryLower)) {
          relevance += 0.8;
        }
        
        if (doc.metadata.title && doc.metadata.title.toLowerCase().includes(queryLower)) {
          relevance += 0.9;
        }
        
        if (doc.metadata.description && doc.metadata.description.toLowerCase().includes(queryLower)) {
          relevance += 0.7;
        }
        
        // Filter anwenden
        let matchesFilter = true;
        if (filters.modality && doc.metadata.modality !== filters.modality) {
          matchesFilter = false;
        }
        if (filters.category && doc.metadata.category !== filters.category) {
          matchesFilter = false;
        }
        if (filters.tags && filters.tags.$in) {
          const hasMatchingTag = filters.tags.$in.some(tag => 
            doc.metadata.tags && doc.metadata.tags.includes(tag)
          );
          if (!hasMatchingTag) {
            matchesFilter = false;
          }
        }
        
        if (relevance > 0 && matchesFilter) {
          results.push({
            content: doc.content,
            metadata: doc.metadata,
            relevance: relevance
          });
        }
      }
      
      // Nach Relevanz sortieren und limitieren
      return results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
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
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      let totalChunks = 0;
      let totalDocuments = 0;
      let mode = 'In-Memory';
      let collectionName = 'radbefund_knowledge_in_memory';
      
      // Hole Statistiken aus PostgreSQL falls verfügbar
      if (this.pool) {
        try {
          const docResult = await this.pool.query('SELECT COUNT(*) as count FROM knowledge_documents');
          const chunkResult = await this.pool.query('SELECT COUNT(*) as count FROM knowledge_chunks');
          
          totalDocuments = parseInt(docResult.rows[0].count);
          totalChunks = parseInt(chunkResult.rows[0].count);
          mode = 'PostgreSQL';
          collectionName = 'radbefund_knowledge_postgresql';
          
          console.log(`📊 PostgreSQL Stats: ${totalDocuments} documents, ${totalChunks} chunks`);
        } catch (dbError) {
          console.warn('⚠️ Could not get stats from PostgreSQL:', dbError.message);
          // Fallback zu In-Memory Stats
          totalChunks = this.documents.length;
          totalDocuments = this.documentList.length;
        }
      } else {
        // Fallback zu In-Memory Stats
        totalChunks = this.documents.length;
        totalDocuments = this.documentList.length;
      }
      
      return {
        totalChunks,
        totalDocuments,
        collectionName,
        mode
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      throw error;
    }
  }

  async getDocumentList() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Lade Dokumente aus PostgreSQL falls verfügbar
      if (this.pool) {
        try {
          const result = await this.pool.query('SELECT * FROM knowledge_documents ORDER BY created_at DESC');
          this.documentList = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            filePath: row.file_path,
            contentType: row.content_type,
            fileSize: row.file_size,
            modality: row.modality,
            category: row.category,
            tags: row.tags || [],
            priority: row.priority,
            chunkCount: row.chunk_count,
            createdAt: row.created_at
          }));
          
          console.log(`✅ Loaded ${this.documentList.length} documents from PostgreSQL`);
        } catch (dbError) {
          console.warn('⚠️ Could not load documents from PostgreSQL:', dbError.message);
        }
      }
      
      return this.documentList || [];
    } catch (error) {
      console.error('Error getting document list:', error);
      throw error;
    }
  }

  async deleteDocument(documentId) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Delete from PostgreSQL database
      if (this.pool) {
        try {
          // Delete chunks first (foreign key constraint)
          await this.pool.query('DELETE FROM knowledge_chunks WHERE document_id = $1', [documentId]);
          
          // Delete document
          const result = await this.pool.query('DELETE FROM knowledge_documents WHERE id = $1 RETURNING *', [documentId]);
          
          if (result.rows.length === 0) {
            console.log(`⚠️ Document ${documentId} not found in database`);
          } else {
            console.log(`✅ Document ${documentId} deleted from PostgreSQL database`);
          }
        } catch (dbError) {
          console.error('Database delete error:', dbError);
          // Fallback to in-memory deletion
        }
      }
      
      // Entferne aus In-Memory Dokumentenliste
      this.documentList = this.documentList.filter(doc => doc.id !== documentId);
      
      // Entferne alle Chunks dieses Dokuments aus In-Memory
      this.documents = this.documents.filter(doc => doc.metadata.documentId !== documentId);
      
      console.log(`✅ Document ${documentId} deleted from knowledge base (PostgreSQL + In-Memory Mode)`);
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }
}

module.exports = RAGService;
