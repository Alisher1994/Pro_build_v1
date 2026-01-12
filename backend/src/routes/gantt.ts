import logger from '../utils/logger';
import { Router } from 'express';
import prisma from '../utils/prisma';
import fs from 'fs';
import path from 'path';

const router = Router();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY);

const calcDurationDays = (start: Date, end: Date) => {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
};


// Roll up parent task dates in DB (used after updates).
const rollupAncestors = async (projectId: string, startId: string | null) => {
  const visited = new Set<string>();
  let currentId: string | null = startId;

  while (currentId && currentId !== '0' && !visited.has(currentId)) {
    visited.add(currentId);

    const children = await prisma.ganttTask.findMany({
      where: { projectId, parent: currentId },
      select: { start_date: true, duration: true, progress: true, quantity: true, completedQuantity: true },
    });

    if (children.length > 0) {
      let minStart: Date | null = null;
      let maxEnd: Date | null = null;
      let totalDuration = 0;
      let weightedProgress = 0;
      let totalQty = 0;
      let totalCompletedQty = 0;

      for (const c of children) {
        if (!c.start_date || Number.isNaN(c.start_date.getTime())) continue;
        const start = c.start_date;
        const dur = Number(c.duration || 0);
        const end = addDays(start, dur);

        if (!minStart || start < minStart) minStart = start;
        if (!maxEnd || end > maxEnd) maxEnd = end;

        totalDuration += dur;
        weightedProgress += (c.progress || 0) * dur;
        totalQty += Number(c.quantity || 0);
        totalCompletedQty += Number(c.completedQuantity || 0);
      }

      if (minStart && maxEnd) {
        const duration = calcDurationDays(minStart, maxEnd);
        const avgProgress = totalDuration > 0 ? (weightedProgress / totalDuration) : 0;

        await prisma.ganttTask.update({
          where: { id: currentId },
          data: {
            start_date: minStart,
            duration,
            progress: avgProgress,
            quantity: totalQty,
            completedQuantity: totalCompletedQty
          },
        });
      }
    }

    const parent = await prisma.ganttTask.findUnique({
      where: { id: currentId },
      select: { parent: true },
    });

    currentId = parent?.parent ?? null;
  }
};

const extractWorkTypeIdFromTaskId = (taskId: string): string | null => {
  const id = String(taskId || '');
  if (!id.startsWith('worktype-')) return null;

  // id format: worktype-<workTypeId>-<floorTaskId>, where floorTaskId starts with "floor-"
  const rest = id.slice('worktype-'.length);
  const idx = rest.indexOf('-floor-');
  if (idx > 0) return rest.slice(0, idx);

  // Fallback for unexpected formats: take UUID-like prefix
  if (rest.length >= 36) return rest.slice(0, 36);
  return null;
};


// ========================================
// ГЕНЕРАЦИЯ ГРАФИКА (Gantt)
// ========================================


// ========================================
// ПРИВЯЗКА ВИДА РАБОТ К ЭТАЖУ (без дублирования)
// ========================================

