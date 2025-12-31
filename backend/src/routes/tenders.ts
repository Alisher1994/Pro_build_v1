import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import crypto from 'crypto';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { scrapeRating } from '../services/ratingScraper';
import logger from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, uniqueSuffix + path.extname(originalName));
  }
});

const allowedMimes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/octet-stream',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png'
]);

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();

    // Some browsers/clients send CSV as application/octet-stream
    if (allowedMimes.has(file.mimetype) || ext === '.csv') {
      cb(null, true);
      return;
    }

    cb(new Error('Unsupported file type'));
  }
});

// ==========================================
// GET /api/tenders?projectId=X
// Получить список лотов проекта
// ==========================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, limit, offset } = req.query;

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const take = limit ? Math.min(Math.max(Number(limit), 1), 200) : undefined;
    const skip = offset ? Math.max(Number(offset), 0) : 0;

    const [total, tenders] = await Promise.all([
      prisma.tender.count({ where: { projectId } }),
      prisma.tender.findMany({
        where: { projectId },
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
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip
      })
    ]);

    res.json({
      data: tenders,
      total,
      limit: take ?? null,
      offset: skip
    });
  } catch (error) {
    logger.error('Error fetching tenders:', error);
    res.status(500).json({ error: 'Failed to fetch tenders' });
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
    logger.error('Error creating tender:', error);
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

    // Получаем субподрядчика для проверки INN
    const subcontractor = await prisma.subcontractor.findUnique({
      where: { id: subcontractorId }
    });

    if (subcontractor && subcontractor.inn) {
      // Запускаем скрапинг рейтинга в фоне (не блокируем ответ)
      scrapeRating(subcontractor.inn).then(async (rating) => {
        if (rating) {
          logger.info(`Updated rating for ${subcontractor.company} (INN: ${subcontractor.inn}): ${rating}`);
          await prisma.subcontractor.update({
            where: { id: subcontractorId },
            data: { rating }
          });
        }
      }).catch(err => {
        logger.error(`Background rating scrape failed for ${subcontractor.inn}:`, err);
      });
    }

    // Создаем приглашение
    const invite = await prisma.tenderInvite.create({
      data: {
        tenderId,
        subcontractorId,
        token,
        inviteCode,
        expiresAt: tender.deadline, // Приглашение действует до дедлайна
        status: 'invited'
      },
      include: {
        subcontractor: true
      }
    });

    res.status(201).json(invite);
  } catch (error) {
    logger.error('Error creating invite:', error);
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
    // Determine baseUrl dynamically from request headers
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['host'];
    const baseUrl = `${protocol}://${host}`;

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

    const trimmedTenderId = String(tenderId).trim();
    const trimmedCode = String(code).trim();

    const invite = await prisma.tenderInvite.findFirst({
      where: {
        tenderId: trimmedTenderId,
        inviteCode: trimmedCode
      },
      include: {
        subcontractor: true
      }
    });

    if (!invite) {
      logger.warn(`Auth failed: Tender ${trimmedTenderId}, Code ${trimmedCode}`);
      return res.status(401).json({ error: 'Invalid code for this lot' });
    }

    // Mark that this specific invite logged in via universal link
    await prisma.tenderInvite.update({
      where: { id: invite.id },
      data: { status: 'login' }
    });

    res.json({ token: invite.token, subcontractor: invite.subcontractor, success: true });
  } catch (error) {
    logger.error('Auth endpoint error:', error);
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

    // Mark login via direct token link
    await prisma.tenderInvite.update({ where: { id: invite.id }, data: { status: 'login' } });

    res.json({ token: invite.token, subcontractor: invite.subcontractor, success: true });
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
    logger.error('Error updating bid block status:', error);
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
    logger.error('Error selecting winner:', error);
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

    // Обновляем статус инвайта (для карточек/списков)
    await prisma.tenderInvite.update({
      where: { id: updatedBid.inviteId },
      data: { status: 'contract' }
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
    logger.error('Error creating contract:', error);
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

    // Обновляем статус инвайта обратно
    await prisma.tenderInvite.update({
      where: { id: updatedBid.inviteId },
      data: { status: 'winner' }
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
    logger.error('Error canceling contract:', error);
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
    logger.error('Error deleting tender:', error);
    res.status(500).json({ error: 'Failed to delete tender' });
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
    let tenderItems = JSON.parse(invite.tender.items || '[]');
    const sectionIds = JSON.parse(invite.tender.sectionIds || '[]');

    // Enrich tenderItems with real estimateId so read-only UIs (subcontractor portal)
    // can load 3D model and project files from /api/estimates/:id.
    // In some older tenders, items may only contain estimateName and blockName.
    try {
      const projectId = (invite.tender as any)?.projectId || (invite.tender as any)?.project?.id;
      const blockNames = new Set<string>();
      const blockIds = new Set<string>();
      const pairs: Array<{ blockId?: string; blockName?: string; estimateName: string }> = [];

      if (Array.isArray(tenderItems)) {
        tenderItems.forEach((it: any) => {
          const estimateName = String(it?.estimateName ?? it?.estimate_name ?? it?.estimate ?? '').trim();
          const blockId = String(it?.blockId ?? it?.block_id ?? '').trim();
          const blockName = String(it?.blockName ?? it?.block_name ?? it?.block ?? '').trim();
          if (!estimateName) return;

          pairs.push({ blockId: blockId || undefined, blockName: blockName || undefined, estimateName });
          if (blockId) blockIds.add(blockId);
          if (blockName) blockNames.add(blockName);
        });
      }

      // Resolve blockName -> blockId within project
      const blockNameToId = new Map<string, string>();
      if (projectId && blockNames.size) {
        const blocks = await prisma.block.findMany({
          where: {
            projectId: String(projectId),
            name: { in: Array.from(blockNames) },
          },
          select: { id: true, name: true },
        });
        blocks.forEach((b) => {
          blockNameToId.set(String(b.name), String(b.id));
          blockIds.add(String(b.id));
        });
      }

      // Build unique (blockId, estimateName) pairs
      const uniquePairs = new Map<string, { blockId: string; estimateName: string }>();
      pairs.forEach((p) => {
        const bId = p.blockId || (p.blockName ? blockNameToId.get(p.blockName) : undefined);
        if (!bId) return;
        const key = `${bId}||${p.estimateName}`;
        if (!uniquePairs.has(key)) uniquePairs.set(key, { blockId: bId, estimateName: p.estimateName });
      });

      if (uniquePairs.size) {
        const or = Array.from(uniquePairs.values()).map((p) => {
          const where: any = { blockId: p.blockId, name: p.estimateName };
          if (projectId) where.projectId = String(projectId);
          return where;
        });

        const estimates = await prisma.estimate.findMany({
          where: { OR: or },
          select: { id: true, blockId: true, name: true, ifcFileUrl: true, xktFileUrl: true },
        });

        const estimateByKey = new Map<string, any>();
        estimates.forEach((e) => {
          estimateByKey.set(`${String(e.blockId)}||${String(e.name)}`, e);
        });

        tenderItems = tenderItems.map((it: any) => {
          const estimateName = String(it?.estimateName ?? it?.estimate_name ?? it?.estimate ?? '').trim();
          const rawBlockId = String(it?.blockId ?? it?.block_id ?? '').trim();
          const blockName = String(it?.blockName ?? it?.block_name ?? it?.block ?? '').trim();
          const blockId = rawBlockId || (blockName ? blockNameToId.get(blockName) : undefined);
          if (!estimateName || !blockId) return it;

          const found = estimateByKey.get(`${String(blockId)}||${estimateName}`);
          if (!found) return it;

          return {
            ...it,
            // Only set estimateId if missing (don’t clobber if it already exists)
            estimateId: it?.estimateId || it?.estimate_id || found.id,
            // Optional hints for UIs to avoid extra API round-trip
            estimateIfcFileUrl: found.ifcFileUrl ?? null,
            estimateXktFileUrl: found.xktFileUrl ?? null,
            // Also backfill blockId if only blockName was present
            blockId: it?.blockId || it?.block_id || blockId,
          };
        });
      }
    } catch (e) {
      // Never fail invite details due to enrichment
      logger.warn('Invite details: estimateId enrichment failed', e as any);
    }

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

    // Keep invite status in sync for UI/admin cards
    const s = String(bidData.status || '').toLowerCase();
    const inviteStatus = s === 'parsed' ? 'submitted' : (s === 'parsing' ? 'draft' : (bidData.status || 'draft'));
    await prisma.tenderInvite.update({
      where: { id: invite.id },
      data: { status: inviteStatus }
    });

    res.json(bid);
  } catch (error) {
    logger.error('Bid error:', error);
    res.status(500).json({ error: 'Failed to save bid' });
  }
});

// POST /api/tenders/invites/:token/upload-doc
// Upload certificate or license document
router.post('/invites/:token/upload-doc', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { docType, code } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      include: { bid: true }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });

    // Auto-create bid if it doesn't exist
    let bidId: string;
    if (!invite.bid) {
      const newBid = await prisma.tenderBid.create({
        data: {
          inviteId: invite.id,
          tenderId: invite.tenderId,
          subcontractorId: invite.subcontractorId,
          priceTotal: 0,
          items: '[]',
          files: '[]',
          status: 'draft'
        }
      });
      bidId = newBid.id;
    } else {
      bidId = invite.bid.id;
    }

    // Determine which field to update
    const updateData: any = {};
    if (docType === 'certificate') {
      updateData.certificatePhoto = `/uploads/${file.filename}`;
    } else if (docType === 'license') {
      updateData.licensePhoto = `/uploads/${file.filename}`;
    } else if (docType === 'mtb') {
      updateData.mtbPhoto = `/uploads/${file.filename}`;
    } else if (docType === 'tr') {
      updateData.trPhoto = `/uploads/${file.filename}`;
    } else {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // Update the bid with the file path
    await prisma.tenderBid.update({
      where: { id: bidId },
      data: updateData
    });

    res.json({ success: true, path: updateData.certificatePhoto || updateData.licensePhoto });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
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
    // Filter items belonging to this estimate - try both ID and Name matching
    const estimateWorks = tenderItems.filter((i: any) =>
      String(i.estimateId) === estimateId ||
      String(i.estimateName) === estimateId
    );

    if (estimateWorks.length === 0) {
      logger.info('Available items in tender:', tenderItems.map((it: any) => ({ id: it.estimateId, name: it.estimateName })));
      return res.status(404).json({ error: `No works found for estimate "${estimateId}"` });
    }

    // Fetch resources for these work types
    const workTypeIds = estimateWorks.map((i: any) => i.workTypeId).filter(Boolean);
    const workTypesWithResources = await prisma.workType.findMany({
      where: { id: { in: workTypeIds } },
      include: {
        stage: true,
        resources: {
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });

    const tenderItemByWorkTypeId = new Map<string, any>();
    estimateWorks.forEach((it: any) => {
      if (it?.workTypeId) tenderItemByWorkTypeId.set(String(it.workTypeId), it);
    });

    const formatQty = (n: any) => {
      const val = typeof n === 'string' ? parseFloat(n.replace(',', '.')) : Number(n);
      if (!Number.isFinite(val)) return '';
      // Keep comma as decimal separator (no thousands separators)
      return String(val).replace('.', ',');
    };

    const csvEscape = (v: any) => {
      const s = String(v ?? '');
      // Comma-separated CSV (like the estimate source file)
      if (/[\r\n",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const csvRow = (cols: any[]) => cols.map(csvEscape).join(',') + '\r\n';

    // Build CSV Content in the same 8-column format as the estimate source file
    // N п.п.,Шифр номера нормативов и коды ресурсов,Наименование работ и затрат,Единица измерения,Количество,,Цена,Сумма
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += csvRow(['N п.п.', 'Шифр номера нормативов и коды ресурсов', 'Наименование работ и затрат', 'Единица измерения', 'Количество', '', 'Цена', 'Сумма']);
    csv += csvRow(['', '', '', '', 'на. ед. измерения', 'по проектным данным', '', '']);
    csv += csvRow(['1', '2', '3', '4', '5', '6', '7', '8']);

    // Group by Stage (stable order based on stage.orderIndex)
    const stagesMap = new Map<string, { stageOrder: number; name: string; works: any[] }>();
    workTypesWithResources.forEach((wt: any) => {
      const stId = String(wt.stageId);
      if (!stagesMap.has(stId)) {
        stagesMap.set(stId, {
          stageOrder: Number(wt.stage?.orderIndex ?? 0),
          name: String(wt.stage?.name || 'Этап'),
          works: []
        });
      }
      stagesMap.get(stId)!.works.push(wt);
    });

    const stagesOrdered = Array.from(stagesMap.entries()).sort((a, b) => {
      const ao = a[1].stageOrder;
      const bo = b[1].stageOrder;
      if (ao !== bo) return ao - bo;
      return a[1].name.localeCompare(b[1].name, 'ru');
    });

    let counter = 1;
    for (const [, stage] of stagesOrdered) {
      // Section row (e.g., "РАЗДЕЛ 1: ...")
      const stageTitle = String(stage.name || '').trim();
      if (stageTitle) {
        csv += csvRow([stageTitle, '', '', '', '', '', '', '']);
      }

      const worksOrdered = (stage.works || []).slice().sort((a: any, b: any) => {
        const ao = Number(a.orderIndex ?? 0);
        const bo = Number(b.orderIndex ?? 0);
        if (ao !== bo) return ao - bo;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      });

      worksOrdered.forEach((wt: any) => {
        const ti = tenderItemByWorkTypeId.get(String(wt.id));
        const workCipher = String(ti?.itemCode || ti?.cipher || wt.cipher || wt.code || '');
        const workName = String(ti?.name || wt.name || '');
        const workUnit = String(ti?.unit || wt.unit || '');
        const workQtyProject = formatQty(ti?.quantity ?? ti?.volume ?? wt.quantity ?? 0);

        // Work row: qty per unit (col5) usually empty; qty project (col6) filled
        csv += csvRow([
          String(counter),
          workCipher,
          workName,
          workUnit,
          '',
          workQtyProject,
          '0',
          '0'
        ]);

        (wt.resources || []).forEach((res: any, idx: number) => {
          const resCipher = String(res.cipher || res.code || '');
          const resUnit = String(res.unit || '');
          const qtyNorm = formatQty(res.normPerUnit ?? '');
          const qtyProject = formatQty(res.quantity ?? 0);
          csv += csvRow([
            `${counter}.${idx + 1}`,
            resCipher,
            res.name,
            resUnit,
            qtyNorm,
            qtyProject,
            '0',
            '0'
          ]);
        });
        counter++;
      });
    }

    const fileName = `${estimateWorks[0]?.blockName || 'estimate'}_${estimateWorks[0]?.estimateName || estimateId}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}.csv"`);
    res.send(csv);

  } catch (error) {
    logger.error('CSV Export error:', error);
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

    // Read from disk instead of buffer
    const csvContent = fs.readFileSync(req.file.path, 'utf-8');
    const lines = csvContent.split(/\r?\n/);
    let totalPrice = 0;
    const parsedItems: any[] = [];

    const isRef = (v: any) => {
      const s = String(v || '').trim();
      // Matches: 1 or 1.2 etc.
      return /^\d+(\.\d+)?$/.test(s);
    };

    const parseNum = (v: any) => {
      if (v == null) return 0;
      // Support numbers like "3 577 760,23" with NBSP/thousands separators
      const cleaned = String(v)
        .trim()
        .replace(/[\s\u00A0]/g, '')
        .replace(',', '.');
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    const parseCsvLine = (line: string, delimiter: string) => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            const next = line[i + 1];
            if (next === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            cur += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === delimiter) {
            out.push(cur);
            cur = '';
          } else {
            cur += ch;
          }
        }
      }
      out.push(cur);
      return out;
    };

    // Parse all lines (skip headers/section rows by ref pattern)
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw) continue;
      const line = raw.trim();
      if (!line) continue;

      // Choose delimiter by content
      // New estimate-like export uses commas; legacy export uses semicolons.
      const delimiter = line.includes(';') ? ';' : ',';
      const cols = parseCsvLine(line, delimiter).map(c => String(c ?? '').trim());

      // New format (8 columns): ref,cipher,name,unit,qtyNorm,qtyProject,price,sum
      if (cols.length >= 8 && delimiter === ',') {
        const ref = String(cols[0] || '').trim();
        if (!isRef(ref)) continue; // skip section rows and headers

        // Skip header numeric helper row (1,2,3,...)
        if (ref === '1' && cols[1] === '2' && cols[2] === '3') continue;

        const cipher = String(cols[1] || '').trim();
        const name = String(cols[2] || '').trim();
        const unit = String(cols[3] || '').trim();
        const quantityNorm = parseNum(cols[4]);
        const quantity = parseNum(cols[5]);
        const price = parseNum(cols[6]);
        const total = cols[7] !== '' ? parseNum(cols[7]) : (quantity * price);

        if (!name) continue;
        parsedItems.push({
          ref,
          cipher,
          name,
          unit,
          quantityNorm,
          quantity,
          price,
          total
        });
        continue;
      }

      // Legacy semicolon format (6 columns): ref,type,name,unit,quantity,price
      if (cols.length >= 6) {
        const ref = String(cols[0] || '').trim();
        if (!isRef(ref)) continue;

        const type = String(cols[1] || '').trim();
        if (!type || type.includes('Тип ресурса')) continue;

        const name = String(cols[2] || '').trim();
        const unit = String(cols[3] || '').trim();
        const quantity = parseNum(cols[4]);
        const price = parseNum(cols[5]);
        const total = quantity * price;

        if (!name) continue;
        parsedItems.push({
          ref,
          type,
          name,
          unit,
          quantity,
          price,
          total
        });
      }
    }

    // Compute totalPrice (avoid double counting when both work and resources have totals)
    const workLines = parsedItems.filter(it => typeof it.ref === 'string' && /^\d+$/.test(it.ref));
    const workSum = workLines.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
    const anyWorkHasTotal = workLines.some(it => (Number(it.total) || 0) > 0);
    totalPrice = anyWorkHasTotal ? workSum : parsedItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0);

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
    logger.error('CSV Upload error:', error);
    res.status(500).json({ error: 'Failed to process CSV' });
  }
});


