import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import multer from 'multer';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// GET /api/tenders?projectId=X
// Получить список лотов проекта
// ==========================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const tenders = await prisma.tender.findMany({
      where: { projectId },
      include: {
        invites: {
          include: {
            subcontractor: true,
            bid: true
          }
        },
        bids: {
          include: {
            subcontractor: true,
            invite: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tenders);
  } catch (error) {
    console.error('Error fetching tenders:', error);
    res.status(500).json({ error: 'Failed to fetch tenders' });
  }
});

// ==========================================
// GET /api/tenders/:id
// Получить детали лота
// ==========================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        project: true,
        invites: {
          include: {
            subcontractor: true,
            bid: true
          }
        },
        bids: {
          include: {
            subcontractor: true,
            invite: true
          }
        }
      }
    });

    if (!tender) {
      return res.status(404).json({ error: 'Tender not found' });
    }

    res.json(tender);
  } catch (error) {
    console.error('Error fetching tender:', error);
    res.status(500).json({ error: 'Failed to fetch tender' });
  }
});

// ==========================================
// POST /api/tenders
// Создать новый лот
// ==========================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      name,
      description,
      blockIds,      // массив ["block1", "block2"]
      sectionIds,    // массив ["АР", "КЖ"]
      startDate,
      deadline
    } = req.body;

    // Валидация
    if (!projectId || !name || !blockIds || !sectionIds || !startDate || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Создаем лот
    const tender = await prisma.tender.create({
      data: {
        projectId,
        name,
        description: description || '',
        blockIds: JSON.stringify(blockIds),
        sectionIds: JSON.stringify(sectionIds),
        startDate: new Date(startDate),
        deadline: new Date(deadline),
        status: 'open',
        items: req.body.items ? JSON.stringify(req.body.items) : '[]'
      }
    });

    res.status(201).json(tender);
  } catch (error) {
    console.error('Error creating tender:', error);
    res.status(500).json({ error: 'Failed to create tender' });
  }
});

// ==========================================
// POST /api/tenders/:id/invites
// Пригласить субподрядчика в лот
// ==========================================
router.post('/:id/invites', async (req: Request, res: Response) => {
  try {
    const { id: tenderId } = req.params;
    const { subcontractorId } = req.body;

    if (!subcontractorId) {
      return res.status(400).json({ error: 'subcontractorId is required' });
    }

    // Проверяем существование тендера
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId }
    });

    if (!tender) {
      return res.status(404).json({ error: 'Tender not found' });
    }

    // Проверяем, не приглашен ли уже
    const existingInvite = await prisma.tenderInvite.findFirst({
      where: {
        tenderId,
        subcontractorId
      }
    });

    if (existingInvite) {
      return res.status(400).json({ error: 'Subcontractor already invited' });
    }

    // Генерируем уникальный токен
    const token = crypto.randomBytes(32).toString('hex');

    // Генерируем 4-значный цифровой код
    const inviteCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Создаем приглашение
    const invite = await prisma.tenderInvite.create({
      data: {
        tenderId,
        subcontractorId,
        token,
        inviteCode,
        expiresAt: tender.deadline, // Приглашение действует до дедлайна
        status: 'pending'
      },
      include: {
        subcontractor: true
      }
    });

    res.status(201).json(invite);
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

/**
 * GET /api/tenders/:id/share-link
 * Генерирует общую ссылку на лот
 */
router.get('/:id/share-link', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // В реальном проекте здесь может быть домен из конфига
    const baseUrl = 'http://localhost:8000';
    const url = `${baseUrl}/subcontractor-portal.html?tenderId=${id}`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

/**
 * POST /api/tenders/auth
 * Универсальный вход: ID тендера + 4-значный код
 */
router.post('/auth', async (req: Request, res: Response) => {
  try {
    const { tenderId, code } = req.body;
    if (!tenderId || !code) return res.status(400).json({ error: 'Missing tenderId or code' });

    const invite = await prisma.tenderInvite.findFirst({
      where: {
        tenderId,
        inviteCode: code
      },
      include: {
        subcontractor: true
      }
    });

    if (!invite) return res.status(401).json({ error: 'Invalid code for this lot' });
    res.json({ token: invite.token, subcontractor: invite.subcontractor });
  } catch (error) {
    res.status(500).json({ error: 'Auth failed' });
  }
});

/**
 * POST /api/tenders/invites/:token/auth
 * Вход по прямой ссылке: Токен + 4-значный код
 */
router.post('/invites/:token/auth', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code } = req.body;

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      include: { subcontractor: true }
    });

    if (!invite || invite.inviteCode !== code) {
      return res.status(401).json({ error: 'Invalid code' });
    }

    res.json({ token: invite.token, subcontractor: invite.subcontractor });
  } catch (error) {
    res.status(500).json({ error: 'Auth failed' });
  }
});

