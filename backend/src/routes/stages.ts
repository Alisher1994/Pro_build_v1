import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/stages - Получить все этапы
router.get('/', async (req, res) => {
  try {
    const { sectionId } = req.query;
    
    const stages = await prisma.estimateStage.findMany({
      where: sectionId ? { sectionId: String(sectionId) } : undefined,
      include: {
        section: true,
        _count: {
          select: { workTypes: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });
    res.json(stages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stages/:id - Получить этап по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const stage = await prisma.estimateStage.findUnique({
      where: { id },
      include: {
        section: {
          include: {
            estimate: true,
          },
        },
        workTypes: {
          include: {
            _count: {
              select: { resources: true },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    res.json(stage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stages - Создать новый этап
router.post('/', async (req, res) => {
  try {
    const { sectionId, name, description, orderIndex } = req.body;

    if (!sectionId || !name) {
      return res.status(400).json({ error: 'sectionId and name are required' });
    }

    const stage = await prisma.estimateStage.create({
      data: {
        sectionId,
        name,
        description,
        orderIndex: orderIndex || 0,
      },
      include: { section: true },
    });

    res.status(201).json(stage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/stages/:id - Обновить этап
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, unit, quantity, unitCost, totalCost, orderIndex } = req.body;

    const stage = await prisma.estimateStage.update({
      where: { id },
      data: {
        name,
        description,
        unit,
        quantity,
        unitCost,
        totalCost,
        orderIndex,
      },
    });

    res.json(stage);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Stage not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/stages/:id - Удалить этап
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.estimateStage.delete({
      where: { id },
    });

    res.json({ message: 'Stage deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Stage not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stages/:id/recalculate - Пересчитать стоимость этапа
router.post('/:id/recalculate', async (req, res) => {
  try {
    const { id } = req.params;

    // Получить все виды работ этапа
    const workTypes = await prisma.workType.findMany({
      where: { stageId: id },
      select: { totalCost: true },
    });

    const totalCost = workTypes.reduce((sum, wt) => sum + wt.totalCost, 0);

    const stage = await prisma.estimateStage.update({
      where: { id },
      data: { totalCost },
    });

    res.json(stage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