// ==========================================
// POST /api/tenders/invites/:token/offer/preview
// Preview subcontractor offer CSV with side-by-side mapping data
// Strict: expects the 8-column estimate CSV format (comma-separated)
// ==========================================
router.post('/invites/:token/offer/preview', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code } = req.body;

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      include: { tender: true }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const parseNum = (v: any) => {
      if (v == null) return 0;
      const cleaned = String(v)
        .trim()
        .replace(/[\s\u00A0]/g, '')
        .replace(',', '.');
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    const parseCsvLine = (line: string, delimiter: string) => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            const next = line[i + 1];
            if (next === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            cur += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === delimiter) {
            out.push(cur);
            cur = '';
          } else {
            cur += ch;
          }
        }
      }
      out.push(cur);
      return out;
    };

    const isRef = (v: any) => {
      const s = String(v || '').trim();
      return /^\d+(\.\d+)?$/.test(s);
    };

    const normStr = (v: any) => String(v ?? '').trim().replace(/[\s\u00A0]/g, '').toUpperCase();

    // Build expected rows from tender items + workType/resources
    const tenderItems = JSON.parse(invite.tender.items || '[]');
    const workTypeIds = tenderItems.map((it: any) => it.workTypeId).filter(Boolean);
    const workTypes = await prisma.workType.findMany({
      where: { id: { in: workTypeIds } },
      include: {
        stage: true,
        resources: { orderBy: { orderIndex: 'asc' } }
      },
      orderBy: { orderIndex: 'asc' }
    });

    const tenderItemByWorkTypeId = new Map<string, any>();
    tenderItems.forEach((it: any) => {
      if (it?.workTypeId) tenderItemByWorkTypeId.set(String(it.workTypeId), it);
    });

    // Group workTypes by stage order for stable numbering
    const stagesMap = new Map<string, { stageOrder: number; name: string; works: any[] }>();
    workTypes.forEach((wt: any) => {
      const stId = String(wt.stageId);
      if (!stagesMap.has(stId)) {
        stagesMap.set(stId, {
          stageOrder: Number(wt.stage?.orderIndex ?? 0),
          name: String(wt.stage?.name || 'Этап'),
          works: []
        });
      }
      stagesMap.get(stId)!.works.push(wt);
    });

    const stagesOrdered = Array.from(stagesMap.entries()).sort((a, b) => {
      const ao = a[1].stageOrder;
      const bo = b[1].stageOrder;
      if (ao !== bo) return ao - bo;
      return a[1].name.localeCompare(b[1].name, 'ru');
    });

    const expectedRows: any[] = [];
    let counter = 1;
    for (const [, stage] of stagesOrdered) {
      const worksOrdered = (stage.works || []).slice().sort((a: any, b: any) => {
        const ao = Number(a.orderIndex ?? 0);
        const bo = Number(b.orderIndex ?? 0);
        if (ao !== bo) return ao - bo;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      });

      worksOrdered.forEach((wt: any) => {
        const ti = tenderItemByWorkTypeId.get(String(wt.id));
        const workCipher = String(ti?.itemCode || ti?.cipher || wt.cipher || wt.code || '');
        const workName = String(ti?.name || wt.name || '');
        const workUnit = String(ti?.unit || wt.unit || '');
        const workQtyProject = parseNum(ti?.quantity ?? ti?.volume ?? wt.quantity ?? 0);

        expectedRows.push({
          ref: String(counter),
          cipher: workCipher,
          name: workName,
          unit: workUnit,
          quantityNorm: 0,
          quantity: workQtyProject,
          level: 'work'
        });

        (wt.resources || []).forEach((r: any, idx: number) => {
          expectedRows.push({
            ref: `${counter}.${idx + 1}`,
            cipher: String(r.cipher || r.code || ''),
            name: String(r.name || ''),
            unit: String(r.unit || ''),
            quantityNorm: parseNum(r.normPerUnit ?? 0),
            quantity: parseNum(r.quantity ?? 0),
            level: 'resource'
          });
        });

        counter++;
      });
    }

    // Parse uploaded rows (strict 8-col comma CSV)
    const csvContent = fs.readFileSync(req.file.path, 'utf-8');
    const lines = csvContent.split(/\r?\n/);
    const uploadedRows: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw) continue;
      const line = raw.trim();
      if (!line) continue;

      // Strict: comma format
      const cols = parseCsvLine(line, ',').map(c => String(c ?? '').trim());
      if (cols.length < 8) continue;

      const ref = String(cols[0] || '').trim();
      if (!isRef(ref)) continue;

      // skip header numeric helper row
      if (ref === '1' && cols[1] === '2' && cols[2] === '3') continue;

      const cipher = String(cols[1] || '').trim();
      const name = String(cols[2] || '').trim();
      const unit = String(cols[3] || '').trim();
      const quantityNorm = parseNum(cols[4]);
      const quantity = parseNum(cols[5]);
      const price = parseNum(cols[6]);
      const total = cols[7] !== '' ? parseNum(cols[7]) : (quantity * price);

      if (!name) continue;
      uploadedRows.push({ ref, cipher, name, unit, quantityNorm, quantity, price, total });
    }

    const expectedByRef = new Map<string, any>();
    expectedRows.forEach(r => expectedByRef.set(String(r.ref), r));
    const uploadedByRef = new Map<string, any>();
    uploadedRows.forEach(r => uploadedByRef.set(String(r.ref), r));

    const matches: any[] = [];
    let okCount = 0;
    let conflictCount = 0;
    let missingCount = 0;
    let extraCount = 0;

    for (const [ref, exp] of expectedByRef.entries()) {
      const up = uploadedByRef.get(ref);
      if (!up) {
        missingCount++;
        matches.push({ ref, status: 'missing', issues: ['Строка отсутствует в загруженном файле'] });
        continue;
      }

      const issues: string[] = [];
      if (normStr(exp.cipher) !== normStr(up.cipher)) issues.push('Шифр не совпадает');
      if (normStr(exp.unit) !== normStr(up.unit)) issues.push('Ед.изм не совпадает');

      // qty project validation with tolerance
      const tol = 1e-6;
      const eqQty = Math.abs((Number(exp.quantity) || 0) - (Number(up.quantity) || 0)) <= tol;
      if (!eqQty) issues.push('Кол-во (по проекту) не совпадает');

      if (issues.length > 0) {
        conflictCount++;
        matches.push({ ref, status: 'conflict', issues });
      } else {
        okCount++;
        matches.push({ ref, status: 'ok', issues: [] });
      }
    }

    // extras in upload
    for (const ref of uploadedByRef.keys()) {
      if (!expectedByRef.has(ref)) {
        extraCount++;
      }
    }

    res.json({
      success: true,
      expectedRows,
      uploadedRows,
      matches,
      summary: { okCount, conflictCount, missingCount, extraCount, expectedCount: expectedRows.length, uploadedCount: uploadedRows.length }
    });
  } catch (error) {
    logger.error('Offer preview error:', error);
    res.status(500).json({ error: 'Failed to preview offer CSV' });
  }
});


