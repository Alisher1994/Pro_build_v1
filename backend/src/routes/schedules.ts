import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// ========================================
// ГРАФИКИ (Schedule)
// ========================================

// GET /api/schedules - Получить все графики
router.get('/', async (req, res) => {
  try {
    const { projectId, limit, offset } = req.query;
    const take = limit ? Math.min(Math.max(Number(limit), 1), 200) : undefined;
    const skip = offset ? Math.max(Number(offset), 0) : 0;
    const where = projectId ? { projectId: String(projectId) } : undefined;
    
    const [total, schedules] = await Promise.all([
      prisma.schedule.count({ where }),
      prisma.schedule.findMany({
        where,
        include: {
          project: true,
          _count: {
            select: { tasks: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip
      })
    ]);
    res.json({ data: schedules, total, limit: take ?? null, offset: skip });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/schedules/:id - Получить график по ID с задачами
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        project: true,
        tasks: {
          orderBy: [
            { floor: 'asc' },
            { orderIndex: 'asc' }
          ]
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
    const { projectId, blockId, name, description, startDate, endDate, status } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({
        error: 'projectId and name are required',
      });
    }

    const schedule = await prisma.schedule.create({
      data: {
        projectId,
        blockId: blockId || null,
        name,
        description,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'draft',
      },
      include: { project: true, tasks: true },
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
    const { name, description, blockId, startDate, endDate, status } = req.body;

    const schedule = await prisma.schedule.update({
      where: { id },
      data: {
        name,
        description,
        blockId,
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

// ========================================
// ЗАДАЧИ (ScheduleTask)
// ========================================

// GET /api/schedules/:id/tasks - Получить все задачи графика
router.get('/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, floor } = req.query;

    const where: any = { scheduleId: id };
    if (status) where.status = String(status);
    if (floor) where.floor = String(floor);

    const tasks = await prisma.scheduleTask.findMany({
      where,
      orderBy: [
        { floor: 'asc' },
        { orderIndex: 'asc' }
      ],
    });

    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/schedules/:id/tasks - Создать новую задачу
router.post('/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      stageId,
      stageName,
      floor,
      zone,
      unit,
      quantity,
      startDate,
      endDate,
      duration,
      status,
      predecessorIds,
      ifcElements,
      notes,
      orderIndex
    } = req.body;

    if (!stageName) {
      return res.status(400).json({
        error: 'stageName is required',
      });
    }

    // Вычисляем duration если есть обе даты
    let calculatedDuration = duration;
    if (startDate && endDate && !duration) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      calculatedDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    const task = await prisma.scheduleTask.create({
      data: {
        scheduleId: id,
        stageId: stageId || null,
        stageName,
        floor: floor || null,
        zone: zone || null,
        unit: unit || null,
        quantity: quantity || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        duration: calculatedDuration || null,
        status: status || 'not_started',
        predecessorIds: predecessorIds || null,
        ifcElements: ifcElements || null,
        notes: notes || null,
        orderIndex: orderIndex || 0
      }
    });

    res.status(201).json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/schedules/:scheduleId/tasks/:taskId - Обновить задачу
router.put('/:scheduleId/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      stageName,
      floor,
      zone,
      unit,
      quantity,
      startDate,
      endDate,
      duration,
      actualStart,
      actualEnd,
      actualQuantity,
      progress,
      status,
      predecessorIds,
      ifcElements,
      notes,
      orderIndex
    } = req.body;

    // Вычисляем duration если есть обе даты
    let calculatedDuration = duration;
    if (startDate && endDate && duration === undefined) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      calculatedDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    const task = await prisma.scheduleTask.update({
      where: { id: taskId },
      data: {
        stageName,
        floor,
        zone,
        unit,
        quantity,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        duration: calculatedDuration,
        actualStart: actualStart ? new Date(actualStart) : undefined,
        actualEnd: actualEnd ? new Date(actualEnd) : undefined,
        actualQuantity,
        progress,
        status,
        predecessorIds,
        ifcElements,
        notes,
        orderIndex
      }
    });

    res.json(task);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/schedules/:scheduleId/tasks/:taskId - Удалить задачу
router.delete('/:scheduleId/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    await prisma.scheduleTask.delete({
      where: { id: taskId },
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// МАССОВОЕ СОЗДАНИЕ ЗАДАЧ ИЗ СМЕТЫ
// ========================================

// POST /api/schedules/:id/import-from-estimate - Импорт из сметы
router.post('/:id/import-from-estimate', async (req, res) => {
  try {
    const { id } = req.params;
    const { estimateIds, floors } = req.body;

    if (!estimateIds || !Array.isArray(estimateIds) || estimateIds.length === 0) {
      return res.status(400).json({ error: 'estimateIds array is required' });
    }

    if (!floors || !Array.isArray(floors) || floors.length === 0) {
      return res.status(400).json({ error: 'floors array is required' });
    }

    // Получаем виды работ из смет
    const estimates = await prisma.estimate.findMany({
      where: {
        id: { in: estimateIds }
      },
      include: {
        sections: {
          include: {
            stages: true
          }
        }
      }
    });

    const tasks = [];
    let orderIndex = 0;

    // Создаём задачи: для каждого вида работ × каждый этаж
    for (const estimate of estimates) {
      for (const section of estimate.sections) {
        for (const stage of section.stages) {
          for (const floor of floors) {
            tasks.push({
              scheduleId: id,
              stageId: stage.id,
              stageName: `${section.name} - ${stage.name}`,
              floor: floor,
              unit: stage.unit,
              quantity: 0,
              orderIndex: orderIndex++,
              status: 'not_started'
            });
          }
        }
      }
    }

    // Массовое создание
    const createdTasks = await prisma.scheduleTask.createMany({
      data: tasks
    });

    res.status(201).json({
      message: `Created ${createdTasks.count} tasks`,
      count: createdTasks.count
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
