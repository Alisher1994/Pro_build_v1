import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/finances - Получить все финансовые операции
router.get('/', async (req, res) => {
  try {
    const { projectId, type, category, startDate, endDate } = req.query;
    
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    if (type) where.type = String(type);
    if (category) where.category = String(category);
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) where.date.lte = new Date(String(endDate));
    }

    const finances = await prisma.finance.findMany({
      where,
      include: {
        project: true,
      },
      orderBy: { date: 'desc' },
    });

    res.json(finances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finances/:id - Получить финансовую операцию по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const finance = await prisma.finance.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!finance) {
      return res.status(404).json({ error: 'Finance record not found' });
    }

    res.json(finance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/finances - Создать новую финансовую операцию
router.post('/', async (req, res) => {
  try {
    const { projectId, type, category, amount, date, description, reference } = req.body;

    if (!projectId || !type || !category || amount === undefined || !date) {
      return res.status(400).json({
        error: 'projectId, type, category, amount and date are required',
      });
    }

    const finance = await prisma.finance.create({
      data: {
        projectId,
        type,
        category,
        amount,
        date: new Date(date),
        description,
        reference,
      },
      include: { project: true },
    });

    res.status(201).json(finance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/finances/:id - Обновить финансовую операцию
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, category, amount, date, description, reference } = req.body;

    const finance = await prisma.finance.update({
      where: { id },
      data: {
        type,
        category,
        amount,
        date: date ? new Date(date) : undefined,
        description,
        reference,
      },
    });

    res.json(finance);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Finance record not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/finances/:id - Удалить финансовую операцию
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.finance.delete({
      where: { id },
    });

    res.json({ message: 'Finance record deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Finance record not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/finances/project/:projectId/summary - Получить сводку по финансам проекта
router.get('/project/:projectId/summary', async (req, res) => {
  try {
    const { projectId } = req.params;

    const finances = await prisma.finance.findMany({
      where: { projectId },
    });

    const income = finances
      .filter((f) => f.type === 'income')
      .reduce((sum, f) => sum + f.amount, 0);

    const expense = finances
      .filter((f) => f.type === 'expense')
      .reduce((sum, f) => sum + f.amount, 0);

    const byCategory = finances.reduce((acc: any, f) => {
      if (!acc[f.category]) {
        acc[f.category] = { income: 0, expense: 0 };
      }
      if (f.type === 'income') {
        acc[f.category].income += f.amount;
      } else {
        acc[f.category].expense += f.amount;
      }
      return acc;
    }, {});

    res.json({
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense,
      byCategory,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