// ==========================================
// POST /api/bids/:id/block
// Заблокировать/разблокировать отклик
// ==========================================
router.post('/bids/:id/block', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { blocked, blockReason } = req.body;

    const bid = await prisma.tenderBid.update({
      where: { id },
      data: {
        blocked,
        blockReason: blocked ? blockReason : null,
        blockDate: blocked ? new Date() : null
      }
    });

    res.json(bid);
  } catch (error) {
    console.error('Error updating bid block status:', error);
    res.status(500).json({ error: 'Failed to update bid' });
  }
});

// ==========================================
// POST /api/bids/:id/select-winner
// Выбрать победителя
// ==========================================
router.post('/bids/:id/select-winner', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Получаем отклик
    const bid = await prisma.tenderBid.findUnique({
      where: { id }
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    // Сбрасываем статус winner у других откликов этого тендера
    await prisma.tenderBid.updateMany({
      where: {
        tenderId: bid.tenderId,
        status: 'winner'
      },
      data: {
        status: 'parsed'
      }
    });

    // Устанавливаем статус winner текущему отклику
    const updatedBid = await prisma.tenderBid.update({
      where: { id },
      data: {
        status: 'winner'
      }
    });

    res.json(updatedBid);
  } catch (error) {
    console.error('Error selecting winner:', error);
    res.status(500).json({ error: 'Failed to select winner' });
  }
});

// ==========================================
// POST /api/bids/:id/create-contract
// Создать договор
// ==========================================
router.post('/bids/:id/create-contract', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Получаем отклик
    const bid = await prisma.tenderBid.findUnique({
      where: { id },
      include: {
        tender: true
      }
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    if (bid.status !== 'winner') {
      return res.status(400).json({ error: 'Only winner can have contract' });
    }

    // Генерируем номер договора: LOT-ID/YEAR/COUNTER
    const year = new Date().getFullYear();
    const counter = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
    const contractNumber = `${bid.tender.name}/  ${year}/${counter}`;

    // Обновляем отклик
    const updatedBid = await prisma.tenderBid.update({
      where: { id },
      data: {
        status: 'contract',
        contractNumber,
        contractDate: new Date()
      }
    });

    // Обновляем статус тендера на closed
    await prisma.tender.update({
      where: { id: bid.tenderId },
      data: {
        status: 'closed'
      }
    });

    res.json(updatedBid);
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// ==========================================
// POST /api/bids/:id/cancel-contract
// Отменить договор
// ==========================================
router.post('/bids/:id/cancel-contract', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Получаем отклик
    const bid = await prisma.tenderBid.findUnique({
      where: { id }
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    if (bid.status !== 'contract') {
      return res.status(400).json({ error: 'Bid does not have contract' });
    }

    // Обновляем отклик
    const updatedBid = await prisma.tenderBid.update({
      where: { id },
      data: {
        status: 'winner',
        contractNumber: null,
        contractDate: null
      }
    });

    // Обновляем статус тендера обратно на open
    await prisma.tender.update({
      where: { id: bid.tenderId },
      data: {
        status: 'open'
      }
    });

    res.json(updatedBid);
  } catch (error) {
    console.error('Error canceling contract:', error);
    res.status(500).json({ error: 'Failed to cancel contract' });
  }
});

// ==========================================
// DELETE /api/tenders/:id
// Удалить лот
// ==========================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if tender exists
    const tender = await prisma.tender.findUnique({
      where: { id }
    });

    if (!tender) {
      return res.status(404).json({ error: 'Tender not found' });
    }

    // Delete tender (cascading will delete related invites and bids)
    await prisma.tender.delete({
      where: { id }
    });

    res.json({ message: 'Tender deleted successfully' });
  } catch (error) {
    console.error('Error deleting tender:', error);
    res.status(500).json({ error: 'Failed to delete tender' });
  }
});

