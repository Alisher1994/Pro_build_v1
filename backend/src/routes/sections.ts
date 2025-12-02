import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { convertIfcToXkt } from '../services/ifcConverter';

const router = Router();
const prisma = new PrismaClient();

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/ifc');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// GET /api/sections - Получить все разделы
router.get('/', async (req, res) => {
  try {
    const { estimateId } = req.query;
    
    const sections = await prisma.estimateSection.findMany({
      where: estimateId ? { estimateId: String(estimateId) } : undefined,
      include: {
        estimate: true,
        _count: {
          select: { stages: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });
    res.json(sections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sections/:id - Получить раздел по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const section = await prisma.estimateSection.findUnique({
      where: { id },
      include: {
        estimate: {
          include: {
            project: true,
            block: true,
          },
        },
        stages: {
          include: {
            _count: {
              select: { workTypes: true },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    res.json(section);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sections - Создать новый раздел
router.post('/', async (req, res) => {
  try {
    const { estimateId, code, name, description, orderIndex } = req.body;

    if (!estimateId || !code || !name) {
      return res.status(400).json({ error: 'estimateId, code and name are required' });
    }

    const section = await prisma.estimateSection.create({
      data: {
        estimateId,
        code,
        name,
        description,
        orderIndex: orderIndex || 0,
      },
      include: { estimate: true },
    });

    res.status(201).json(section);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/sections/:id - Обновить раздел
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, totalCost, orderIndex } = req.body;

    const section = await prisma.estimateSection.update({
      where: { id },
      data: {
        code,
        name,
        description,
        totalCost,
        orderIndex,
      },
    });

    res.json(section);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Section not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/sections/:id - Удалить раздел
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.estimateSection.delete({
      where: { id },
    });

    res.json({ message: 'Section deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Section not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sections/:id/upload-ifc - Загрузить IFC файл
router.post('/:id/upload-ifc', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ifcFileUrl = `/uploads/ifc/${req.file.filename}`;
    const ifcFilePath = path.join(__dirname, '../../uploads/ifc', req.file.filename);
    
    console.log('📁 IFC файл загружен:', ifcFileUrl);
    console.log('📦 Размер:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');

    let xktFileUrl = null;

    // Пытаемся конвертировать IFC в XKT
    try {
      const xktDir = path.join(__dirname, '../../uploads/xkt');
      
      // Создаём директорию для XKT если не существует
      if (!fs.existsSync(xktDir)) {
        fs.mkdirSync(xktDir, { recursive: true });
      }

      console.log('🔄 Начало конвертации IFC → XKT...');
      
      const xktPath = await convertIfcToXkt({
        ifcPath: ifcFilePath,
        outputDir: xktDir,
      });

      const xktFileName = path.basename(xktPath);
      xktFileUrl = `/uploads/xkt/${xktFileName}`;
      
      console.log('✅ Конвертация завершена успешно');
      console.log('📂 XKT файл:', xktFileUrl);
    } catch (conversionError: any) {
      console.warn('⚠️ Конвертация не удалась:', conversionError.message);
      console.log('📌 IFC файл сохранён, но XKT не создан');
      // Продолжаем без XKT - можем использовать IFC напрямую
    }

    // Обновляем раздел с путями к файлам
    const section = await prisma.estimateSection.update({
      where: { id },
      data: { 
        ifcFileUrl,
        xktFileUrl: xktFileUrl || undefined,
      },
    });

    res.json({ 
      success: true, 
      ifcFileUrl: section.ifcFileUrl,
      xktFileUrl: section.xktFileUrl,
      hasXkt: !!xktFileUrl,
      section 
    });
  } catch (error: any) {
    console.error('❌ Ошибка загрузки IFC:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Section not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sections/:id/recalculate - Пересчитать стоимость раздела
router.post('/:id/recalculate', async (req, res) => {
  try {
    const { id } = req.params;

    // Получить все этапы раздела
    const stages = await prisma.estimateStage.findMany({
      where: { sectionId: id },
      select: { totalCost: true },
    });

    const totalCost = stages.reduce((sum, stage) => sum + stage.totalCost, 0);

    const section = await prisma.estimateSection.update({
      where: { id },
      data: { totalCost },
    });

    res.json(section);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