// ==========================================
// POST /api/tenders/invites/:token/offer/apply
// Apply parsed offer rows (prices/totals) after preview
// ==========================================
router.post('/invites/:token/offer/apply', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code, rows } = req.body || {};

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      include: { tender: true }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });

    const parseNum = (v: any) => {
      if (v == null) return 0;
      const cleaned = String(v)
        .trim()
        .replace(/[\s\u00A0]/g, '')
        .replace(',', '.');
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    // Keep only ref + pricing fields
    const cleanedRows = rows
      .map((r: any) => ({
        ref: String(r?.ref || '').trim(),
        cipher: r?.cipher != null ? String(r.cipher) : undefined,
        name: r?.name != null ? String(r.name) : undefined,
        unit: r?.unit != null ? String(r.unit) : undefined,
        quantityNorm: r?.quantityNorm != null ? parseNum(r.quantityNorm) : undefined,
        quantity: r?.quantity != null ? parseNum(r.quantity) : undefined,
        price: parseNum(r?.price),
        total: parseNum(r?.total)
      }))
      .filter((r: any) => r.ref && /^\d+(\.\d+)?$/.test(r.ref));

    // Compute totals: prefer top-level rows (no dot) if present
    const topLevel = cleanedRows.filter((r: any) => /^\d+$/.test(r.ref));
    const anyTopHasTotal = topLevel.some((r: any) => (Number(r.total) || 0) > 0);
    const totalPrice = anyTopHasTotal
      ? topLevel.reduce((acc: number, r: any) => acc + (Number(r.total) || 0), 0)
      : cleanedRows.reduce((acc: number, r: any) => acc + (Number(r.total) || 0), 0);

    const bidData = {
      priceTotal: totalPrice,
      items: JSON.stringify(cleanedRows),
      status: 'parsed',
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

    res.json({ success: true, totalPrice });
  } catch (error) {
    logger.error('Offer apply error:', error);
    res.status(500).json({ error: 'Failed to apply offer' });
  }
});


