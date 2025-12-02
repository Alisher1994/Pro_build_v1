import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import { convertIfcToXkt } from '../services/ifcConverter';

const router = Router();
const prisma = new PrismaClient();

// Настройка multer для загрузки IFC файлов
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/ifc/');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'estimate-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.ifc') {
      cb(null, true);
    } else {
      cb(new Error('Only .ifc files are allowed'));
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
    console.error('Error uploading IFC:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
