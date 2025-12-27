import logger from '../utils/logger';
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * MS_PER_DAY);

const calcDurationDays = (start: Date, end: Date) => {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
};

// Roll up parent task dates in-memory (used during generation before saving).
const rollupInMemory = (tasksToCreate: any[]) => {
  const byId = new Map<string, any>();
  for (const t of tasksToCreate) byId.set(String(t.id), t);

  const childrenByParent = new Map<string, any[]>();
  for (const t of tasksToCreate) {
    if (!t?.parent) continue;
    const parentId = String(t.parent);
    if (!byId.has(parentId)) continue;
    const arr = childrenByParent.get(parentId) || [];
    arr.push(t);
    childrenByParent.set(parentId, arr);
  }

  const parentIds = Array.from(childrenByParent.keys());
  const computeParent = (parentId: string) => {
    const children = childrenByParent.get(parentId);
    if (!children || children.length === 0) return;

    let minStart: Date | null = null;
    let maxEnd: Date | null = null;

    for (const c of children) {
      const start: Date | undefined = c?.start_date;
      if (!start || Number.isNaN(start.getTime())) continue;
      const end = addDays(start, Number(c?.duration || 0));
      if (!minStart || start < minStart) minStart = start;
      if (!maxEnd || end > maxEnd) maxEnd = end;
    }

    if (!minStart || !maxEnd) return;
    const p = byId.get(parentId);
    if (!p) return;
    p.start_date = minStart;
    p.duration = calcDurationDays(minStart, maxEnd);
  };

  // Multiple passes to ensure rollup reaches the root.
  for (let i = 0; i < 6; i++) {
    for (const pid of parentIds) computeParent(pid);
  }
};

