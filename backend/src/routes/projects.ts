import logger from '../utils/logger';
import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// Seed: Ensure "Главный офис" exists
const ensureBaseProject = async () => {
  try {
    const project = await prisma.project.findFirst({ where: { name: 'Главный офис' } });
    if (!project) {
      await prisma.project.create({
        data: {
          name: 'Главный офис',
          isDeletable: false,
          description: 'Центральный офис компании',
          status: 'active'
        }
      });
    }
  } catch (e) {
    logger.error('Failed to seed base project:', e);
  }
};
ensureBaseProject();

// ========================================
// GET /api/projects - Получить все проекты
// ========================================
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const take = limit ? Math.min(Math.max(Number(limit), 1), 200) : undefined;
    const skip = offset ? Math.max(Number(offset), 0) : 0;

    const [total, projects] = await Promise.all([
      prisma.project.count(),
      prisma.project.findMany({
        include: {
          _count: {
            select: {
              blocks: true,
              estimates: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      })
    ]);
    res.json({ data: projects, total, limit: take ?? null, offset: skip });
  } catch (error: any) {
    logger.error('Error fetching projects:', error);
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
    logger.error('Error updating project:', error);
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

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!project.isDeletable) return res.status(400).json({ error: 'Этот объект нельзя удалить' });

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

// ========================================
// GET /api/projects/:id/hierarchy - Оргструктура проекта
// ========================================
router.get('/:id/hierarchy', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const hierarchy: any[] = [];

    const totalStaff = await prisma.employee.count({ where: { projectId: id } });

    // 1. Root: The Project itself
    hierarchy.push({
      id: project.id,
      parentId: null,
      name: project.name,
      position: 'Объект',
      image: project.photo || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=200&fit=crop',
      type: 'project',
      staffCount: totalStaff
    });

    // 2. Identify RP (Project Manager) and ZRP (Deputy)
    const rp = await prisma.employee.findFirst({
      where: { projectId: id, position: { name: 'РП (Руководитель проекта)' } },
      include: { position: true }
    });

    const zrp = await prisma.employee.findFirst({
      where: { projectId: id, position: { name: 'ЗРП (Зам. руководителя проекта)' } },
      include: { position: true }
    });

    // 3. Add RP to hierarchy
    if (rp) {
      hierarchy.push({
        id: rp.id,
        parentId: project.id,
        name: `${rp.lastName} ${rp.firstName}`,
        position: rp.position.name,
        image: rp.photo || `https://i.pravatar.cc/150?u=${rp.id}`,
        phone: rp.phone,
        email: rp.email,
        type: 'employee'
      });
    }

    // 4. Add ZRP to hierarchy (reports to RP if exists, otherwise to Project)
    if (zrp) {
      hierarchy.push({
        id: zrp.id,
        parentId: rp ? rp.id : project.id,
        name: `${zrp.lastName} ${zrp.firstName}`,
        position: zrp.position.name,
        image: zrp.photo || `https://i.pravatar.cc/150?u=${zrp.id}`,
        phone: zrp.phone,
        email: zrp.email,
        type: 'employee'
      });
    }

    // 5. Reporting root for departments
    const deptParentId = zrp ? zrp.id : (rp ? rp.id : project.id);

    // 6. Get all departments and their staff in this project
    const departments = await prisma.department.findMany();

    for (const dept of departments) {
      // Find all staff in this department for this project
      const staff = await prisma.employee.findMany({
        where: {
          projectId: id,
          departmentId: dept.id,
          // Exclude RP/ZRP as they are already handled
          NOT: {
            position: {
              name: { in: ['РП (Руководитель проекта)', 'ЗРП (Зам. руководителя проекта)'] }
            }
          }
        },
        include: { position: true }
      });

      if (staff.length === 0) continue;

      // Find head of department
      const head = staff.find(s => s.isHead);
      const remainingStaff = staff.filter(s => !s.isHead);

      const deptNodeId = `dept_${dept.id}`;

      // Add Department Node (Represented by the Head if exists, otherwise generic)
      if (head) {
        hierarchy.push({
          id: deptNodeId,
          parentId: deptParentId,
          name: dept.name,
          position: 'Отдел',
          headName: `${head.lastName} ${head.firstName}`,
          headPosition: head.position.name,
          phone: head.phone,
          image: head.photo || `https://i.pravatar.cc/150?u=${head.id}`,
          type: 'dept',
          staffCount: staff.length
        });
      } else {
        hierarchy.push({
          id: deptNodeId,
          parentId: deptParentId,
          name: dept.name,
          position: 'Отдел (Без руководителя)',
          headName: dept.name,
          headPosition: 'Общий состав',
          image: 'https://cdn-icons-png.flaticon.com/512/25/25400.png', // Generic group icon
          type: 'dept',
          staffCount: staff.length
        });
      }

      // Add remaining staff reporting to the department node
      for (const s of remainingStaff) {
        hierarchy.push({
          id: s.id,
          parentId: deptNodeId,
          name: `${s.lastName} ${s.firstName}`,
          position: s.position.name,
          image: s.photo || `https://i.pravatar.cc/150?u=${s.id}`,
          phone: s.phone,
          email: s.email,
          type: 'employee'
        });
      }
    }

    res.json(hierarchy);
  } catch (error: any) {
    logger.error('Hierarchy error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

