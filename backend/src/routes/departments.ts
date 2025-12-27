import logger from '../utils/logger';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Seed: Ensure "Главный офис" exists
const ensureBaseDept = async () => {
    try {
        const dept = await prisma.department.findUnique({ where: { name: 'Главный офис' } });
        if (!dept) {
            await prisma.department.create({
                data: { name: 'Главный офис', isSystem: true }
            });
        }
    } catch (e) {
        logger.error('Failed to seed base department:', e);
    }
};
ensureBaseDept();

router.get('/', async (req, res) => {
    try {
        const list = await prisma.department.findMany({ orderBy: { createdAt: 'asc' } });
        res.json(list);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Название обязательно' });
        const created = await prisma.department.create({ data: { name } });
        res.status(201).json(created);
    } catch (error: any) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Отдел уже существует' });
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const updated = await prisma.department.update({ where: { id }, data: { name } });
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const dept = await prisma.department.findUnique({ where: { id } });
        if (!dept) return res.status(404).json({ error: 'Отдел не найден' });
        if (dept.isSystem) return res.status(400).json({ error: 'Этот отдел является системным и его нельзя удалить' });

        await prisma.department.delete({ where: { id } });
        res.json({ message: 'Deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

