import { Router } from 'express';
import prisma from '../utils/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { convertIfcToXkt } from '../services/ifcConverter';
import logger from '../utils/logger';

const router = Router();

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
    // Исправляем кодировку имени файла (Multer по умолчанию использует Latin1)
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueName = `${Date.now()}-${originalName}`;
    cb(null, uniqueName);
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
  }
});

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

    logger.info(`📁 IFC файл загружен: ${ifcFileUrl}`);
    logger.info(`📦 Размер: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

    let xktFileUrl = null;

    // Пытаемся конвертировать IFC в XKT
    try {
      const xktDir = path.join(__dirname, '../../uploads/xkt');

      // Создаём директорию для XKT если не существует
      if (!fs.existsSync(xktDir)) {
        fs.mkdirSync(xktDir, { recursive: true });
      }

      logger.info('🔄 Начало конвертации IFC → XKT...');

      const xktPath = await convertIfcToXkt({
        ifcPath: ifcFilePath,
        outputDir: xktDir,
      });

      const xktFileName = path.basename(xktPath);
      xktFileUrl = `/uploads/xkt/${xktFileName}`;

      logger.info('✅ Конвертация завершена успешно');
      logger.info(`📂 XKT файл: ${xktFileUrl}`);
    } catch (conversionError: any) {
      logger.warn(`⚠️ Конвертация не удалась: ${conversionError.message}`);
      logger.info('📌 IFC файл сохранён, но XKT не создан');
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
    logger.error('❌ Ошибка загрузки IFC:', error);
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

// DELETE /api/sections/:id/ifc - Удалить привязку IFC файла
router.delete('/:id/ifc', async (req, res) => {
  try {
    const { id } = req.params;

    const section = await prisma.estimateSection.update({
      where: { id },
      data: {
        ifcFileUrl: null,
        xktFileUrl: null,
      },
    });

    res.json({ message: 'IFC file unlinked successfully', section });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sections/:id/bulk-import - Массовый импорт данных (Этапы -> Виды работ -> Ресурсы)
router.post('/:id/bulk-import', async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { stages } = req.body;

    if (!stages || !Array.isArray(stages)) {
      return res.status(400).json({ error: 'Stages array is required' });
    }

    // Проверяем существование раздела перед началом
    const section = await prisma.estimateSection.findUnique({
      where: { id: sectionId }
    });

    if (!section) {
      logger.error(`❌ Bulk import failed: Section ${sectionId} not found`);
      return res.status(404).json({ error: `Section ${sectionId} not found. It might have been deleted.` });
    }

    logger.info(`📦 Starting bulk import for section ${sectionId} (${section.name}), stages count: ${stages.length}`);

    // Используем транзакцию для атомарности
    const result = await prisma.$transaction(async (tx) => {
      const createdStages = [];

      for (let i = 0; i < stages.length; i++) {
        const stageData = stages[i];
        const stage = await tx.estimateStage.create({
          data: {
            sectionId,
            name: stageData.name,
            description: stageData.description || '',
            orderIndex: stageData.orderIndex !== undefined ? stageData.orderIndex : i,
            workTypes: {
              create: (stageData.works || []).map((work: any, workIdx: number) => ({
                code: work.code || null,
                cipher: work.cipher || null,
                name: work.name,
                unit: work.unit || 'шт',
                quantity: parseFloat(work.quantity) || 0,
                normPerUnit: work.normPerUnit !== undefined ? parseFloat(work.normPerUnit) || null : null,
                orderIndex: work.orderIndex !== undefined ? work.orderIndex : workIdx,
                resources: {
                  create: (work.resources || []).map((resource: any, resIdx: number) => {
                    const quantity = parseFloat(resource.quantity) || 0;
                    const price = parseFloat(resource.price) || parseFloat(resource.unitPrice) || 0;
                    const normPerUnit = resource.normPerUnit !== undefined ? parseFloat(resource.normPerUnit) || null : null;

                    return {
                      name: resource.name,
                      code: resource.code || resource.number || null,
                      cipher: resource.cipher || null,
                      unit: resource.unit || 'шт',
                      quantity,
                      normPerUnit,
                      unitPrice: price,
                      totalCost: quantity * price,
                      resourceType: resource.resourceType || 'material',
                      orderIndex: resource.orderIndex !== undefined ? resource.orderIndex : resIdx
                    };
                  })
                }
              }))
            }
          }
        });
        createdStages.push(stage);
      }
      return createdStages;
    }, {
      timeout: 30000 // Увеличиваем таймаут для больших импортов
    });

    res.status(201).json({
      success: true,
      message: 'Bulk import completed successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('❌ Bulk import error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