// ==========================================
// POST /api/tenders/invites/:token/offer/reset
// Reset offer back to baseline (no prices)
// ==========================================
router.post('/invites/:token/offer/reset', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code } = req.body || {};

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      include: { bid: true }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });

    if (invite.bid) {
      await prisma.tenderBid.update({
        where: { id: invite.bid.id },
        data: {
          priceTotal: 0,
          items: '[]',
          status: 'login'
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Offer reset error:', error);
    res.status(500).json({ error: 'Failed to reset offer' });
  }
});


// ==========================================
// Tender Chat (DB-backed)
// ==========================================
const MAX_CHAT_TEXT_LENGTH = 4000;

const normalizeChatText = (value: any) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > MAX_CHAT_TEXT_LENGTH ? text.slice(0, MAX_CHAT_TEXT_LENGTH) : text;
};

const getOrCreateChatThread = async (tenderId: string, subcontractorId: string) => {
  return prisma.tenderChatThread.upsert({
    where: {
      tenderId_subcontractorId: {
        tenderId,
        subcontractorId
      }
    },
    update: {},
    create: { tenderId, subcontractorId }
  });
};

// ------------------------------------------
// Admin: unread summary per lot
// GET /api/tenders/:id/chat/unread-summary
// ------------------------------------------
router.get('/:id/chat/unread-summary', async (req: Request, res: Response) => {
  try {
    const { id: tenderId } = req.params;

    const threads = await prisma.tenderChatThread.findMany({
      where: { tenderId },
      include: {
        subcontractor: { select: { id: true, company: true, firstName: true, lastName: true } }
      }
    });

    if (!threads.length) {
      return res.json({ totalUnread: 0, bySubcontractor: [], threads: [] });
    }

    const counts = await prisma.tenderChatMessage.groupBy({
      by: ['threadId'],
      where: {
        sender: 'SUBCONTRACTOR',
        readByAdminAt: null,
        thread: { tenderId }
      },
      _count: { _all: true }
    });

    const countByThreadId = new Map<string, number>();
    counts.forEach((c: any) => {
      countByThreadId.set(String(c.threadId), Number(c._count?._all || 0));
    });

    const threadIds = threads.map((t) => String(t.id));
    const lastMessages = threadIds.length
      ? await prisma.tenderChatMessage.findMany({
          where: { threadId: { in: threadIds } },
          orderBy: { createdAt: 'desc' },
          take: Math.min(5000, Math.max(100, threadIds.length * 5))
        })
      : [];

    const lastByThreadId = new Map<string, { sender: string; text: string; createdAt: Date }>();
    for (const m of lastMessages) {
      const threadKey = String(m.threadId);
      if (!lastByThreadId.has(threadKey)) {
        lastByThreadId.set(threadKey, {
          sender: String(m.sender || ''),
          text: String(m.text || ''),
          createdAt: m.createdAt
        });
      }
    }

    const threadsSummary = threads.map((t) => {
      const name = t.subcontractor?.company
        || [t.subcontractor?.firstName, t.subcontractor?.lastName].filter(Boolean).join(' ')
        || 'Субподрядчик';

      const unread = countByThreadId.get(t.id) || 0;
      const last = lastByThreadId.get(String(t.id)) || null;

      return {
        subcontractorId: t.subcontractorId,
        subcontractorName: name,
        unreadCount: unread,
        lastMessageAt: last?.createdAt || null,
        lastMessageText: last?.text || null,
        lastSender: last?.sender || null
      };
    });

    const bySubcontractor = threadsSummary
      .filter((x) => (x.unreadCount || 0) > 0)
      .map((x) => ({
        subcontractorId: x.subcontractorId,
        subcontractorName: x.subcontractorName,
        count: x.unreadCount
      }));

    const totalUnread = bySubcontractor.reduce((acc, x) => acc + (x.count || 0), 0);
    res.json({ totalUnread, bySubcontractor, threads: threadsSummary });
  } catch (error) {
    logger.error('Tender chat unread-summary error:', error);
    res.status(500).json({ error: 'Failed to get unread summary' });
  }
});

