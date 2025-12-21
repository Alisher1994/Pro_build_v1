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
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message, details: error.stack });
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
    const { name, description, address, latitude, longitude, photo, genplan, render, client, manager, deputy, customer, contractor, currency, startDate, endDate, status, coordinates } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Извлекаем координаты из объекта coordinates или напрямую
    const lat = coordinates?.latitude || latitude;
    const lng = coordinates?.longitude || longitude;

    const project = await prisma.project.create({
      data: {
        name,
        description: description || undefined,
        address: address || undefined,
        latitude: lat ? parseFloat(lat) : undefined,
        longitude: lng ? parseFloat(lng) : undefined,
        photo: (photo || genplan) || undefined, // Для обратной совместимости
        genplan: (genplan && genplan.trim()) || undefined,
        render: (render && render.trim()) || undefined,
        client: client || undefined,
        manager: manager || undefined,
        deputy: deputy || undefined,
        customer: customer || undefined,
        contractor: contractor || undefined,
        currency: currency || 'RUB',
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status: status || 'active',
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
    const { name, description, address, latitude, longitude, photo, genplan, render, client, manager, deputy, customer, contractor, currency, startDate, endDate, status, coordinates } = req.body;

    // Извлекаем координаты из объекта coordinates или напрямую
    const lat = coordinates?.latitude ?? latitude;
    const lng = coordinates?.longitude ?? longitude;

    // Строим объект данных только с определенными полями
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (address !== undefined) updateData.address = address;
    if (lat !== undefined && lat !== null) updateData.latitude = parseFloat(lat.toString());
    if (lng !== undefined && lng !== null) updateData.longitude = parseFloat(lng.toString());
    if (photo !== undefined) updateData.photo = photo;
    if (genplan !== undefined) updateData.genplan = genplan;
    if (render !== undefined) updateData.render = render;
    if (client !== undefined) updateData.client = client;
    if (manager !== undefined) updateData.manager = manager;
    if (deputy !== undefined) updateData.deputy = deputy;
    if (customer !== undefined) updateData.customer = customer;
    if (contractor !== undefined) updateData.contractor = contractor;
    if (currency !== undefined) updateData.currency = currency;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (status !== undefined) updateData.status = status;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    res.json(project);
  } catch (error: any) {
    console.error('Error updating project:', error);
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