// ==========================================
// POST /api/tenders/bids/:id/block
// Заблокировать/разблокировать
// ==========================================
router.post('/bids/:id/block', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { blocked, blockReason } = req.body;

    await prisma.tenderBid.update({
      where: { id },
      data: {
        blocked,
        blockReason: blocked ? blockReason : null,
        blockDate: blocked ? new Date() : null
      }
    });

    res.json({ message: 'Bid block status updated' });
  } catch (error) {
    console.error('Error blocking bid:', error);
    res.status(500).json({ error: 'Failed to update bid block status' });
  }
});

// ==========================================
// POST /api/tenders/bids/:id/select-winner
// Выбрать победителя
// ==========================================
router.post('/bids/:id/select-winner', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Optional: Unselect other winners for this tender?
    // For now, simple update
    await prisma.tenderBid.update({
      where: { id },
      data: { status: 'winner' }
    });

    res.json({ message: 'Winner selected' });
  } catch (error) {
    console.error('Error selecting winner:', error);
    res.status(500).json({ error: 'Failed to select winner' });
  }
});

// ==========================================
// POST /api/tenders/bids/:id/create-contract
// Создать договор
// ==========================================
router.post('/bids/:id/create-contract', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.tenderBid.update({
      where: { id },
      data: {
        status: 'contract',
        contractNumber: 'Д-' + Math.floor(Math.random() * 10000), // Random demo contract number
        contractDate: new Date()
      }
    });

    res.json({ message: 'Contract created' });
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// ==========================================
// POST /api/tenders/bids/:id/cancel-contract
// Отменить договор
// ==========================================
router.post('/bids/:id/cancel-contract', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.tenderBid.update({
      where: { id },
      data: {
        status: 'winner', // Revert to winner
        contractNumber: null,
        contractDate: null
      }
    });

    res.json({ message: 'Contract canceled' });
  } catch (error) {
    console.error('Error canceling contract:', error);
    res.status(500).json({ error: 'Failed to cancel contract' });
  }
});

// ==========================================
// Subcontractor Portal Routes
// ==========================================

