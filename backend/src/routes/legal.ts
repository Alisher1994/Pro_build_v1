import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

const router = Router();

// GET /api/legal?projectId=X
router.get('/', async (req: Request, res: Response) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const templates = await prisma.legalTemplate.findMany({
            where: { projectId: projectId as string },
            orderBy: { createdAt: 'desc' }
        });

        res.json(templates);
    } catch (error) {
        logger.error('Error fetching legal templates:', error);
        res.status(500).json({ error: 'Failed to fetch legal templates' });
    }
});

// POST /api/legal
router.post('/', async (req: Request, res: Response) => {
    try {
        const {
            projectId,
            name,
            city,
            docType,
            partyA,
            partyB,
            sections
        } = req.body;

        if (!projectId || !name || !sections) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const template = await prisma.legalTemplate.create({
            data: {
                projectId,
                name,
                city,
                docType: docType || 'contract_nk',
                partyAName: partyA?.name,
                partyAinn: partyA?.inn,
                partyAmfo: partyA?.mfo,
                partyAbank: partyA?.bank,
                partyBName: partyB?.name,
                partyBinn: partyB?.inn,
                partyBmfo: partyB?.mfo,
                partyBbank: partyB?.bank,
                sections: JSON.stringify(sections),
                status: 'draft'
            }
        });

        res.status(201).json(template);
    } catch (error) {
        logger.error('Error creating legal template:', error);
        res.status(500).json({ error: 'Failed to create legal template' });
    }
});

// PUT /api/legal/:id
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            name,
            city,
            docType,
            partyA,
            partyB,
            sections,
            status
        } = req.body;

        const template = await prisma.legalTemplate.update({
            where: { id },
            data: {
                name,
                city,
                docType,
                partyAName: partyA?.name,
                partyAinn: partyA?.inn,
                partyAmfo: partyA?.mfo,
                partyAbank: partyA?.bank,
                partyBName: partyB?.name,
                partyBinn: partyB?.inn,
                partyBmfo: partyB?.mfo,
                partyBbank: partyB?.bank,
                sections: sections ? JSON.stringify(sections) : undefined,
                status
            }
        });

        res.json(template);
    } catch (error) {
        logger.error('Error updating legal template:', error);
        res.status(500).json({ error: 'Failed to update legal template' });
    }
});

// GET /api/legal/:id
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const template = await prisma.legalTemplate.findUnique({
            where: { id }
        });
        if (!template) return res.status(404).json({ error: 'Template not found' });
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/legal/:id
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.legalTemplate.delete({
            where: { id }
        });
        res.json({ message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

export default router;