// ------------------------------------------
// Admin: fetch messages for tender + subcontractor
// GET /api/tenders/:id/chat/:subcontractorId
// ------------------------------------------
router.get('/:id/chat/:subcontractorId', async (req: Request, res: Response) => {
  try {
    const { id: tenderId, subcontractorId } = req.params;

    if (!subcontractorId) return res.status(400).json({ error: 'subcontractorId is required' });

    const thread = await getOrCreateChatThread(String(tenderId), String(subcontractorId));
    const messages = await prisma.tenderChatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
      take: 500
    });

    res.json({
      threadId: thread.id,
      tenderId,
      subcontractorId,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt
      }))
    });
  } catch (error) {
    logger.error('Tender chat get messages (admin) error:', error);
    res.status(500).json({ error: 'Failed to get chat messages' });
  }
});

// ------------------------------------------
// Admin: send message
// POST /api/tenders/:id/chat/:subcontractorId
// body: { text }
// ------------------------------------------
router.post('/:id/chat/:subcontractorId', async (req: Request, res: Response) => {
  try {
    const { id: tenderId, subcontractorId } = req.params;
    const text = normalizeChatText(req.body?.text);

    if (!subcontractorId) return res.status(400).json({ error: 'subcontractorId is required' });
    if (!text) return res.status(400).json({ error: 'text is required' });

    const thread = await getOrCreateChatThread(String(tenderId), String(subcontractorId));
    const now = new Date();

    const msg = await prisma.tenderChatMessage.create({
      data: {
        threadId: thread.id,
        sender: 'ADMIN',
        text,
        readByAdminAt: now,
        readBySubcontractorAt: null
      }
    });

    res.status(201).json({
      id: msg.id,
      sender: msg.sender,
      text: msg.text,
      createdAt: msg.createdAt
    });
  } catch (error) {
    logger.error('Tender chat send message (admin) error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ------------------------------------------
// Admin: mark read
// POST /api/tenders/:id/chat/:subcontractorId/read
// ------------------------------------------
router.post('/:id/chat/:subcontractorId/read', async (req: Request, res: Response) => {
  try {
    const { id: tenderId, subcontractorId } = req.params;

    const thread = await getOrCreateChatThread(String(tenderId), String(subcontractorId));
    const now = new Date();

    const updated = await prisma.tenderChatMessage.updateMany({
      where: {
        threadId: thread.id,
        sender: 'SUBCONTRACTOR',
        readByAdminAt: null
      },
      data: { readByAdminAt: now }
    });

    res.json({ success: true, updated: updated.count });
  } catch (error) {
    logger.error('Tender chat mark read (admin) error:', error);
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// ------------------------------------------
// Subcontractor: fetch messages by invite token
// GET /api/tenders/invites/:token/chat?code=XXXX
// ------------------------------------------
router.get('/invites/:token/chat', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code } = req.query;

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      include: {
        tender: { select: { id: true, name: true } },
        subcontractor: { select: { id: true, company: true } }
      }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });

    const thread = await getOrCreateChatThread(invite.tenderId, invite.subcontractorId);
    const messages = await prisma.tenderChatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
      take: 500
    });

    res.json({
      threadId: thread.id,
      tenderId: invite.tenderId,
      tenderName: invite.tender?.name || null,
      subcontractorId: invite.subcontractorId,
      subcontractorName: invite.subcontractor?.company || null,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt
      }))
    });
  } catch (error) {
    logger.error('Tender chat get messages (sub) error:', error);
    res.status(500).json({ error: 'Failed to get chat messages' });
  }
});