// GET /api/tenders/invites/:token
// Get basic invite/tender info (for login screen)
router.get('/invites/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      include: {
        tender: {
          include: { project: true }
        },
        subcontractor: true,
        bid: true
      }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invite expired' });
    }

    res.json({
      tenderName: invite.tender.name,
      projectName: invite.tender.project.name,
      subcontractorName: invite.subcontractor.company,
      startDate: invite.tender.startDate,
      deadline: invite.tender.deadline,
      status: invite.tender.status,
      bidStatus: invite.bid?.status || 'none'
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tenders/invites/:token/auth
// Verify 4-digit code (via token)
router.post('/invites/:token/auth', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code } = req.body;

    const invite = await prisma.tenderInvite.findUnique({
      where: { token }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Invalid code' });

    res.json({ success: true, token: invite.token });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tenders/auth
// Verify 4-digit code via tenderId (general link)
router.post('/auth', async (req: Request, res: Response) => {
  try {
    const { tenderId, code } = req.body;

    const invite = await prisma.tenderInvite.findFirst({
      where: { tenderId, inviteCode: code }
    });

    if (!invite) return res.status(401).json({ error: 'Invalid code or tender ID' });

    res.json({ success: true, token: invite.token });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tenders/invites/:token/details
// Get full details after auth
router.get('/invites/:token/details', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code } = req.query; // Code should be provided for basic security

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      include: {
        tender: {
          include: { project: true }
        },
        subcontractor: true,
        bid: true
      }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });

    // Parse items and sectionIds
    const tenderItems = JSON.parse(invite.tender.items || '[]');
    const sectionIds = JSON.parse(invite.tender.sectionIds || '[]');

    // Fetch full details for the work types included in the tender
    const workTypeIds = tenderItems.map((it: any) => it.workTypeId).filter(Boolean);
    const workTypes = await prisma.workType.findMany({
      where: { id: { in: workTypeIds } },
      include: { resources: true, stage: true }
    });

    res.json({
      tender: invite.tender,
      subcontractor: invite.subcontractor,
      bid: invite.bid,
      items: tenderItems,
      workTypes: workTypes, // Include full work types with resources
      selectedSections: sectionIds
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tenders/invites/:token/bid
// Create or update bid
router.post('/invites/:token/bid', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code, priceTotal, completionDate, items, status } = req.body;

    const invite = await prisma.tenderInvite.findUnique({
      where: { token }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });

    const bidData = {
      priceTotal: parseFloat(priceTotal),
      completionDate: String(completionDate),
      items: JSON.stringify(items || []),
      status: status || 'parsing', // 'parsed' if finished
      files: '[]',
      tenderId: invite.tenderId,
      subcontractorId: invite.subcontractorId,
      inviteId: invite.id
    };

    const existingBid = await prisma.tenderBid.findUnique({
      where: { inviteId: invite.id }
    });

    let bid;
    if (existingBid) {
      bid = await prisma.tenderBid.update({
        where: { id: existingBid.id },
        data: bidData
      });
    } else {
      bid = await prisma.tenderBid.create({
        data: bidData
      });
    }

    res.json(bid);
  } catch (error) {
    console.error('Bid error:', error);
    res.status(500).json({ error: 'Failed to save bid' });
  }
});

// GET /api/tenders/invites/:token/export-csv/:estimateId
// Export CSV for an estimate including resources
router.get('/invites/:token/export-csv/:estimateId', async (req: Request, res: Response) => {
  try {
    const { token, estimateId } = req.params;
    const { code } = req.query;

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      include: { tender: true }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });

    const tenderItems = JSON.parse(invite.tender.items || '[]');
    // Filter items belonging to this estimate
    const estimateWorks = tenderItems.filter((i: any) => i.estimateId === estimateId);

    if (estimateWorks.length === 0) {
      return res.status(404).json({ error: 'No works found for this estimate in the tender' });
    }

    // Fetch resources for these work types
    const workTypeIds = estimateWorks.map((i: any) => i.workTypeId);
    const workTypesWithResources = await prisma.workType.findMany({
      where: { id: { in: workTypeIds } },
      include: { resources: true, stage: true },
      orderBy: { orderIndex: 'asc' }
    });

    // Build CSV Content
    // №	Тип ресурса	Название	Ед.изм	Кол-во	Цена
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += '№\tТип ресурса\tНазвание\tЕд.изм\tКол-во\tЦена\n';

    // Group by Stage
    const stagesMap = new Map();
    workTypesWithResources.forEach(wt => {
      if (!stagesMap.has(wt.stageId)) {
        stagesMap.set(wt.stageId, { name: wt.stage.name, works: [] });
      }
      stagesMap.get(wt.stageId).works.push(wt);
    });

    let counter = 1;
    stagesMap.forEach((stage, stageId) => {
      // Format stage as and empty row with stage name in the middle
      csv += `\t${stage.name.toUpperCase()}\t\t\t\t\n`;
      stage.works.forEach((wt: any) => {
        csv += `${counter}\tРабота\t${wt.name}\t${wt.unit || 'ед.'}\t${wt.quantity || 0}\t0\n`;
        // Resources
        (wt.resources || []).forEach((res: any, idx: number) => {
          csv += `${counter}.${idx + 1}\t${res.resourceType}\t${res.name}\t${res.unit || ''}\t${res.quantity || 0}\t0\n`;
        });
        counter++;
      });
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="estimate_${estimateId}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('CSV Export error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// POST /api/tenders/invites/:token/upload-csv
// Upload and parse offer CSV
router.post('/invites/:token/upload-csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code } = req.body;

    const invite = await prisma.tenderInvite.findUnique({
      where: { token }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n');
    let totalPrice = 0;
    const parsedItems: any[] = [];

    // Skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split('\t');
      if (cols.length < 6) continue;

      const name = cols[2];
      const quantity = parseFloat(cols[4]) || 0;
      const price = parseFloat(cols[5]) || 0;

      if (price > 0) {
        totalPrice += (quantity * price);
        parsedItems.push({
          name,
          quantity,
          price,
          total: quantity * price
        });
      }
    }

    // Update or create bid
    const bidData = {
      priceTotal: totalPrice,
      items: JSON.stringify(parsedItems),
      status: 'parsing',
      tenderId: invite.tenderId,
      subcontractorId: invite.subcontractorId,
      inviteId: invite.id,
      files: '[]'
    };

    const existingBid = await prisma.tenderBid.findUnique({
      where: { inviteId: invite.id }
    });

    if (existingBid) {
      await prisma.tenderBid.update({
        where: { id: existingBid.id },
        data: bidData
      });
    } else {
      await prisma.tenderBid.create({
        data: bidData
      });
    }

    res.json({ success: true, totalPrice, itemCount: parsedItems.length });

  } catch (error) {
    console.error('CSV Upload error:', error);
    res.status(500).json({ error: 'Failed to process CSV' });
  }
});

export default router;
