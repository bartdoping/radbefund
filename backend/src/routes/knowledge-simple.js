const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

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

// POST /api/knowledge/upload - Dokument hochladen (Basic Version)
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

// GET /api/knowledge/stats - Statistiken der Wissensdatenbank (Basic Mode)
router.get('/stats', async (req, res) => {
  try {
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