// GET /api/gantt/estimate-tree/:blockId
// Возвращает иерархию сметы для выбора: Раздел -> Этап -> Виды работ
router.get('/estimate-tree/:blockId', async (req, res) => {
  try {
    const { blockId } = req.params;

    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        estimates: {
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: {
                stages: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    workTypes: {
                      orderBy: { orderIndex: 'asc' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json({
      blockId: block.id,
      blockName: block.name,
      estimates: block.estimates.map(e => ({
        id: e.id,
        name: e.name,
        // Плоский список этапов для UI: "Смета" -> "Этап" -> "Вид работ"
        stages: e.sections.flatMap(s =>
          s.stages.map(st => ({
            id: st.id,
            name: st.name,
            workTypes: st.workTypes.map(wt => ({
              id: wt.id,
              name: wt.name,
              unit: wt.unit || '',
              quantity: wt.quantity || 0,
              totalCost: wt.totalCost || 0
            }))
          }))
        ),
        sections: e.sections.map(s => ({
          id: s.id,
          code: s.code,
          name: s.name,
          stages: s.stages.map(st => ({
            id: st.id,
            name: st.name,
            workTypes: st.workTypes.map(wt => ({
              id: wt.id,
              name: wt.name,
              unit: wt.unit || '',
              quantity: wt.quantity || 0,
              totalCost: wt.totalCost || 0
            }))
          }))
        }))
      }))
    });
  } catch (error: any) {
    logger.error('Error getting estimate tree:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gantt/assignment-sources/:projectId
// Источник данных для распределения: блоки проекта + их сметы
router.get('/assignment-sources/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const blocks = await prisma.block.findMany({
      where: { projectId },
      orderBy: { orderIndex: 'asc' },
      include: {
        estimates: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      projectId,
      blocks: blocks.map(b => ({
        id: b.id,
        name: b.name,
        floors: b.floors,
        undergroundFloors: b.undergroundFloors,
        constructionPhase: b.constructionPhase,
        estimates: b.estimates
      }))
    });
  } catch (error: any) {
    logger.error('Error getting assignment sources:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gantt/assignment-estimate/:projectId/:blockId/:estimateId
// Возвращает этапы и виды работ выбранной сметы + остатки (total - assigned)
router.get('/assignment-estimate/:projectId/:blockId/:estimateId', async (req, res) => {
  try {
    const { projectId, blockId, estimateId } = req.params;

    // Этажи текущего блока в ГПР
    const floorTasks = await prisma.ganttTask.findMany({
      where: {
        projectId,
        type: 'project',
        id: { startsWith: 'floor-' },
        blockId
      },
      select: { id: true }
    });
    const floorIds = new Set(floorTasks.map(t => t.id));

    // Уже назначенные объемы по видам работ (только внутри этажей текущего блока)
    const assignedByWorkTypeId: Record<string, number> = {};
    const assignedTasks = await prisma.ganttTask.findMany({
      where: {
        projectId,
        type: 'task',
        id: { startsWith: 'worktype-' }
      },
      select: { id: true, parent: true, quantity: true }
    });

    for (const t of assignedTasks) {
      if (!t.parent || !floorIds.has(t.parent)) continue;

      const workTypeId = extractWorkTypeIdFromTaskId(t.id);
      if (!workTypeId) continue;

      const q = Number(t.quantity || 0);
      assignedByWorkTypeId[workTypeId] = (assignedByWorkTypeId[workTypeId] || 0) + q;
    }


    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            stages: {
              orderBy: { orderIndex: 'asc' },
              include: {
                workTypes: { orderBy: { orderIndex: 'asc' } }
              }
            }
          }
        }
      }
    });

    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Плоский список этапов (как в UI сметы)
    const stages = estimate.sections.flatMap(s => s.stages);

    res.json({
      projectId,
      blockId,
      estimateId,
      estimateName: estimate.name,
      stages: stages.map(st => ({
        id: st.id,
        name: st.name,
        workTypes: st.workTypes.map(wt => {
          const totalQty = Number(wt.quantity || 0);
          const assignedQty = Number(assignedByWorkTypeId[wt.id] || 0);
          const remainingQty = Math.max(0, totalQty - assignedQty);
          return {
            id: wt.id,
            name: wt.name,
            code: wt.code || '',
            cipher: wt.cipher || '',
            unit: wt.unit || '',
            totalQty,
            assignedQty,
            remainingQty
          };
        })
      }))
    });
  } catch (error: any) {
    logger.error('Error getting assignment estimate:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gantt/assign-worktype
// Закрепляет вид работ за этажом и задаёт объем для этого этажа
router.post('/assign-worktype', async (req, res) => {
  try {
    const { projectId, floorTaskId, workTypeId, quantity, operation } = req.body as {
      projectId: string;
      floorTaskId: string;
      workTypeId: string;
      quantity: number;
      operation?: 'set' | 'add';
    };

    if (!projectId || !floorTaskId || !workTypeId) {
      return res.status(400).json({ error: 'projectId, floorTaskId, workTypeId are required' });
    }

    let floorTask = await prisma.ganttTask.findUnique({
      where: { id: floorTaskId },
      select: { id: true, projectId: true, type: true, blockId: true }
    });

    // Если этаж не найден, но ID соответствует формату floor-<blockId>-..., попробуем создать его
    if (!floorTask) {
      let blockId: string | null = null;
      let floorNum: string | null = null;
      let isMinus = false;

      if (floorTaskId.startsWith('floor-')) {
        // Проверяем на наличие "-minus-"
        const minusIndex = floorTaskId.indexOf('-minus-');
        if (minusIndex !== -1) {
          // floor-<blockId>-minus-<floorNum>
          blockId = floorTaskId.substring(6, minusIndex);
          floorNum = floorTaskId.substring(minusIndex + 7);
          isMinus = true;
        } else {
          // floor-<blockId>-<floorNum>
          // Ищем последний дефис
          const lastDashIndex = floorTaskId.lastIndexOf('-');
          if (lastDashIndex > 5) { // 5 because "floor-" is 0-5
            blockId = floorTaskId.substring(6, lastDashIndex);
            floorNum = floorTaskId.substring(lastDashIndex + 1);
          }
        }
      }

      if (blockId && floorNum) {
        const floorName = isMinus ? `Этаж -${floorNum}` : `Этаж ${floorNum}`;

        // Проверим, существует ли блок
        const block = await prisma.block.findUnique({ where: { id: blockId } });
        if (block && block.projectId === projectId) {
          // Создаем задачу этажа
          // Нам нужен parent (blockTaskId). Обычно это block-<blockId>
          const blockTaskId = `block-${blockId}`;

          // 1. Ensure Project Task Exists
          let projectTask = await prisma.ganttTask.findUnique({ where: { id: projectId } });
          if (!projectTask) {
            const project = await prisma.project.findUnique({ where: { id: projectId } });
            if (project) {
              try {
                await prisma.ganttTask.create({
                  data: {
                    id: projectId,
                    projectId,
                    text: project.name,
                    start_date: project.startDate || new Date(),
                    duration: 1,
                    progress: 0,
                    parent: null,
                    type: 'project',
                    sortOrder: 0
                  }
                });
              } catch (e) { /* Ignore */ }
            }
          }

          // 2. Ensure Phase Task Exists
          const phaseNum = block.constructionPhase || 1;
          const phaseTaskId = `phase-${projectId}-${phaseNum}`;
          let phaseTask = await prisma.ganttTask.findUnique({ where: { id: phaseTaskId } });
          if (!phaseTask) {
            try {
              await prisma.ganttTask.create({
                data: {
                  id: phaseTaskId,
                  projectId,
                  text: `Очередь: ${phaseNum}`,
                  start_date: new Date(),
                  duration: 1,
                  progress: 0,
                  parent: projectId,
                  type: 'project',
                  sortOrder: 0
                }
              });
            } catch (e) { /* Ignore */ }
          }

          // 3. Ensure Block Task Exists
          let blockTask = await prisma.ganttTask.findUnique({ where: { id: blockTaskId } });
          if (!blockTask) {
            try {
              blockTask = await prisma.ganttTask.create({
                data: {
                  id: blockTaskId,
                  projectId,
                  text: block.name,
                  start_date: new Date(),
                  duration: 1,
                  progress: 0,
                  parent: phaseTaskId,
                  type: 'project',
                  blockId: block.id,
                  sortOrder: 0
                }
              });
            } catch (e) {
              blockTask = await prisma.ganttTask.findUnique({ where: { id: blockTaskId } });
            }
          }

          try {
            floorTask = await prisma.ganttTask.create({
              data: {
                id: floorTaskId,
                projectId,
                text: floorName,
                start_date: new Date(),
                duration: 1,
                progress: 0,
                parent: blockTaskId,
                type: 'project',
                blockId: block.id,
                sortOrder: isMinus ? -Number(floorNum) : Number(floorNum)
              }
            });
          } catch (e) {
            floorTask = await prisma.ganttTask.findUnique({ where: { id: floorTaskId } });
          }
        }
      }
    }

    if (!floorTask || floorTask.projectId !== projectId) {
      return res.status(404).json({ error: 'Floor task not found and could not be created' });
    }

    const workType = await prisma.workType.findUnique({
      where: { id: workTypeId },
      include: {
        resources: {
          where: { resourceType: 'labor' },
          select: { normPerUnit: true }
        }
      }
    });

    if (!workType) {
      return res.status(404).json({ error: 'Work type not found' });
    }

    const qty = Number.isFinite(Number(quantity)) ? Number(quantity) : 0;

    // Инициализируем данные для профессионального планирования
    // Считаем сумму норм всех ресурсов типа "labor" (чел-ч)
    let laborNorm = 0;
    if (workType.resources && workType.resources.length > 0) {
      laborNorm = workType.resources.reduce((sum, r) => sum + (r.normPerUnit || 0), 0);
    }

    // Если ресурсов типа labor нет, откатываемся к общей норме вида работ или 1
    const norm = laborNorm > 0 ? laborNorm : (workType.normPerUnit || 1);

    // По умолчанию считаем, что работает 1 человек по 8 часов в день
    // Либо можно попробовать вытянуть текущую интенсивность из существующей задачи

    const op: 'set' | 'add' = operation === 'add' ? 'add' : 'set';
    const taskId = `worktype-${workType.id}-${floorTaskId}`;

    const existing = await (prisma.ganttTask as any).findUnique({
      where: { id: taskId },
      select: { id: true, quantity: true, resourceIntensity: true, durationType: true }
    });

    const finalQty = op === 'add' ? (Number(existing?.quantity || 0) + qty) : qty;
    const plannedWork = finalQty * norm;

    // Получаем настройки проекта (длительность смены)
    const project = await (prisma.project as any).findUnique({
      where: { id: projectId },
      select: { shiftDuration: true }
    });
    const defaultShift = project?.shiftDuration || 8;

    // Если задача уже существует, сохраняем её интенсивность, иначе ставим дефолт из настроек проекта
    const resourceIntensity = Number(existing?.resourceIntensity) || defaultShift;
    const durationType = existing?.durationType || 'fixed_duration';

    // Рассчитываем длительность: Duration = Work / Intensity
    // Минимум 1 день
    const duration = Math.max(1, Math.ceil(plannedWork / Math.max(0.1, resourceIntensity)));

    await (prisma.ganttTask as any).upsert({
      where: { id: taskId },
      create: {
        id: taskId,
        projectId,
        text: workType.name,
        start_date: new Date(),
        duration,
        progress: 0,
        parent: floorTaskId,
        type: 'task',
        quantity: finalQty,
        unit: workType.unit || '',
        plannedWork,
        resourceIntensity,
        shiftsPerDay: 1,
        resourceCount: 1,
        calculationMode: 'manual',
        durationType,
        blockId: floorTask.blockId,
        sortOrder: 999999
      },
      update: {
        text: workType.name,
        duration,
        quantity: finalQty,
        plannedWork,
        blockId: floorTask.blockId,
        resourceIntensity,
        unit: workType.unit || '',
        parent: floorTaskId
      }
    });

    // Пересчитываем родителей
    try {
      await rollupAncestors(projectId, floorTaskId);
    } catch (e) {
      logger.warn('rollupAncestors after assign-worktype failed:', e);
    }

    res.json({ status: 'ok', id: taskId });

  } catch (error: any) {
    logger.error('Error assigning work type:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gantt/:projectId
// Получить задачи для диаграммы
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const tasks = await prisma.ganttTask.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      include: {
        linksSource: true,
      }
    });

    logger.info(`Found ${tasks.length} tasks for project ${projectId}`);

    const workTypeIds = Array.from(
      new Set(
        tasks
          .map((t) => extractWorkTypeIdFromTaskId(t.id))
          .filter((v): v is string => Boolean(v))
      )
    );


    const normPerUnitByWorkTypeId = new Map<string, number>();
    if (workTypeIds.length > 0) {
      const workTypes = await prisma.workType.findMany({
        where: { id: { in: workTypeIds } },
        select: { id: true, normPerUnit: true }
      });
      for (const wt of workTypes) {
        const v = Number(wt.normPerUnit);
        normPerUnitByWorkTypeId.set(wt.id, Number.isFinite(v) ? v : 0);
      }
    }

    const links = await prisma.ganttLink.findMany({
      where: {
        sourceTask: { projectId }
      }
    });

    logger.info(`Found ${links.length} links for project ${projectId}`);

    // --- ПРИВЯЗКА ПОБЕДИТЕЛЕЙ ТЕНДЕРОВ К ЗАДАЧАМ ГРАФИКА ---
    // 1. Находим все выигрышные ставки для данного проекта
    const winningBids = await prisma.tenderBid.findMany({
      where: {
        tender: { projectId },
        status: { in: ['winner', 'contract'] }
      },
      include: {
        tender: true,
        subcontractor: {
          select: { company: true }
        }
      }
    });

    logger.info(`Found ${winningBids.length} winning bids for project ${projectId}`);

    logger.info(`Fetching project blocks for project ${projectId}`);
    const projectBlocks = await prisma.block.findMany({
      where: { projectId },
      select: { id: true, name: true }
    });
    logger.info(`Found ${projectBlocks.length} blocks for project ${projectId}`);

    const blockNameToId = new Map<string, string>();
    for (const b of projectBlocks) {
      blockNameToId.set(b.name.trim(), b.id);
    }

    // 2. Строим карту победителей: blockId -> workTypeId -> companyName
    const winnerMap: Record<string, Record<string, string>> = {};
    for (const bid of winningBids) {
      const company = bid.subcontractor.company;
      let rawBlockIds: string[] = [];
      let tenderItems: any[] = [];

      try {
        const parsedBlocks = JSON.parse(bid.tender.blockIds || '[]');
        rawBlockIds = Array.isArray(parsedBlocks) ? parsedBlocks : [String(parsedBlocks)];

        const parsedItems = JSON.parse(bid.tender.items || '[]');
        tenderItems = Array.isArray(parsedItems) ? parsedItems : [];
      } catch (e) {
        logger.warn(`Failed to parse tender data for bid ${bid.id}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      // Нормализуем ID блоков (если в базе имена - превращаем в ID)
      const normalizedBlockIds = rawBlockIds.map(idOrName => {
        const trimmed = String(idOrName).trim();
        return blockNameToId.get(trimmed) || idOrName;
      });

      for (const bId of normalizedBlockIds) {
        if (!winnerMap[bId]) winnerMap[bId] = {};
        for (const item of tenderItems) {
          const wtId = item.workTypeId || item.work_type_id;
          if (wtId) {
            winnerMap[bId][wtId] = company;
          }
        }
      }
    }

    logger.info(`WinnerMap built with ${Object.keys(winnerMap).length} blocks`);

    // Форматируем для DHTMLX Gantt
    // Map all tasks by ID for fast lookup during blockId resolution
    const taskMap = new Map<string, any>();
    for (const t of tasks) {
      taskMap.set(String(t.id), t);
    }

    const resolveBlockId = (task: any, visited = new Set<string>()): string => {
      if (!task) return '';
      if (task.blockId) return String(task.blockId);

      const taskId = String(task.id);
      if (visited.has(taskId)) {
        logger.warn(`Loop detected in task hierarchy at task ${taskId}`);
        return '';
      }
      visited.add(taskId);

      if (task.parent && task.parent !== '0' && task.parent !== projectId) {
        const parent = taskMap.get(String(task.parent));
        if (parent) return resolveBlockId(parent, visited);
      }
      return '';
    };

    logger.info(`Starting task mapping for ${tasks.length} tasks`);
    const data = tasks.map(t => {
      try {
        const wtId = extractWorkTypeIdFromTaskId(t.id);
        const bId = resolveBlockId(t);
        const subcontractor = (wtId && winnerMap[bId]) ? winnerMap[bId][wtId] : null;

        let startDateStr = '';
        if (t.start_date) {
          try {
            startDateStr = t.start_date.toISOString().replace('T', ' ').substring(0, 16);
          } catch (dateErr) {
            logger.warn(`Invalid start_date for task ${t.id}: ${t.start_date}`);
          }
        }

        return {
          id: String(t.id),
          text: t.text,
          start_date: startDateStr,
          duration: Math.max(1, Number(t.duration || 1)),
          progress: t.progress || 0,
          parent: t.parent ? String(t.parent) : 0,
          type: t.type || 'task',
          blockId: t.blockId,
          estimateSectionId: t.estimateSectionId,
          quantity: t.quantity,
          unit: t.unit,
          completedQuantity: t.completedQuantity,
          dailyPlan: t.dailyPlan,
          shiftsPerDay: t.shiftsPerDay,
          resourceCount: t.resourceCount,
          calculationMode: t.calculationMode,
          plannedWork: t.plannedWork,
          leadingResourceId: t.leadingResourceId,
          subcontractor: subcontractor,
          norm: (() => {
            if (!wtId) return null;
            const npu = normPerUnitByWorkTypeId.get(wtId) || 0;
            const qty = Number(t.quantity || 0);
            if (!Number.isFinite(qty) || qty === 0) return 0;
            return Math.round(qty * npu * 100) / 100;
          })(),
          open: true
        };
      } catch (err: any) {
        logger.error(`Error mapping task ${t.id}:`, err);
        throw err;
      }
    });

    logger.info(`Successfully prepared Gantt data for project ${projectId}: ${data.length} tasks, ${links.length} links`);

    res.json({
      data,
      links: links.map(l => ({
        id: l.id,
        source: l.source,
        target: l.target,
        type: l.type,
        lag: l.lag
      }))
    });

  } catch (error: any) {
    logger.error('Error in GET /api/gantt/:projectId:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// DELETE /api/gantt/:projectId
// Очистить график проекта
router.delete('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Удаляем все задачи (каскадно должны удалиться и связи, если настроено в БД, но лучше явно)
    // Сначала связи
    // Находим все задачи проекта
    const tasks = await prisma.ganttTask.findMany({
      where: { projectId },
      select: { id: true }
    });
    const taskIds = tasks.map(t => t.id);

    // Удаляем связи, где source или target в этом проекте
    await prisma.ganttLink.deleteMany({
      where: {
        OR: [
          { source: { in: taskIds } },
          { target: { in: taskIds } }
        ]
      }
    });

    // Удаляем задачи
    await prisma.ganttTask.deleteMany({
      where: { projectId }
    });

    res.json({ message: 'Schedule cleared successfully' });
  } catch (error: any) {
    logger.error('Error clearing schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/gantt/task/:id
// Обновление задачи (перемещение, изменение длительности)
router.put('/task/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      text, start_date, duration, progress, parent, quantity, unit,
      shiftsPerDay, resourceCount, calculationMode, plannedWork, leadingResourceId,
      completedQuantity, addedQuantity, executionDate
    } = req.body;
    const parsedDate = start_date ? new Date(start_date) : undefined;

    const toFiniteNumber = (value: any) => {
      if (value === null || value === undefined || value === '') return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    };

    const existing = await (prisma.ganttTask as any).findUnique({
      where: { id },
      include: {
        project: {
          select: { shiftDuration: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const data: any = {};
    if (text !== undefined) data.text = String(text);
    if (parsedDate !== undefined && !Number.isNaN(parsedDate.getTime())) data.start_date = parsedDate;

    // Use current or new quantity for calculations
    const curQty = (quantity !== undefined ? toFiniteNumber(quantity) : undefined) ?? Number(existing.quantity || 0);
    if (quantity !== undefined) data.quantity = curQty;

    // We assume completedQuantity is in "physical units" (scaled with multiplier if any)
    // while progress is 0.0 - 1.0. 
    // To properly calculate, we'd need the multiplier from the unit, but to keep it simple and consistent:
    // If progress is provided but not completedQuantity, we estimate it.
    // However, if we don't have the multiplier here, we might be slightly off if we just use curQty.
    // BUT! existing.plannedWork is often set to quantity * norm.

    // Let's check if we can get the multiplier from existing.unit
    const getMultiplier = (u: any) => {
      const match = String(u || '').match(/^(\d+)/);
      return match ? parseInt(match[0], 10) : 1;
    };
    const mult = getMultiplier(unit !== undefined ? unit : existing.unit);
    const physicalVolume = (curQty || 0) * mult;

    if (progress !== undefined && completedQuantity === undefined) {
      const p = toFiniteNumber(progress) || 0;
      data.progress = p;
      data.completedQuantity = Number((p * physicalVolume).toFixed(4));
    } else if (completedQuantity !== undefined && progress === undefined) {
      const cq = toFiniteNumber(completedQuantity) || 0;
      data.completedQuantity = cq;
      data.progress = physicalVolume > 0 ? Number(Math.min(1, cq / physicalVolume).toFixed(4)) : 0;
    } else {
      if (progress !== undefined) data.progress = toFiniteNumber(progress);
      if (completedQuantity !== undefined) data.completedQuantity = toFiniteNumber(completedQuantity);
    }

    if (unit !== undefined) data.unit = unit === null ? null : String(unit);
    if (shiftsPerDay !== undefined) data.shiftsPerDay = Number(shiftsPerDay);
    if (resourceCount !== undefined) data.resourceCount = toFiniteNumber(resourceCount);
    if (calculationMode !== undefined) data.calculationMode = String(calculationMode);
    if (leadingResourceId !== undefined) data.leadingResourceId = leadingResourceId === null ? null : String(leadingResourceId);

    // Recording history if addedQuantity is provided
    if (addedQuantity !== undefined && Number(addedQuantity) !== 0) {
      const q = Number(addedQuantity);
      const p = progress !== undefined ? toFiniteNumber(progress) : existing.progress;
      let d = new Date();
      if (executionDate) {
        const parsed = new Date(executionDate);
        if (!isNaN(parsed.getTime())) d = parsed;
      }

      try {
        await (prisma as any).taskProgress.create({
          data: {
            taskId: id,
            date: d,
            quantity: q,
            progress: p || 0
          }
        });
      } catch (e) {
        logger.error('Failed to create TaskProgress:', e);
      }
    }

    // --- NEW CALCULATION LOGIC ---
    const shiftHours = existing.project?.shiftDuration || 8;
    const curShifts = toFiniteNumber(shiftsPerDay) ?? Number(existing.shiftsPerDay || 1);
    const curResCount = toFiniteNumber(resourceCount) ?? Number(existing.resourceCount || 1);
    const curCalcMode = calculationMode || existing.calculationMode || 'manual';

    // Workload calculation
    let curWork = toFiniteNumber(plannedWork) ?? Number(existing.plannedWork || 0);
    const curLeadingId = leadingResourceId !== undefined ? leadingResourceId : existing.leadingResourceId;

    let usedShifts = curShifts;

    // If we have a leading resource, its norm defines the work for the "Golden Triangle" calculation
    if (curLeadingId) {
      const resource = await (prisma.resource as any).findUnique({
        where: { id: curLeadingId },
        select: { normPerUnit: true, shiftsPerDay: true }
      });
      if (resource) {
        if (resource.normPerUnit) {
          curWork = curQty * Number(resource.normPerUnit);
        }
        if (resource.shiftsPerDay) {
          usedShifts = resource.shiftsPerDay;
        }
      }
    } else if (plannedWork === undefined && quantity !== undefined && existing.quantity && existing.plannedWork) {
      // Fallback: If quantity changed but no leading resource, scale current work proportionally
      const norm = Number(existing.plannedWork) / Number(existing.quantity);
      curWork = curQty * norm;
    }
    data.plannedWork = curWork;

    let finalDuration = toFiniteNumber(duration) ?? Number(existing.duration || 1);
    let finalResCount = curResCount;

    if (curCalcMode === 'auto_duration') {
      // Duration = Work / (ResCount * Shifts * ShiftHours)
      const dailyProductivity = curResCount * usedShifts * shiftHours;
      if (dailyProductivity > 0) {
        finalDuration = Math.max(1, Math.ceil(curWork / dailyProductivity));
      }
    } else if (curCalcMode === 'auto_resources') {
      // ResCount = Work / (Duration * Shifts * ShiftHours)
      const totalShiftHours = finalDuration * usedShifts * shiftHours;
      if (totalShiftHours > 0) {
        finalResCount = curWork / totalShiftHours;
        // Round to 2 decimals for display
        finalResCount = Math.round(finalResCount * 100) / 100;
      }
    } else {
      // manual or old durationType logic
      // fallback to existing resourceIntensity logic if needed, but we prefer the new fields
    }

    data.duration = Math.max(1, Math.round(finalDuration));
    data.resourceCount = finalResCount;

    await (prisma.ganttTask as any).update({
      where: { id },
      data,
    });

    // Пересчитываем родителей (summary tasks) по детям.
    try {
      const meta = await prisma.ganttTask.findUnique({
        where: { id },
        select: { projectId: true, parent: true },
      });
      if (meta?.projectId) {
        await rollupAncestors(meta.projectId, meta.parent ?? id);
      }
    } catch (e) {
      logger.warn('rollupAncestors failed:', e);
    }

    res.json({ status: 'ok' });
  } catch (error: any) {
    logger.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/gantt/task/:id
// Удаление задачи (вид работ). Для безопасности запрещаем удалять задачи с детьми.
router.delete('/task/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.ganttTask.findUnique({
      where: { id },
      select: { id: true, projectId: true, parent: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const childrenCount = await prisma.ganttTask.count({
      where: { projectId: task.projectId, parent: id }
    });

    if (childrenCount > 0) {
      return res.status(400).json({ error: 'Cannot delete a task that has children' });
    }

    // Удаляем связи, где source/target = id
    await prisma.ganttLink.deleteMany({
      where: {
        OR: [
          { source: id },
          { target: id }
        ]
      }
    });

    await prisma.ganttTask.delete({ where: { id } });

    // Пересчитываем родителей по детям
    try {
      await rollupAncestors(task.projectId, task.parent ?? null);
    } catch (e) {
      logger.warn('rollupAncestors after delete failed:', e);
    }

    res.json({ status: 'ok' });
  } catch (error: any) {
    logger.error('Error deleting gantt task:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/gantt/task/:id/history
// Получение истории выполнения задачи
router.get('/task/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const history = await (prisma as any).taskProgress.findMany({
      where: { taskId: id },
      orderBy: { date: 'desc' }
    });
    res.json(history);
  } catch (error: any) {
    logger.error('Error fetching task history:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gantt/link
// Создание связи
router.post('/link', async (req, res) => {
  try {
    const { source, target, type, lag } = req.body;

    const link = await prisma.ganttLink.create({
      data: {
        source,
        target,
        type: String(type),
        lag: Number(lag || 0)
      }
    });

    res.json({ id: link.id, status: "ok" });
  } catch (error: any) {
    logger.error('Error creating link:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/gantt/link/:id
// Удаление связи
router.delete('/link/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.ganttLink.delete({
      where: { id }
    });
    res.json({ status: "ok" });
  } catch (error: any) {
    logger.error('Error deleting link:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/gantt/tasks/:taskId/resources/:resourceId
// Обновление назначения ресурса на задачу (например, сменность)
router.put('/tasks/:taskId/resources/:resourceId', async (req, res) => {
  try {
    const { taskId, resourceId } = req.params;
    const { shiftsPerDay } = req.body;

    logger.info(`Updating resource shifts: task=${taskId}, resource=${resourceId}, shiftsPerDay=${shiftsPerDay}`);

    // Обновляем сменность в таблице Resource
    const updated = await prisma.resource.update({
      where: { id: resourceId },
      data: {
        shiftsPerDay: shiftsPerDay !== undefined ? Number(shiftsPerDay) : undefined
      }
    });

    res.json({ status: 'ok', resource: updated });
  } catch (error: any) {
    logger.error('Error updating resource shifts:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

