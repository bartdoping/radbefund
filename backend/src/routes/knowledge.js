const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// RAG Service - disabled for now
let ragService = null;
const getRAGService = () => {
  console.log('RAG Service not available - using basic mode');
  return null;
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

// GET /api/knowledge/search - Suche in der Wissensdatenbank (Basic Mode)
router.get('/search', async (req, res) => {
  try {
    const { query, modality, category, tags, limit = 5 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Basic mode - return empty results
    res.json({
      success: true,
      results: [],
      query: query,
      filters: { modality, category, tags },
      message: 'Search not available in basic mode - RAG service not configured'
    });
  } catch (error) {
    console.error('Knowledge search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/knowledge/context - Kontextuelle Suche für KI (Basic Mode)
router.get('/context', async (req, res) => {
  try {
    const { query, modality, workflowOptions, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Basic mode - return empty context
    const workflowArray = workflowOptions ? workflowOptions.split(',') : [];
    res.json({
      success: true,
      context: [],
      query: query,
      modality: modality,
      workflowOptions: workflowArray,
      message: 'Context search not available in basic mode - RAG service not configured'
    });
  } catch (error) {
    console.error('Knowledge context error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/knowledge/upload - Dokument hochladen (Basic Version ohne RAG)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description, modality, category, tags, priority = 'medium' } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Basic file processing without RAG
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

    // TODO: Speichere Metadaten in Datenbank
    console.log('File uploaded (basic mode):', fileInfo);

    res.json({
      success: true,
      message: 'Document uploaded successfully (basic mode - RAG not available)',
      document: fileInfo
    });
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

// GET /api/knowledge/stats - Statistiken der Wissensdatenbank (Basic Mode)
router.get('/stats', async (req, res) => {
  try {
    // Basic mode - return empty stats
    res.json({
      success: true,
      stats: {
        totalDocuments: 0,
        totalChunks: 0,
        message: 'Stats not available in basic mode - RAG service not configured'
      }
    });
  } catch (error) {
    console.error('Knowledge stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/knowledge/:documentId - Dokument löschen (Basic Mode)
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Basic mode - just return success
    res.json({
      success: true,
      message: 'Document deleted successfully (basic mode - RAG service not configured)'
    });
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

module.exports = router;
