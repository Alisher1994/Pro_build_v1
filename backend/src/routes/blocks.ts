import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/blocks - Получить все блоки
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    const blocks = await prisma.block.findMany({
      where: projectId ? { projectId: String(projectId) } : undefined,
      include: {
        project: true,
        _count: {
          select: { estimates: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });
    res.json(blocks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/blocks/:id - Получить блок по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const block = await prisma.block.findUnique({
      where: { id },
      include: {
        project: true,
        estimates: {
          include: {
            sections: true,
          },
        },
      },
    });

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json(block);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/blocks - Создать новый блок
router.post('/', async (req, res) => {
  try {
    const { projectId, name, description, floors, undergroundFloors, area, orderIndex, constructionPhase } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'projectId and name are required' });
    }

    const block = await prisma.block.create({
      data: {
        projectId,
        name,
        description,
        floors: floors || 1,
        undergroundFloors: undergroundFloors || 0,
        area,
        orderIndex: orderIndex || 0,
        constructionPhase: constructionPhase || 1,
      },
      include: { project: true },
    });

    res.status(201).json(block);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/blocks/:id - Обновить блок
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, floors, undergroundFloors, area, orderIndex, constructionPhase } = req.body;

    const block = await prisma.block.update({
      where: { id },
      data: {
        name,
        description,
        floors,
        undergroundFloors,
        area,
        orderIndex,
        constructionPhase,
      },
    });

    res.json(block);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Block not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/blocks/:id - Удалить блок
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.block.delete({
      where: { id },
    });

    res.json({ message: 'Block deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Block not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
