import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

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
    console.error('Failed to seed base project:', e);
  }
};
ensureBaseProject();

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

    // 1. Root: The Project itself
    const hierarchy: any[] = [{
      id: project.id,
      parentId: null,
      name: project.name,
      position: 'Объект',
      image: project.photo || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=200&fit=crop',
      type: 'project'
    }];

    // 2. Project Manager (RP)
    const rp = await prisma.employee.findFirst({
      where: { projectId: id, position: { name: 'РП (Руководитель проекта)' } },
      include: { position: true }
    });

    if (rp) {
      hierarchy.push({
        id: rp.id,
        parentId: project.id,
        name: `${rp.lastName} ${rp.firstName}`,
        position: rp.position.name,
        image: rp.photo || `https://i.pravatar.cc/150?u=${rp.id}`,
        phone: rp.phone,
        email: rp.email
      });
    }

    const rpParentId = rp ? rp.id : project.id;

    // 3. Deputy Manager (ZRP)
    const zrp = await prisma.employee.findFirst({
      where: { projectId: id, position: { name: 'ЗРП (Зам. руководителя проекта)' } },
      include: { position: true }
    });

    if (zrp) {
      hierarchy.push({
        id: zrp.id,
        parentId: rpParentId,
        name: `${zrp.lastName} ${zrp.firstName}`,
        position: zrp.position.name,
        image: zrp.photo || `https://i.pravatar.cc/150?u=${zrp.id}`,
        phone: zrp.phone,
        email: zrp.email
      });
    }

    const zrpParentId = zrp ? zrp.id : rpParentId;

    // 4. Departments and their heads
    const departments = await prisma.department.findMany();
    for (const dept of departments) {
      // Find head of this department in this project
      const head = await prisma.employee.findFirst({
        where: {
          projectId: id,
          departmentId: dept.id,
          isHead: true,
          NOT: {
            position: {
              name: { in: ['РП (Руководитель проекта)', 'ЗРП (Зам. руководителя проекта)'] }
            }
          }
        },
        include: { position: true }
      });

      if (head) {
        const deptNodeId = `dept_${dept.id}`;
        hierarchy.push({
          id: deptNodeId,
          parentId: zrpParentId,
          name: dept.name,
          position: 'Отдел',
          headName: `${head.lastName} ${head.firstName}`,
          headPosition: head.position.name,
          phone: head.phone,
          image: head.photo || `https://i.pravatar.cc/150?u=${head.id}`,
          type: 'dept'
        });

        // 5. Staff in this department
        const staff = await prisma.employee.findMany({
          where: {
            projectId: id,
            departmentId: dept.id,
            isHead: false
          },
          include: { position: true }
        });

        for (const s of staff) {
          hierarchy.push({
            id: s.id,
            parentId: deptNodeId,
            name: `${s.lastName} ${s.firstName}`,
            position: s.position.name,
            image: s.photo || `https://i.pravatar.cc/150?u=${s.id}`,
            phone: s.phone,
            email: s.email
          });
        }
      }
    }

    res.json(hierarchy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
