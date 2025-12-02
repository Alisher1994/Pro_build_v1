import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ========================================
// GET /api/projects - Получить все проекты
// ========================================
router.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: {
            blocks: true,
            estimates: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// GET /api/projects/:id - Получить проект по ID
// ========================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        blocks: {
          include: {
            estimates: true,
          },
        },
        estimates: {
          include: {
            sections: true,
          },
        },
        schedules: true,
        supplies: true,
        finances: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// POST /api/projects - Создать новый проект
// ========================================
router.post('/', async (req, res) => {
  try {
    const { name, description, address, client, currency, startDate, endDate, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        address,
        client,
        currency: currency || 'RUB',
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status: status || 'planning',
      },
    });

    res.status(201).json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PUT /api/projects/:id - Обновить проект
// ========================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, address, client, currency, startDate, endDate, status } = req.body;

    const project = await prisma.project.update({
      where: { id },
      data: {
        name,
        description,
        address,
        client,
        currency,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status,
      },
    });

    res.json(project);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// DELETE /api/projects/:id - Удалить проект
// ========================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.project.delete({
      where: { id },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// GET /api/projects/:id/stats - Статистика проекта
// ========================================
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const [project, estimates, finances] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              blocks: true,
              estimates: true,
              schedules: true,
            },
          },
        },
      }),
      prisma.estimate.findMany({
        where: { projectId: id },
        select: { totalCost: true },
      }),
      prisma.finance.findMany({
        where: { projectId: id },
      }),
    ]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const totalEstimateCost = estimates.reduce((sum, e) => sum + e.totalCost, 0);
    const totalIncome = finances
      .filter((f) => f.type === 'income')
      .reduce((sum, f) => sum + f.amount, 0);
    const totalExpense = finances
      .filter((f) => f.type === 'expense')
      .reduce((sum, f) => sum + f.amount, 0);

    res.json({
      project,
      totalEstimateCost,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
