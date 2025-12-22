import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

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
            subcontractor: true
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
            subcontractor: true
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
        status: 'open'
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

    // Создаем приглашение
    const invite = await prisma.tenderInvite.create({
      data: {
        tenderId,
        subcontractorId,
        token,
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

export default router;
