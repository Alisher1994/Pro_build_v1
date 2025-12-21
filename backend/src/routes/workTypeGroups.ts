import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ========================================
// ГРУППЫ РАБОТ (WorkTypeGroup)
// ========================================

// GET /api/work-type-groups - Получить все группы работ
router.get('/', async (req, res) => {
  try {
    const groups = await prisma.workTypeGroup.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        workTypeItems: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    res.json(groups);
  } catch (error: any) {
    console.error('Error fetching work type groups:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/work-type-groups/:id - Получить группу по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const group = await prisma.workTypeGroup.findUnique({
      where: { id },
      include: {
        workTypeItems: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    
    if (!group) {
      return res.status(404).json({ error: 'Группа работ не найдена' });
    }
    
    res.json(group);
  } catch (error: any) {
    console.error('Error fetching work type group:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/work-type-groups - Создать новую группу работ
router.post('/', async (req, res) => {
  try {
    const { name, orderIndex } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Название группы обязательно' });
    }
    
    const group = await prisma.workTypeGroup.create({
      data: {
        name,
        orderIndex: orderIndex ?? 0
      }
    });
    
    res.status(201).json(group);
  } catch (error: any) {
    console.error('Error creating work type group:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/work-type-groups/:id - Обновить группу работ
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, orderIndex } = req.body;
    
    const group = await prisma.workTypeGroup.update({
      where: { id },
      data: {
        name,
        orderIndex
      }
    });
    
    res.json(group);
  } catch (error: any) {
    console.error('Error updating work type group:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/work-type-groups/:id - Удалить группу работ
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем, есть ли виды работ в группе
    const itemsCount = await prisma.workTypeItem.count({
      where: { groupId: id }
    });
    
    if (itemsCount > 0) {
      return res.status(400).json({ 
        error: 'Невозможно удалить группу, содержащую виды работ' 
      });
    }
    
    await prisma.workTypeGroup.delete({
      where: { id }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting work type group:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ВИДЫ РАБОТ (WorkTypeItem)
// ========================================

// GET /api/work-type-groups/:groupId/items - Получить виды работ группы
router.get('/:groupId/items', async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const items = await prisma.workTypeItem.findMany({
      where: { groupId },
      orderBy: { orderIndex: 'asc' }
    });
    
    res.json(items);
  } catch (error: any) {
    console.error('Error fetching work type items:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/work-type-groups/:groupId/items - Создать вид работ
router.post('/:groupId/items', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, unit, orderIndex } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Наименование вида работ обязательно' });
    }
    
    if (!unit) {
      return res.status(400).json({ error: 'Единица измерения обязательна' });
    }
    
    const item = await prisma.workTypeItem.create({
      data: {
        groupId,
        name,
        unit,
        orderIndex: orderIndex ?? 0
      }
    });
    
    res.status(201).json(item);
  } catch (error: any) {
    console.error('Error creating work type item:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/work-type-groups/:groupId/items/:itemId - Обновить вид работ
router.put('/:groupId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, unit, orderIndex } = req.body;
    
    const item = await prisma.workTypeItem.update({
      where: { id: itemId },
      data: {
        name,
        unit,
        orderIndex
      }
    });
    
    res.json(item);
  } catch (error: any) {
    console.error('Error updating work type item:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/work-type-groups/:groupId/items/:itemId - Удалить вид работ
router.delete('/:groupId/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Проверяем, есть ли связи с инструкциями
    const instructionsCount = await prisma.instructionWorkType.count({
      where: { workTypeItemId: itemId }
    });
    
    if (instructionsCount > 0) {
      return res.status(400).json({ 
        error: 'Невозможно удалить вид работ, используемый в инструкциях' 
      });
    }
    
    await prisma.workTypeItem.delete({
      where: { id: itemId }
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting work type item:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
