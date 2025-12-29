import logger from '../utils/logger';
import { Router } from 'express';
import prisma from '../utils/prisma';
import multer from 'multer';
import path from 'path';
import { convertIfcToXkt } from '../services/ifcConverter';
import { QCadService } from '../services/qcadService';

const router = Router();

// Настройка multer для загрузки IFC файлов
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/ifc/');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, 'estimate-' + uniqueSuffix + path.extname(originalName));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extOk = path.extname(file.originalname).toLowerCase() === '.ifc';
    const mimeOk = file.mimetype === 'application/octet-stream' || file.mimetype === 'model/ifc' || file.mimetype === '';
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only .ifc files are allowed'));
    }
  },
});

// Настройка multer для загрузки проектных файлов (PDF, DWG)
const projectFilesStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/project_files/');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadProjectFile = multer({
  storage: projectFilesStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.pdf', '.dwg', '.dxf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf, .dwg and .dxf files are allowed'));
    }
  },
});

// GET /api/estimates - Получить все сметы
router.get('/', async (req, res) => {
  try {
    const { projectId, blockId } = req.query;
    
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    if (blockId) where.blockId = String(blockId);

    const estimates = await prisma.estimate.findMany({
      where,
      include: {
        project: true,
        block: true,
        _count: {
          select: { sections: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(estimates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/estimates/:id - Получить смету по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const estimate = await prisma.estimate.findUnique({
      where: { id },
      include: {
        project: true,
        block: true,
        sections: {
          include: {
            _count: {
              select: { stages: true },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    res.json(estimate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/estimates/:id/full - Получить полную структуру сметы для экспорта
router.get('/:id/full', async (req, res) => {
  try {
    const { id } = req.params;
    const estimate = await prisma.estimate.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            stages: {
              include: {
                workTypes: {
                  include: {
                    resources: true
                  },
                  orderBy: { orderIndex: 'asc' }
                }
              },
              orderBy: { orderIndex: 'asc' }
            }
          },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    res.json(estimate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/estimates - Создать новую смету
router.post('/', async (req, res) => {
  try {
    const { projectId, blockId, name, description, status } = req.body;

    if (!projectId || !blockId || !name) {
      return res.status(400).json({ error: 'projectId, blockId and name are required' });
    }

    const estimate = await prisma.estimate.create({
      data: {
        projectId,
        blockId,
        name,
        description,
        status: status || 'draft',
      },
      include: {
        project: true,
        block: true,
      },
    });

    res.status(201).json(estimate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/estimates/:id - Обновить смету
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, totalCost, status } = req.body;

    const estimate = await prisma.estimate.update({
      where: { id },
      data: {
        name,
        description,
        totalCost,
        status,
      },
    });

    res.json(estimate);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/estimates/:id - Удалить смету
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.estimate.delete({
      where: { id },
    });

    res.json({ message: 'Estimate deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/estimates/:id/recalculate - Пересчитать общую стоимость сметы
router.post('/:id/recalculate', async (req, res) => {
  try {
    const { id } = req.params;

    // Получить все разделы сметы
    const sections = await prisma.estimateSection.findMany({
      where: { estimateId: id },
      select: { totalCost: true },
    });

    const totalCost = sections.reduce((sum, section) => sum + section.totalCost, 0);

    const estimate = await prisma.estimate.update({
      where: { id },
      data: { totalCost },
    });

    res.json(estimate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/estimates/:id/upload-ifc - Загрузить IFC файл для сметы
router.post('/:id/upload-ifc', upload.single('ifc'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const estimate = await prisma.estimate.findUnique({
      where: { id },
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const ifcFilePath = req.file.path.replace(/\\/g, '/');
    
    // Конвертируем IFC в XKT
    const xktPath = await convertIfcToXkt({
      ifcPath: ifcFilePath,
      outputDir: 'uploads/xkt'
    });

    // Обновляем запись сметы с путями к файлам
    const updatedEstimate = await prisma.estimate.update({
      where: { id },
      data: {
        ifcFileUrl: ifcFilePath,
        xktFileUrl: xktPath,
      },
    });

    res.json({
      message: 'IFC file uploaded and converted successfully',
      estimate: updatedEstimate,
    });
  } catch (error: any) {
    logger.error('Error uploading IFC:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/estimates/:id/ifc - Удалить привязку IFC файла
router.delete('/:id/ifc', async (req, res) => {
  try {
    const { id } = req.params;

    const estimate = await prisma.estimate.update({
      where: { id },
      data: {
        ifcFileUrl: null,
        xktFileUrl: null,
      },
    });

    res.json({ message: 'IFC file unlinked successfully', estimate });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/estimates/:id/files - Получить список файлов сметы
router.get('/:id/files', async (req, res) => {
  try {
    const { id } = req.params;
    const files = await prisma.projectFile.findMany({
      where: { estimateId: id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(files);
  } catch (error: any) {
    console.error('Error fetching estimate files:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/estimates/:id/files - Загрузить проектный файл (PDF, DWG)
router.post('/:id/files', uploadProjectFile.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Исправляем кодировку имени файла (Multer по умолчанию использует Latin1)
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const fileType = path.extname(originalName).toLowerCase().substring(1);
    const filePath = req.file.path.replace(/\\/g, '/');
    let previewUrl = null;

    // Если это DWG, пробуем создать PDF-превью через QCAD
    if (fileType === 'dwg') {
      try {
        previewUrl = await QCadService.convertToPdf(req.file.path, 'uploads/project_files');
      } catch (err) {
        console.error('Failed to generate DWG preview:', err);
      }
    }

    const file = await prisma.projectFile.create({
      data: {
        estimateId: id,
        name: originalName,
        fileUrl: filePath,
        previewUrl: previewUrl,
        fileType: fileType,
        fileSize: req.file.size,
      },
    });

    res.status(201).json(file);
  } catch (error: any) {
    console.error('Error uploading project file:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/estimates/files/:fileId - Удалить проектный файл
router.delete('/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    await prisma.projectFile.delete({
      where: { id: fileId },
    });
    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

