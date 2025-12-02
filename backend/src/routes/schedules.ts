import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/schedules - Получить все графики
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    
    const schedules = await prisma.schedule.findMany({
      where: projectId ? { projectId: String(projectId) } : undefined,
      include: {
        project: true,
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(schedules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/schedules/:id - Получить график по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        project: true,
        items: {
          include: {
            resource: {
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
            },
          },
          orderBy: { plannedStart: 'asc' },
        },
      },
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/schedules - Создать новый график
router.post('/', async (req, res) => {
  try {
    const { projectId, name, description, startDate, endDate, status } = req.body;

    if (!projectId || !name || !startDate || !endDate) {
      return res.status(400).json({
        error: 'projectId, name, startDate and endDate are required',
      });
    }

    const schedule = await prisma.schedule.create({
      data: {
        projectId,
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || 'draft',
      },
      include: { project: true },
    });

    res.status(201).json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/schedules/:id - Обновить график
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate, status } = req.body;

    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        name,
        description,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status,
      },
    });

    res.json(schedule);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/schedules/:id - Удалить график
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.schedule.delete({
      where: { id },
    });

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/schedules/:id/items - Получить все позиции графика
router.get('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, floor } = req.query;

    const where: any = { scheduleId: id };
    if (status) where.status = String(status);
    if (floor) where.floor = parseInt(String(floor));

    const items = await prisma.scheduleItem.findMany({
      where,
      include: {
        resource: true,
      },
      orderBy: { plannedStart: 'asc' },
    });

    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/schedules/:id/items - Добавить позицию в график
router.post('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      resourceId,
      floor,
      zone,
      plannedStart,
      plannedEnd,
      plannedQuantity,
      actualStart,
      actualEnd,
      actualQuantity,
      progress,
      status,
      notes,
    } = req.body;

    if (!resourceId || !plannedStart || !plannedEnd || plannedQuantity === undefined) {
      return res.status(400).json({
        error: 'resourceId, plannedStart, plannedEnd and plannedQuantity are required',
      });
    }

    const item = await prisma.scheduleItem.create({
      data: {
        scheduleId: id,
        resourceId,
        floor,
        zone,
        plannedStart: new Date(plannedStart),
        plannedEnd: new Date(plannedEnd),
        plannedQuantity,
        actualStart: actualStart ? new Date(actualStart) : undefined,
        actualEnd: actualEnd ? new Date(actualEnd) : undefined,
        actualQuantity: actualQuantity || 0,
        progress: progress || 0,
        status: status || 'not_started',
        notes,
      },
      include: { resource: true },
    });

    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/schedules/:scheduleId/items/:itemId - Обновить позицию графика
router.put('/:scheduleId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const {
      floor,
      zone,
      plannedStart,
      plannedEnd,
      plannedQuantity,
      actualStart,
      actualEnd,
      actualQuantity,
      progress,
      status,
      notes,
    } = req.body;

    const item = await prisma.scheduleItem.update({
      where: { id: itemId },
      data: {
        floor,
        zone,
        plannedStart: plannedStart ? new Date(plannedStart) : undefined,
        plannedEnd: plannedEnd ? new Date(plannedEnd) : undefined,
        plannedQuantity,
        actualStart: actualStart ? new Date(actualStart) : undefined,
        actualEnd: actualEnd ? new Date(actualEnd) : undefined,
        actualQuantity,
        progress,
        status,
        notes,
      },
    });

    res.json(item);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/schedules/:scheduleId/items/:itemId - Удалить позицию графика
router.delete('/:scheduleId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    await prisma.scheduleItem.delete({
      where: { id: itemId },
    });

    res.json({ message: 'Schedule item deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
