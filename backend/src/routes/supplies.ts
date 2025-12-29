import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/supplies - Получить все планы снабжения
router.get('/', async (req, res) => {
  try {
    const { projectId, limit, offset } = req.query;
    const take = limit ? Math.min(Math.max(Number(limit), 1), 200) : undefined;
    const skip = offset ? Math.max(Number(offset), 0) : 0;
    const where = projectId ? { projectId: String(projectId) } : undefined;
    
    const [total, supplies] = await Promise.all([
      prisma.supply.count({ where }),
      prisma.supply.findMany({
        where,
        include: {
          project: true,
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip
      })
    ]);
    res.json({ data: supplies, total, limit: take ?? null, offset: skip });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/supplies/:id - Получить план снабжения по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supply = await prisma.supply.findUnique({
      where: { id },
      include: {
        project: true,
        items: {
          include: {
            resource: true,
          },
          orderBy: { requiredDate: 'asc' },
        },
      },
    });

    if (!supply) {
      return res.status(404).json({ error: 'Supply not found' });
    }

    res.json(supply);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/supplies - Создать новый план снабжения
router.post('/', async (req, res) => {
  try {
    const { projectId, name, description, status } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'projectId and name are required' });
    }

    const supply = await prisma.supply.create({
      data: {
        projectId,
        name,
        description,
        status: status || 'planning',
      },
      include: { project: true },
    });

    res.status(201).json(supply);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/supplies/:id - Обновить план снабжения
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const supply = await prisma.supply.update({
      where: { id },
      data: {
        name,
        description,
        status,
      },
    });

    res.json(supply);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Supply not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/supplies/:id - Удалить план снабжения
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.supply.delete({
      where: { id },
    });

    res.json({ message: 'Supply deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Supply not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/supplies/:id/items - Добавить позицию снабжения
router.post('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      resourceId,
      requiredDate,
      requiredQuantity,
      orderedDate,
      orderedQuantity,
      deliveredDate,
      deliveredQuantity,
      supplier,
      purchasePrice,
      status,
      notes,
    } = req.body;

    if (!resourceId || !requiredDate || requiredQuantity === undefined) {
      return res.status(400).json({
        error: 'resourceId, requiredDate and requiredQuantity are required',
      });
    }

    const item = await prisma.supplyItem.create({
      data: {
        supplyId: id,
        resourceId,
        requiredDate: new Date(requiredDate),
        requiredQuantity,
        orderedDate: orderedDate ? new Date(orderedDate) : undefined,
        orderedQuantity: orderedQuantity || 0,
        deliveredDate: deliveredDate ? new Date(deliveredDate) : undefined,
        deliveredQuantity: deliveredQuantity || 0,
        supplier,
        purchasePrice,
        status: status || 'not_ordered',
        notes,
      },
      include: { resource: true },
    });

    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/supplies/:supplyId/items/:itemId - Обновить позицию снабжения
router.put('/:supplyId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const {
      requiredDate,
      requiredQuantity,
      orderedDate,
      orderedQuantity,
      deliveredDate,
      deliveredQuantity,
      supplier,
      purchasePrice,
      status,
      notes,
    } = req.body;

    const item = await prisma.supplyItem.update({
      where: { id: itemId },
      data: {
        requiredDate: requiredDate ? new Date(requiredDate) : undefined,
        requiredQuantity,
        orderedDate: orderedDate ? new Date(orderedDate) : undefined,
        orderedQuantity,
        deliveredDate: deliveredDate ? new Date(deliveredDate) : undefined,
        deliveredQuantity,
        supplier,
        purchasePrice,
        status,
        notes,
      },
    });

    res.json(item);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Supply item not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/supplies/:supplyId/items/:itemId - Удалить позицию снабжения
router.delete('/:supplyId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    await prisma.supplyItem.delete({
      where: { id: itemId },
    });

    res.json({ message: 'Supply item deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Supply item not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
