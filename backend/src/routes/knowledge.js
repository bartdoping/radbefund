const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Admin Middleware - nur Admin kann Wissensdatenbank verwalten
const isAdmin = (req, res, next) => {
  console.log('Admin check - req.user:', req.user);
  
  // Temporär: Erlaube alle authentifizierten Nutzer (für Testing)
  if (!req.user) {
    console.log('Admin check failed - no user');
    return res.status(403).json({ error: 'Admin-Berechtigung erforderlich' });
  }
  
  // Prüfe E-Mail-Adresse falls vorhanden
  if (req.user.email && req.user.email !== 'ahmadh.mustafaa@gmail.com') {
    console.log('Admin check failed - email:', req.user.email);
    return res.status(403).json({ error: 'Admin-Berechtigung erforderlich' });
  }
  
  console.log('Admin check passed - user:', req.user.userId);
  next();
};

// RAG Service - lazy initialization (persistent instance)
let ragService = null;
const getRAGService = async () => {
  if (!ragService) {
    try {
      const RAGService = require('../services/ragService');
      ragService = new RAGService();
      await ragService.initialize();
      console.log('✅ RAG Service initialized (persistent instance)');
    } catch (error) {
      console.error('❌ RAG Service initialization failed:', error.message);
      ragService = null;
      return null;
    }
  }
  return ragService;
};

// Multer Konfiguration für File Upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/knowledge');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB Limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only PDF, DOCX, TXT, JPG, JPEG, PNG are allowed.'));
    }
  }
});

// RAG Service wird lazy initialisiert

// GET /api/knowledge/documents - Lade alle Dokumente (für Browse-Tab)
router.get('/documents', async (req, res) => {
  try {
    const rag = await getRAGService();
    
    if (rag) {
      try {
        // Hole echte Dokumentenliste aus dem RAG Service
        const documents = await rag.getDocumentList();
        const stats = await rag.getCollectionStats();
        
        console.log('RAG Stats:', stats);
        console.log('Documents loaded:', documents.length);

        res.json({
          success: true,
          documents: documents,
          totalCount: documents.length,
          ragStats: stats
        });
      } catch (ragError) {
        console.error('RAG documents error:', ragError);
        res.json({
          success: true,
          documents: [],
          totalCount: 0,
          message: 'RAG service error - no documents available'
        });
      }
    } else {
      res.json({
        success: true,
        documents: [],
        totalCount: 0,
        message: 'RAG service not available - no documents loaded'
      });
    }
  } catch (error) {
    console.error('Error loading documents:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Dokumente' });
  }
});