// Roll up parent task dates in DB (used after updates).
const rollupAncestors = async (projectId: string, startId: string | null) => {
  const visited = new Set<string>();
  let currentId: string | null = startId;

  while (currentId && currentId !== '0' && !visited.has(currentId)) {
    visited.add(currentId);

    const children = await prisma.ganttTask.findMany({
      where: { projectId, parent: currentId },
      select: { start_date: true, duration: true },
    });

    if (children.length > 0) {
      let minStart: Date | null = null;
      let maxEnd: Date | null = null;

      for (const c of children) {
        if (!c.start_date || Number.isNaN(c.start_date.getTime())) continue;
        const start = c.start_date;
        const end = addDays(start, Number(c.duration || 0));
        if (!minStart || start < minStart) minStart = start;
        if (!maxEnd || end > maxEnd) maxEnd = end;
      }

      if (minStart && maxEnd) {
        const duration = calcDurationDays(minStart, maxEnd);
        await prisma.ganttTask.update({
          where: { id: currentId },
          data: { start_date: minStart, duration },
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

// ========================================
// ГЕНЕРАЦИЯ ГРАФИКА (Gantt)
// ========================================

// POST /api/gantt/generate/:projectId
// Генерирует структуру задач для диаграммы Ганта на основе сметы
router.post('/generate/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { mode, useAI } = req.body;

    const safeJsonArray = (value: any): string[] => {
      if (value === null || value === undefined || value === '') return [];
      if (Array.isArray(value)) {
        return value
          .map((v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : null))
          .filter((v): v is string => Boolean(v));
      }
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return safeJsonArray(parsed);
        } catch {
          return [];
        }
      }
      return [];
    };

    const splitIfcArgs = (argsSource: string): string[] => {
      const args: string[] = [];
      let current = '';
      let depth = 0;
      let inString = false;
      for (let i = 0; i < argsSource.length; i++) {
        const ch = argsSource[i];
        if (ch === "'") {
          inString = !inString;
          current += ch;
          continue;
        }

        if (!inString) {
          if (ch === '(') depth++;
          if (ch === ')') depth = Math.max(0, depth - 1);
          if (ch === ',' && depth === 0) {
            args.push(current.trim());
            current = '';
            continue;
          }
        }

        current += ch;
      }
      if (current.trim()) args.push(current.trim());
      return args;
    };

    const parseIfcGuidToStorey = (fileContent: string) => {
      // Decode IFC strings encoded as UTF-16BE hex: \X2\....\X0\
      const decodeIfcString = (str: string) => {
        try {
          return str.replace(/\\X2\\([0-9A-F]+)\\X0\\/g, (match, hex) => {
            let result = '';
            for (let i = 0; i < hex.length; i += 4) {
              const charCode = parseInt(hex.substr(i, 4), 16);
              result += String.fromCharCode(charCode);
            }
            return result;
          });
        } catch {
          return str;
        }
      };

      const storeyNameByEntityId = new Map<string, string>();
      const guidByEntityId = new Map<string, string>();
      const guidToStoreyName = new Map<string, string>();

      // #123= IFCBUILDINGSTOREY(...,'Name' ...);
      const storeyRegex = /#(\d+)\s*=\s*IFCBUILDINGSTOREY\s*\([^,]*,\s*[^,]*,\s*'([^']*)'/gi;
      let match: RegExpExecArray | null;
      while ((match = storeyRegex.exec(fileContent)) !== null) {
        const entityId = match[1];
        const rawName = match[2];
        storeyNameByEntityId.set(entityId, decodeIfcString(rawName));
      }

      // Map any entity with a first GUID arg: #45= IFCWALL(... 'GUID' ...)
      const guidRegex = /#(\d+)\s*=\s*IFC[A-Z0-9_]+\s*\(\s*'([^']+)'/gi;
      while ((match = guidRegex.exec(fileContent)) !== null) {
        const entityId = match[1];
        const guid = match[2];
        if (!guidByEntityId.has(entityId)) {
          guidByEntityId.set(entityId, guid);
        }
      }

      // Parse containment relationships and connect related element entity IDs to storey entity ID.
      // #999= IFCRELCONTAINEDINSPATIALSTRUCTURE(...,(#45,#46),#123);
      const relRegex = /#(\d+)\s*=\s*IFCRELCONTAINEDINSPATIALSTRUCTURE\s*\(([^;]*?)\)\s*;/gi;
      while ((match = relRegex.exec(fileContent)) !== null) {
        const argsSource = match[2];
        const args = splitIfcArgs(argsSource);
        if (args.length < 6) continue;

        const related = args[4];
        const relating = args[5];

        const relatingIdMatch = relating.match(/#(\d+)/);
        if (!relatingIdMatch) continue;
        const relatingId = relatingIdMatch[1];
        const storeyName = storeyNameByEntityId.get(relatingId);
        if (!storeyName) continue; // skip if relating structure is not a storey

        const relatedIds = Array.from(related.matchAll(/#(\d+)/g)).map((m) => m[1]);
        for (const relatedId of relatedIds) {
          const guid = guidByEntityId.get(relatedId);
          if (!guid) continue;
          if (!guidToStoreyName.has(guid)) {
            guidToStoreyName.set(guid, storeyName);
          }
        }
      }

      return {
        storeyNames: Array.from(new Set(storeyNameByEntityId.values())),
        guidToStoreyName,
      };
    };

    // 1. Получаем данные проекта со всей иерархией
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        blocks: {
          include: {
            estimates: {
              include: {
                sections: {
                  include: {
                    stages: {
                      include: {
                        workTypes: {
                          include: {
                            resources: {
                              select: {
                                id: true,
                                ifcElements: true,
                                unit: true,
                                quantity: true,
                              },
                            },
                          },
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 2. Очищаем существующие задачи Ганта для этого проекта
    // (В будущем можно сделать умное обновление, но пока полная перегенерация)
    await prisma.ganttTask.deleteMany({
      where: { projectId }
    });

    const tasksToCreate: any[] = [];
    let sortOrder = 0;

    // 3. Создаем корневую задачу - Проект
    const projectTaskId = project.id; // Используем ID проекта как ID задачи для удобства
    tasksToCreate.push({
      id: projectTaskId,
      projectId,
      text: project.name,
      start_date: project.startDate || new Date(),
      duration: 1,
      progress: 0,
      parent: null, // Корневая задача
      type: 'project',
      sortOrder: sortOrder++
    });

    // 4. Группируем блоки по очередям строительства
    const phases: { [key: number]: typeof project.blocks } = {};
    project.blocks.forEach(block => {
      const phase = block.constructionPhase || 1;
      if (!phases[phase]) phases[phase] = [];
      phases[phase].push(block);
    });

    const sortedPhases = Object.keys(phases).sort((a, b) => Number(a) - Number(b));

    // 5. Создаем задачи для Очередей
    for (const phaseKey of sortedPhases) {
      const phaseNum = Number(phaseKey);
      const phaseBlocks = phases[phaseNum];
      
      // ID задачи очереди (фиктивный, генерируем)
      const phaseTaskId = `phase-${projectId}-${phaseNum}`;
      
      tasksToCreate.push({
        id: phaseTaskId,
        projectId,
        text: `Очередь: ${phaseNum}`,
        start_date: new Date(), // Default date
        duration: 1,
        progress: 0,
        parent: projectTaskId,
        type: 'project', // Группирующая задача
        sortOrder: sortOrder++
      });

      // 6. Создаем задачи для Блоков
      for (const block of phaseBlocks) {
        const blockTaskId = `block-${block.id}`;

        const floorTaskIds: string[] = [];
        
        tasksToCreate.push({
          id: blockTaskId,
          projectId,
          text: block.name,
          start_date: new Date(), // Default date
          duration: 1,
          progress: 0,
          parent: phaseTaskId,
          type: 'project',
          blockId: block.id,
          sortOrder: sortOrder++
        });

        // 6.5. Если режим 'manual', создаем этажи
        if (mode === 'manual') {
            // Подземные этажи
            const undergroundFloors = (block as any).undergroundFloors || 0;
            for (let i = undergroundFloors; i >= 1; i--) {
        const floorTaskId = `floor-${block.id}-minus-${i}`;
                tasksToCreate.push({
          id: floorTaskId,
                    projectId,
                    text: `Этаж -${i}`,
                    start_date: new Date(),
                    duration: 1,
                    progress: 0,
                    parent: blockTaskId,
                    type: 'project',
                    blockId: block.id,
                    sortOrder: sortOrder++
                });
        floorTaskIds.push(floorTaskId);
            }
            
            // Надземные этажи
            const floors = block.floors || 1;
            for (let i = 1; i <= floors; i++) {
        const floorTaskId = `floor-${block.id}-${i}`;
                tasksToCreate.push({
          id: floorTaskId,
                    projectId,
                    text: `Этаж ${i}`,
                    start_date: new Date(),
                    duration: 1,
                    progress: 0,
                    parent: blockTaskId,
                    type: 'project',
                    blockId: block.id,
                    sortOrder: sortOrder++
                });
        floorTaskIds.push(floorTaskId);
            }
        } else if (mode === 'bim') {
            // Пытаемся найти IFC файл в сметах блока
            let ifcPath = null;
            for (const estimate of block.estimates) {
                if (estimate.ifcFileUrl) {
                    ifcPath = path.join(__dirname, '../../', estimate.ifcFileUrl);
                    break;
                }
            }

            if (ifcPath && fs.existsSync(ifcPath)) {
                try {
                    const fileContent = fs.readFileSync(ifcPath, 'utf-8');

              const { storeyNames, guidToStoreyName } = parseIfcGuidToStorey(fileContent);

              // Сортируем этажи (попытка умной сортировки)
              const storeys = [...storeyNames];
              storeys.sort((a, b) => {
                const numA = parseInt(a.replace(/[^0-9-]/g, '')) || 0;
                const numB = parseInt(b.replace(/[^0-9-]/g, '')) || 0;
                return numA - numB;
              });

              const floorTaskIdByStoreyName = new Map<string, string>();

              // Создаем задачи для этажей
              for (const storeyName of storeys) {
                        const floorTaskId = `floor-${block.id}-${storeyName}`;
                        tasksToCreate.push({
                            id: floorTaskId,
                            projectId,
                            text: storeyName,
                            start_date: new Date(),
                            duration: 1,
                            progress: 0,
                            parent: blockTaskId,
                            type: 'project',
                        blockId: block.id,
                            sortOrder: sortOrder++,
                            // Добавляем маркер, что это этаж (можно использовать в description или отдельном поле, если схема позволяет)
                            // Но пока используем text для определения на фронте, теперь он будет читаемым "Этаж 1"
                        });
                        floorTaskIds.push(floorTaskId);
                floorTaskIdByStoreyName.set(storeyName, floorTaskId);
                    }

                    // Авто-раскладка видов работ по этажам на основе ресурсов с привязкой IFC
                    // Правило: показываем только WorkType, у которого есть хотя бы 1 ресурс с ifcElements,
                    // и только на тех этажах, которые определились из IFC.
              const workTypesInBlock = block.estimates.flatMap((e: any) =>
                (e.sections || []).flatMap((s: any) => (s.stages || []).flatMap((st: any) => st.workTypes || []))
              );

              for (const wt of workTypesInBlock) {
                      const resources: any[] = Array.isArray(wt.resources) ? wt.resources : [];

                      // Determine unit: prefer WorkType.unit, else single common unit across linked resources
                      const workTypeUnit = typeof wt.unit === 'string' ? wt.unit : '';
                      const resourceUnits = new Set(
                        resources
                          .map((r) => (typeof r.unit === 'string' ? r.unit.trim() : ''))
                          .filter((u) => Boolean(u))
                      );
                      const computedUnit = workTypeUnit || (resourceUnits.size === 1 ? Array.from(resourceUnits)[0] : '');

                      // Accumulate quantity per storey by distributing each resource quantity
                      // proportionally to the count of its linked elements on each storey.
                      const qtyByStorey = new Map<string, number>();
                      let hasAnyLinkedElement = false;

                      for (const r of resources) {
                        const guids = safeJsonArray(r.ifcElements);
                        if (!guids.length) continue;

                        const qty = Number(r.quantity);
                        const resourceQty = Number.isFinite(qty) ? qty : 0;

                        const countByStorey = new Map<string, number>();
                        let totalMapped = 0;

                        for (const guid of guids) {
                          const storeyName = guidToStoreyName.get(guid);
                          if (!storeyName) continue;
                          hasAnyLinkedElement = true;
                          totalMapped++;
                          countByStorey.set(storeyName, (countByStorey.get(storeyName) || 0) + 1);
                        }

                        if (totalMapped === 0) continue;
                        if (resourceQty === 0) {
                          // Even if qty=0, keep storey presence (task will be created with qty 0)
                          for (const [storeyName] of countByStorey) {
                            qtyByStorey.set(storeyName, qtyByStorey.get(storeyName) || 0);
                          }
                          continue;
                        }

                        for (const [storeyName, count] of countByStorey) {
                          const portion = (resourceQty * count) / totalMapped;
                          qtyByStorey.set(storeyName, (qtyByStorey.get(storeyName) || 0) + portion);
                        }
                      }

                      if (!hasAnyLinkedElement) continue;

                      for (const [storeyName, storeyQty] of qtyByStorey) {
                        const floorTaskId = floorTaskIdByStoreyName.get(storeyName);
                        if (!floorTaskId) continue;

                        const taskId = `worktype-${wt.id}-${floorTaskId}`;
                        tasksToCreate.push({
                          id: taskId,
                          projectId,
                          text: wt.name,
                          start_date: new Date(),
                          duration: 1,
                          progress: 0,
                          parent: floorTaskId,
                          type: 'task',
                          quantity: Number.isFinite(storeyQty) ? storeyQty : 0,
                          unit: computedUnit,
                          blockId: block.id,
                          sortOrder: sortOrder++,
                        });
                      }
              }
                } catch (err) {
                    logger.error('Error parsing IFC for floors:', err);
                }
            }
        }

        // Если этажи не создались (mode не задан / BIM не нашел storeys), создаем один дефолтный этаж
        if (floorTaskIds.length === 0) {
          const floorTaskId = `floor-${block.id}-1`;
          tasksToCreate.push({
            id: floorTaskId,
            projectId,
            text: `Этаж 1`,
            start_date: new Date(),
            duration: 1,
            progress: 0,
            parent: blockTaskId,
            type: 'project',
            blockId: block.id,
            sortOrder: sortOrder++
          });
          floorTaskIds.push(floorTaskId);
        }
      }
    }

    // Сохраняем все задачи в БД
    // Prisma createMany не поддерживает SQLite, поэтому используем транзакцию с create
    rollupInMemory(tasksToCreate);
    await prisma.$transaction(
      tasksToCreate.map(task => prisma.ganttTask.create({ data: task }))
    );

    res.json({ message: 'Schedule generated successfully', tasksCount: tasksToCreate.length });

  } catch (error: any) {
    logger.error('Error generating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

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
      const parts = (t.id || '').split('-');
      // id format: worktype-<workTypeId>-<floorTaskId>
      if (parts.length < 3) continue;
      const workTypeId = parts[1];
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

    const floorTask = await prisma.ganttTask.findUnique({
      where: { id: floorTaskId },
      select: { id: true, projectId: true, type: true }
    });

    if (!floorTask || floorTask.projectId !== projectId) {
      return res.status(404).json({ error: 'Floor task not found' });
    }

    const workType = await prisma.workType.findUnique({
      where: { id: workTypeId },
      select: { id: true, name: true, unit: true, description: true }
    });

    if (!workType) {
      return res.status(404).json({ error: 'Work type not found' });
    }

    const qty = Number.isFinite(Number(quantity)) ? Number(quantity) : 0;
    
    // Получаем норматив из описания вида работ или используем значение по умолчанию
    let productionRate = 10; // Значение по умолчанию
    try {
      // Пытаемся извлечь норматив из description (формат: "productionRate:12.5")
      if (workType.description) {
        const match = workType.description.match(/productionRate[:\s=]+([\d.]+)/i);
        if (match && match[1]) {
          productionRate = parseFloat(match[1]);
        }
      }
    } catch (e) {
      // Используем значение по умолчанию при ошибке
    }
    
    // TODO: Если useAI=true, здесь можно добавить вызов ИИ для сопоставления с нормативной базой
    // Пока используем норматив из description или значение по умолчанию
    
    const op: 'set' | 'add' = operation === 'add' ? 'add' : 'set';

    const taskId = `worktype-${workType.id}-${floorTaskId}`;

    const existing = await prisma.ganttTask.findUnique({
      where: { id: taskId },
      select: { id: true, quantity: true }
    });

    const finalQty = op === 'add' ? (Number(existing?.quantity || 0) + qty) : qty;
    const duration = Math.max(1, Math.ceil((finalQty || 0) / productionRate));

    await prisma.ganttTask.upsert({
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
        sortOrder: 999999
      },
      update: {
        text: workType.name,
        duration,
        quantity: finalQty,
        unit: workType.unit || '',
        parent: floorTaskId
      }
    });

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
        linksSource: true, // Исходящие связи
      }
    });

    const links = await prisma.ganttLink.findMany({
      where: {
        sourceTask: { projectId }
      }
    });

    // Форматируем для DHTMLX Gantt
    // DHTMLX ожидает { data: [], links: [] }
    // Даты нужно передавать в формате, который поймет клиент (обычно строка)
    
    res.json({
      data: tasks.map(t => ({
        id: t.id,
        text: t.text,
        start_date: t.start_date ? t.start_date.toISOString().replace('T', ' ').substring(0, 16) : '', // "YYYY-MM-DD HH:mm"
        duration: t.duration,
        progress: t.progress,
        parent: t.parent || 0, // DHTMLX любит 0 для корня, но у нас UUID. Проверим на клиенте.
        type: t.type,
        blockId: t.blockId,
        estimateSectionId: t.estimateSectionId,
        quantity: t.quantity,
        unit: t.unit,
        open: true // Раскрыть дерево по умолчанию
      })),
      links: links.map(l => ({
        id: l.id,
        source: l.source,
        target: l.target,
        type: l.type,
        lag: l.lag
      }))
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    const { text, start_date, duration, progress, parent, quantity, unit } = req.body;

    const parsedDate = start_date ? new Date(start_date) : undefined;

    const toFiniteNumber = (value: any) => {
      if (value === null || value === undefined || value === '') return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    };

    const data: any = {};
    if (text !== undefined) data.text = String(text);
    if (parsedDate !== undefined && !Number.isNaN(parsedDate.getTime())) data.start_date = parsedDate;

    const durationNumber = toFiniteNumber(duration);
    if (durationNumber !== undefined) data.duration = Math.max(0, Math.round(durationNumber));

    const progressNumber = toFiniteNumber(progress);
    if (progressNumber !== undefined) data.progress = progressNumber;

    const quantityNumber = toFiniteNumber(quantity);
    if (quantityNumber !== undefined) data.quantity = quantityNumber;

    if (unit !== undefined) data.unit = unit === null ? null : String(unit);

    // Проверяем, существует ли задача
    // Важно: у нас есть "виртуальные" задачи (phase-...), которые мы создали с кастомными ID
    // Prisma позволяет использовать строковые ID, так что это должно работать,
    // ЕСЛИ мы их реально создали в БД. А мы их создали в generate.

    await prisma.ganttTask.update({
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

export default router;

