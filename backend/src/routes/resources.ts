import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/resources - Получить все ресурсы
router.get('/', async (req, res) => {
  try {
    const { workTypeId, resourceType } = req.query;
    
    const where: any = {};
    if (workTypeId) where.workTypeId = String(workTypeId);
    if (resourceType) where.resourceType = String(resourceType);

    const resources = await prisma.resource.findMany({
      where,
      include: {
        workType: {
          include: {
            stage: {
              include: {
                section: true,
              },
            },
          },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });
    res.json(resources);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/resources/:id - Получить ресурс по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        workType: {
          include: {
            stage: {
              include: {
                section: true,
              },
            },
          },
        },
        supplyItems: true,
      },
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(resource);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/resources - Создать новый ресурс
router.post('/', async (req, res) => {
  try {
    const {
      workTypeId,
      name,
      code,
      unit,
      quantity,
      unitPrice,
      resourceType,
      ifcElements,
      ifcProperties,
      description,
      orderIndex,
    } = req.body;

    if (!workTypeId || !name || !unit || quantity === undefined || unitPrice === undefined) {
      return res.status(400).json({
        error: 'workTypeId, name, unit, quantity and unitPrice are required',
      });
    }

    const totalCost = quantity * unitPrice;

    const resource = await prisma.resource.create({
      data: {
        workTypeId,
        name,
        code,
        unit,
        quantity,
        unitPrice,
        totalCost,
        resourceType: resourceType || 'material',
        ifcElements,
        ifcProperties,
        description,
        orderIndex: orderIndex || 0,
      },
      include: { workType: true },
    });

    res.status(201).json(resource);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/resources/:id - Обновить ресурс
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      unit,
      quantity,
      unitPrice,
      resourceType,
      ifcElements,
      ifcProperties,
      description,
      orderIndex,
    } = req.body;

    // Пересчитать totalCost если изменились quantity или unitPrice
    let totalCost = undefined;
    if (quantity !== undefined && unitPrice !== undefined) {
      totalCost = quantity * unitPrice;
    } else {
      const existingResource = await prisma.resource.findUnique({ where: { id } });
      if (existingResource) {
        const newQuantity = quantity !== undefined ? quantity : existingResource.quantity;
        const newUnitPrice = unitPrice !== undefined ? unitPrice : existingResource.unitPrice;
        totalCost = newQuantity * newUnitPrice;
      }
    }

    const resource = await prisma.resource.update({
      where: { id },
      data: {
        name,
        code,
        unit,
        quantity,
        unitPrice,
        totalCost,
        resourceType,
        ifcElements,
        ifcProperties,
        description,
        orderIndex,
      },
    });

    res.json(resource);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/resources/:id - Удалить ресурс
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.resource.delete({
      where: { id },
    });

    res.json({ message: 'Resource deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/resources/:id/link-ifc - Привязать элементы IFC
router.post('/:id/link-ifc', async (req, res) => {
  try {
    const { id } = req.params;
    const { ifcElements, ifcProperties } = req.body;

    const resource = await prisma.resource.update({
      where: { id },
      data: {
        ifcElements: ifcElements ? JSON.stringify(ifcElements) : undefined,
        ifcProperties: ifcProperties ? JSON.stringify(ifcProperties) : undefined,
      },
    });

    res.json(resource);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