// ------------------------------------------
// Subcontractor: send message
// POST /api/tenders/invites/:token/chat
// body: { code, text }
// ------------------------------------------
router.post('/invites/:token/chat', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code } = req.body || {};
    const text = normalizeChatText(req.body?.text);

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      select: { id: true, tenderId: true, subcontractorId: true, inviteCode: true }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });
    if (!text) return res.status(400).json({ error: 'text is required' });

    const thread = await getOrCreateChatThread(invite.tenderId, invite.subcontractorId);
    const now = new Date();

    const msg = await prisma.tenderChatMessage.create({
      data: {
        threadId: thread.id,
        sender: 'SUBCONTRACTOR',
        text,
        readByAdminAt: null,
        readBySubcontractorAt: now
      }
    });

    res.status(201).json({
      id: msg.id,
      sender: msg.sender,
      text: msg.text,
      createdAt: msg.createdAt
    });
  } catch (error) {
    logger.error('Tender chat send message (sub) error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ------------------------------------------
// Subcontractor: mark read
// POST /api/tenders/invites/:token/chat/read
// body: { code }
// ------------------------------------------
router.post('/invites/:token/chat/read', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { code } = req.body || {};

    const invite = await prisma.tenderInvite.findUnique({
      where: { token },
      select: { tenderId: true, subcontractorId: true, inviteCode: true }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.inviteCode !== code) return res.status(401).json({ error: 'Unauthorized' });

    const thread = await getOrCreateChatThread(invite.tenderId, invite.subcontractorId);
    const now = new Date();

    const updated = await prisma.tenderChatMessage.updateMany({
      where: {
        threadId: thread.id,
        sender: 'ADMIN',
        readBySubcontractorAt: null
      },
      data: { readBySubcontractorAt: now }
    });

    res.json({ success: true, updated: updated.count });
  } catch (error) {
    logger.error('Tender chat mark read (sub) error:', error);
    res.status(500).json({ error: 'Failed to mark read' });
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
    logger.error('Error fetching tender:', error);
    res.status(500).json({ error: 'Failed to fetch tender' });
  }
});

export default router;

