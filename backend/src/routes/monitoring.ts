import { Router } from 'express';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

const router = Router();

// GET /api/monitoring/:projectId
router.get('/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;

        // 1. Get all GanttTask for project (only work types)
        const tasks = await prisma.ganttTask.findMany({
            where: {
                projectId,
                id: { startsWith: 'worktype-' }
            },
            select: {
                id: true,
                progress: true,
                text: true,
                parent: true,
                blockId: true
            }
        });

        // 2. Get all WorkTypes with their Resources (which contain ifcElements)
        // We need this to know which GUIDs belong to which work type
        const workTypes = await prisma.workType.findMany({
            where: {
                stage: {
                    section: {
                        estimate: {
                            projectId
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                ifcElements: true, // WorkType level (legacy)
                resources: {       // Resources have the actual IFC elements
                    select: {
                        ifcElements: true
                    }
                }
            }
        });

        // 3. Get all estimates for this project to find XKT URLs
        const estimates = await prisma.estimate.findMany({
            where: { projectId },
            select: { id: true, name: true, xktFileUrl: true, blockId: true }
        });

        res.json({
            tasks: tasks.map(t => ({
                id: t.id,
                progress: t.progress,
                text: t.text,
                parent: t.parent,
                blockId: t.blockId
            })),
            workTypes: workTypes.map(wt => {
                // Aggregate IFC elements from WorkType itself AND all its Resources
                const workTypeElements = wt.ifcElements ? JSON.parse(wt.ifcElements) : [];
                const resourceElements = wt.resources.flatMap((r: any) =>
                    r.ifcElements ? JSON.parse(r.ifcElements) : []
                );
                // Combine and deduplicate
                const allElements = [...new Set([...workTypeElements, ...resourceElements])];

                return {
                    id: wt.id,
                    name: wt.name,
                    ifcElements: allElements
                };
            }),
            estimates: estimates.filter(e => e.xktFileUrl).map(e => ({
                id: e.id,
                name: e.name,
                xktUrl: e.xktFileUrl,
                blockId: e.blockId
            }))
        });
    } catch (error: any) {
        logger.error('Error in monitoring data:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
