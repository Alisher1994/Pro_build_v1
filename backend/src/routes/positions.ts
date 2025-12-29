import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const list = await prisma.position.findMany({
            include: { department: true },
            orderBy: { name: 'asc' }
        });
        res.json(list.map((item: any) => ({
            ...item,
            privileges: typeof item.privileges === 'string' ? JSON.parse(item.privileges) : item.privileges
        })));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, privileges, isHead, departmentId } = req.body;
        if (!name) return res.status(400).json({ error: 'Название обязательно' });

        const created = await prisma.position.create({
            data: {
                name,
                isHead: Boolean(isHead),
                departmentId: departmentId || null,
                privileges: typeof privileges === 'string' ? privileges : JSON.stringify(privileges || { read: true, edit: false, windows: [] })
            }
        });
        res.status(201).json(created);
    } catch (error: any) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Должность уже существует' });
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, privileges, isHead, departmentId } = req.body;
        const data: any = {};
        if (name) data.name = name;
        if (privileges) data.privileges = typeof privileges === 'string' ? privileges : JSON.stringify(privileges);
        if (isHead !== undefined) data.isHead = Boolean(isHead);
        if (departmentId !== undefined) data.departmentId = departmentId || null;

        const updated = await prisma.position.update({
            where: { id },
            data,
            include: { department: true }
        });
        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pos = await prisma.position.findUnique({ where: { id } });
        if (!pos) return res.status(404).json({ error: 'Должность не найдена' });
        if (pos.isSystem) return res.status(400).json({ error: 'Эта должность является системной и её нельзя удалить' });

        await prisma.position.delete({ where: { id } });
        res.json({ message: 'Deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
