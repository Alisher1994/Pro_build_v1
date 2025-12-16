import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const parseJsonField = (value: any, fallback: any) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('Failed to parse JSON field', error);
      return fallback;
    }
  }

  return fallback;
};

const formatJsonField = (value: any) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn('Failed to stringify JSON field', error);
    return undefined;
  }
};

const normalizeWorkType = (workType: any) => {
  if (!workType) return workType;
  return {
    ...workType,
    ifcElements: parseJsonField(workType.ifcElements, []),
    ifcProperties: parseJsonField(workType.ifcProperties, null),
  };
};

// GET /api/work-types - Получить все виды работ
router.get('/', async (req, res) => {
  try {
    const { stageId } = req.query;
    
    const workTypes = await prisma.workType.findMany({
      where: stageId ? { stageId: String(stageId) } : undefined,
      include: {
        stage: true,
        _count: {
          select: { resources: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });
    res.json(workTypes.map(normalizeWorkType));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/work-types/:id - Получить вид работ по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workType = await prisma.workType.findUnique({
      where: { id },
      include: {
        stage: {
          include: {
            section: true,
          },
        },
        resources: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!workType) {
      return res.status(404).json({ error: 'Work type not found' });
    }

    res.json(normalizeWorkType(workType));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/work-types - Создать новый вид работ
router.post('/', async (req, res) => {
  try {
    const {
      stageId,
      code,
      name,
      description,
      unit,
      quantity,
      unitCost,
      totalCost,
      orderIndex,
      ifcElements,
      ifcProperties,
    } = req.body;

    if (!stageId || !name) {
      return res.status(400).json({ error: 'stageId and name are required' });
    }

    const data: any = {
      stageId,
      name,
      description,
      orderIndex: orderIndex ?? 0,
    };

    if (code !== undefined) data.code = code;

    if (unit !== undefined) data.unit = unit;
    if (quantity !== undefined) data.quantity = quantity;
    if (unitCost !== undefined) data.unitCost = unitCost;

    const computedTotal =
      totalCost !== undefined
        ? totalCost
        : typeof quantity === 'number' && typeof unitCost === 'number'
        ? quantity * unitCost
        : undefined;
    if (computedTotal !== undefined) data.totalCost = computedTotal;

    const formattedIfcElements = formatJsonField(ifcElements);
    if (formattedIfcElements !== undefined) {
      data.ifcElements = formattedIfcElements;
    }

    const formattedIfcProperties = formatJsonField(ifcProperties);
    if (formattedIfcProperties !== undefined) {
      data.ifcProperties = formattedIfcProperties;
    }

    const workType = await prisma.workType.create({
      data,
      include: { stage: true },
    });

    res.status(201).json(normalizeWorkType(workType));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/work-types/:id - Обновить вид работ
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      description,
      unit,
      quantity,
      unitCost,
      totalCost,
      orderIndex,
      ifcElements,
      ifcProperties,
    } = req.body;

    // Получаем текущий WorkType для пересчета totalCost
    const current = await prisma.workType.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ error: 'WorkType not found' });
    }

    const data: any = {};

    if (code !== undefined) data.code = code;
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (unit !== undefined) data.unit = unit;
    if (quantity !== undefined) data.quantity = quantity;
    if (unitCost !== undefined) data.unitCost = unitCost;
    if (orderIndex !== undefined) data.orderIndex = orderIndex;

    // Вычисляем totalCost с учетом текущих и новых значений
    const newQuantity = quantity !== undefined ? quantity : current.quantity;
    const newUnitCost = unitCost !== undefined ? unitCost : current.unitCost;
    
    const computedTotal =
      totalCost !== undefined
        ? totalCost
        : newQuantity * newUnitCost;
    
    data.totalCost = computedTotal;

    const formattedIfcElements = formatJsonField(ifcElements);
    if (formattedIfcElements !== undefined) {
      data.ifcElements = formattedIfcElements;
    }

    const formattedIfcProperties = formatJsonField(ifcProperties);
    if (formattedIfcProperties !== undefined) {
      data.ifcProperties = formattedIfcProperties;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const workType = await prisma.workType.update({
      where: { id },
      data,
    });

    res.json(normalizeWorkType(workType));
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Work type not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/work-types/:id - Удалить вид работ
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.workType.delete({
      where: { id },
    });

    res.json({ message: 'Work type deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Work type not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/work-types/:id/recalculate - Пересчитать стоимость вида работ
router.post('/:id/recalculate', async (req, res) => {
  try {
    const { id } = req.params;

    // Получить все ресурсы вида работ
    const resources = await prisma.resource.findMany({
      where: { workTypeId: id },
      select: { totalCost: true },
    });

    const totalCost = resources.reduce((sum, r) => sum + r.totalCost, 0);

    const workType = await prisma.workType.update({
      where: { id },
      data: { totalCost },
    });

    res.json(normalizeWorkType(workType));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