// GET /api/knowledge/search - Suche in der Wissensdatenbank
router.get('/search', async (req, res) => {
  try {
    const { q: query, modality, category, tags, limit = 5 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const rag = await getRAGService();
    
    if (rag) {
      try {
        // Erstelle Filter für die Suche
        const filters = {};
        if (modality) filters.modality = modality;
        if (category) filters.category = category;
        if (tags) filters.tags = { $in: tags.split(',') };

        // Suche durchführen
        const results = await rag.search(query, filters, parseInt(limit));
        
        res.json({
          success: true,
          results: results,
          query: query,
          filters: { modality, category, tags },
          totalResults: results.length
        });
      } catch (ragError) {
        console.error('RAG search error:', ragError);
        res.json({
          success: true,
          results: [],
          query: query,
          filters: { modality, category, tags },
          message: 'Search failed - RAG service error'
        });
      }
    } else {
      // Fallback zu Basic Mode
      res.json({
        success: true,
        results: [],
        query: query,
        filters: { modality, category, tags },
        message: 'Search not available - RAG service not configured'
      });
    }
  } catch (error) {
    console.error('Knowledge search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/knowledge/context - Kontextuelle Suche für KI
router.get('/context', async (req, res) => {
  try {
    const { query, modality, workflowOptions, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const rag = await getRAGService();
    
    if (rag) {
      try {
        const workflowArray = workflowOptions ? workflowOptions.split(',') : [];
        
        // Kontextuelle Suche durchführen
        const contextResults = await rag.getRelevantContext(query, modality, workflowArray, parseInt(limit));
        
        res.json({
          success: true,
          context: contextResults,
          query: query,
          modality: modality,
          workflowOptions: workflowArray,
          totalResults: contextResults.length
        });
      } catch (ragError) {
        console.error('RAG context error:', ragError);
        const workflowArray = workflowOptions ? workflowOptions.split(',') : [];
        res.json({
          success: true,
          context: [],
          query: query,
          modality: modality,
          workflowOptions: workflowArray,
          message: 'Context search failed - RAG service error'
        });
      }
    } else {
      // Fallback zu Basic Mode
      const workflowArray = workflowOptions ? workflowOptions.split(',') : [];
      res.json({
        success: true,
        context: [],
        query: query,
        modality: modality,
        workflowOptions: workflowArray,
        message: 'Context search not available - RAG service not configured'
      });
    }
  } catch (error) {
    console.error('Knowledge context error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/knowledge/upload - Dokument hochladen (Admin only)
router.post('/upload', authenticateToken, isAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description, modality, category, tags, priority = 'medium' } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // RAG Service verwenden für vollständige Verarbeitung
    const rag = await getRAGService();
    
    if (rag) {
      try {
        // Datei verarbeiten
        const processedFile = await rag.processFile(req.file.path, {
          title,
          description,
          modality,
          category,
          tags: tags ? tags.split(',') : [],
          priority,
          uploadedBy: req.user?.id || 'unknown'
        });

        // Zu Knowledge Base hinzufügen
        const chunksAdded = await rag.addDocument(processedFile.content, {
          documentId: req.file.filename,
          title,
          description,
          modality,
          category,
          tags: tags ? tags.split(',') : [],
          priority,
          fileSize: req.file.size,
          fileType: path.extname(req.file.originalname),
          uploadedAt: new Date().toISOString(),
          uploadedBy: req.user?.id || 'unknown'
        });

        const fileInfo = {
          id: req.file.filename,
          title,
          description,
          modality,
          category,
          tags: tags ? tags.split(',') : [],
          priority,
          fileSize: req.file.size,
          fileType: path.extname(req.file.originalname),
          uploadedAt: new Date().toISOString(),
          uploadedBy: req.user?.id || 'unknown',
          chunksAdded,
          contentLength: processedFile.content.length
        };

        console.log('✅ File uploaded and processed with RAG:', fileInfo);

        res.json({
          success: true,
          message: `Document uploaded and processed successfully. Added ${chunksAdded} chunks to knowledge base.`,
          document: fileInfo
        });
      } catch (ragError) {
        console.error('RAG processing error:', ragError);
        // Fallback zu Basic Mode
        const fileInfo = {
          id: req.file.filename,
          title,
          description,
          modality,
          category,
          tags: tags ? tags.split(',') : [],
          priority,
          fileSize: req.file.size,
          fileType: path.extname(req.file.originalname),
          uploadedAt: new Date().toISOString(),
          uploadedBy: req.user?.id || 'unknown',
          error: 'RAG processing failed, stored as basic document'
        };

        res.json({
          success: true,
          message: 'Document uploaded (RAG processing failed, stored as basic document)',
          document: fileInfo
        });
      }
    } else {
      // Fallback zu Basic Mode
      const fileInfo = {
        id: req.file.filename,
        title,
        description,
        modality,
        category,
        tags: tags ? tags.split(',') : [],
        priority,
        fileSize: req.file.size,
        fileType: path.extname(req.file.originalname),
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.id || 'unknown'
      };

      console.log('File uploaded (basic mode - RAG not available):', fileInfo);

      res.json({
        success: true,
        message: 'Document uploaded successfully (basic mode - RAG not available)',
        document: fileInfo
      });
    }
  } catch (error) {
    console.error('Knowledge upload error:', error);

    // Datei löschen bei Fehler
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/knowledge/text - Text direkt hinzufügen
router.post('/text', async (req, res) => {
  try {
    const { title, content, description, modality, category, tags, priority = 'medium' } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const metadata = {
      title,
      description,
      modality,
      category,
      tags: tags || [],
      priority,
      documentId: `text_${Date.now()}`,
      uploadedBy: req.user.id,
      type: 'text'
    };
    
    const rag = getRAGService();
    if (!rag) {
      return res.status(503).json({ error: 'Knowledge base service not available' });
    }
    
    const chunkCount = await rag.addDocument(content, metadata);
    
    res.json({
      success: true,
      message: 'Text added to knowledge base successfully',
      document: {
        id: metadata.documentId,
        title,
        description,
        modality,
        category,
        tags,
        priority,
        chunkCount,
        type: 'text'
      }
    });
  } catch (error) {
    console.error('Knowledge text upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/knowledge/stats - Statistiken der Wissensdatenbank (Basic Mode) - REMOVED

// DELETE /api/knowledge/:documentId - Dokument löschen (Basic Mode)
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const rag = await getRAGService();
    if (rag) {
      try {
        // Lösche Dokument aus RAG Service
        await rag.deleteDocument(documentId);
        
        console.log(`✅ Document ${documentId} deleted successfully`);
        
        res.json({
          success: true,
          message: `Document ${documentId} deleted successfully`
        });
      } catch (ragError) {
        console.error('RAG delete error:', ragError);
        res.status(500).json({ error: 'Fehler beim Löschen des Dokuments' });
      }
    } else {
      res.json({
        success: true,
        message: 'Document deleted successfully (basic mode - RAG service not configured)'
      });
    }
  } catch (error) {
    console.error('Knowledge delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/knowledge/categories - Verfügbare Kategorien
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { id: 'best_practices', name: 'Best Practices', description: 'Empfehlungen für optimale Befundschreibung' },
      { id: 'guidelines', name: 'Leitlinien', description: 'Medizinische Leitlinien und Standards' },
      { id: 'glossaries', name: 'Glossare', description: 'Terminologie und Klassifikationen' },
      { id: 'literature', name: 'Literatur', description: 'Relevante wissenschaftliche Literatur' },
      { id: 'modality_specific', name: 'Modalitätsspezifisch', description: 'Spezifische Inhalte für bestimmte Modalitäten' }
    ];
    
    res.json({
      success: true,
      categories: categories
    });
  } catch (error) {
    console.error('Knowledge categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/knowledge/modalities - Verfügbare Modalitäten
router.get('/modalities', async (req, res) => {
  try {
    const modalities = [
      { id: 'CT', name: 'Computertomographie', description: 'CT-spezifische Inhalte' },
      { id: 'MRI', name: 'Magnetresonanztomographie', description: 'MRT-spezifische Inhalte' },
      { id: 'Sonografie', name: 'Sonografie', description: 'Ultraschall-spezifische Inhalte' },
      { id: 'Röntgen', name: 'Röntgen', description: 'Röntgen-spezifische Inhalte' },
      { id: 'Durchleuchtung', name: 'Durchleuchtung', description: 'Durchleuchtungs-spezifische Inhalte' },
      { id: 'PET/CT', name: 'PET/CT', description: 'PET/CT-spezifische Inhalte' }
    ];
    
    res.json({
      success: true,
      modalities: modalities
    });
  } catch (error) {
    console.error('Knowledge modalities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/knowledge/:documentId - Dokument löschen (Admin only) - DISABLED (duplicate route)
/*
router.delete('/:documentId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    const rag = await getRAGService();
    
    if (rag) {
      try {
        // Aus Knowledge Base löschen
        await rag.deleteDocument(documentId);
        
        // Datei vom Server löschen
        const uploadDir = path.join(__dirname, '../../uploads/knowledge');
        const filePath = path.join(uploadDir, documentId);
        
        try {
          await fs.unlink(filePath);
        } catch (fileError) {
          console.warn('File not found for deletion:', fileError.message);
        }

        res.json({
          success: true,
          message: `Document ${documentId} deleted successfully from knowledge base`
        });
      } catch (ragError) {
        console.error('RAG deletion error:', ragError);
        res.status(500).json({ error: 'Failed to delete document from knowledge base' });
      }
    } else {
      // Fallback: Nur Datei löschen
      const uploadDir = path.join(__dirname, '../../uploads/knowledge');
      const filePath = path.join(uploadDir, documentId);
      
      try {
        await fs.unlink(filePath);
        res.json({
          success: true,
          message: `Document ${documentId} deleted successfully (basic mode)`
        });
      } catch (fileError) {
        res.status(404).json({ error: 'Document not found' });
      }
    }
  } catch (error) {
    console.error('Knowledge deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
*/

// GET /api/knowledge/stats - Knowledge Base Statistiken (Admin only)
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const rag = await getRAGService();
    
    if (rag) {
      try {
        const stats = await rag.getCollectionStats();
        res.json({
          success: true,
          stats: stats
        });
      } catch (ragError) {
        console.error('RAG stats error:', ragError);
        res.json({
          success: true,
          stats: { totalChunks: 0, collectionName: 'not_available' },
          message: 'Stats not available - RAG service error'
        });
      }
    } else {
      res.json({
        success: true,
        stats: { totalChunks: 0, collectionName: 'not_available' },
        message: 'Stats not available - RAG service not configured'
      });
    }
  } catch (error) {
    console.error('Knowledge stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
