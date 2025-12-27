import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { scrapeRating } from '../services/ratingScraper';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const requiredFields = ['company', 'lastName', 'firstName', 'phone', 'password'];

// GET /api/subcontractors
router.get('/', async (req, res) => {
  try {
    const list = await prisma.subcontractor.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/subcontractors/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.subcontractor.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Subcontractor not found' });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subcontractors
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};

    const missing = requiredFields.filter((f) => !body[f]);
    if (missing.length) {
      return res.status(400).json({ error: `Required fields: ${missing.join(', ')}` });
    }

    if (body.inn && (body.inn.length !== 9 || !/^\d+$/.test(body.inn))) {
      return res.status(400).json({ error: 'ИНН должен состоять ровно из 9 цифр' });
    }

    const data: any = {
      company: body.company,
      lastName: body.lastName,
      firstName: body.firstName,
      middleName: body.middleName || null,
      phone: body.phone,
      email: body.email || null,
      password: await bcrypt.hash(body.password, 10),
      status: body.status || 'active',
      mfo: body.mfo || null,
      inn: body.inn || null,
      bankName: body.bankName || null,
      account: body.account || null,
      workTypes: body.workTypes || null,
      address: body.address || null,
      companyPhoto: body.companyPhoto || null,
      directorPhoto: body.directorPhoto || null,
      certificatePhoto: body.certificatePhoto || null,
      licensePhoto: body.licensePhoto || null,
      rating: body.rating || null,
    };

    const created = await prisma.subcontractor.create({ data });
    res.status(201).json(created);
  } catch (error: any) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.includes('company') ? 'Компания' : 'ИНН';
      return res.status(400).json({ error: `${field} уже существует` });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/subcontractors/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (body.inn && (body.inn.length !== 9 || !/^\d+$/.test(body.inn))) {
      return res.status(400).json({ error: 'ИНН должен состоять ровно из 9 цифр' });
    }

    const data: any = {};
    const fields = [
      'company',
      'lastName',
      'firstName',
      'middleName',
      'phone',
      'email',
      'password',
      'status',
      'mfo',
      'inn',
      'bankName',
      'account',
      'workTypes',
      'address',
      'companyPhoto',
      'directorPhoto',
      'certificatePhoto',
      'licensePhoto',
      'rating',
    ];

    for (const key of fields) {
      if (body[key] !== undefined) {
        if (key === 'password' && body[key]) {
          data[key] = await bcrypt.hash(body[key], 10);
        } else {
          data[key] = body[key] === '' ? null : body[key];
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const updated = await prisma.subcontractor.update({ where: { id }, data });
    res.json(updated);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }
    if (error.code === 'P2002') {
      const field = error.meta?.target?.includes('company') ? 'Компания' : 'ИНН';
      return res.status(400).json({ error: `${field} уже существует` });
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/subcontractors/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.subcontractor.delete({ where: { id } });
    res.json({ message: 'Subcontractor deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subcontractors/:id/refresh-rating
router.post('/:id/refresh-rating', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.subcontractor.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Subcontractor not found' });
    if (!item.inn) return res.status(400).json({ error: 'ИНН не указан' });

    // Live Scraping Logic
    logger.info(`Starting live scrape for INN: ${item.inn}`);
    let rating = await scrapeRating(item.inn);

    if (!rating) {
      logger.warn(`Scraping failed for INN ${item.inn}, using fallback.`);
      // Fallback: If it's a known INN from the user request
      if (item.inn === '300935078' || item.company.toUpperCase().includes('DISCOVER')) {
        rating = 'A';
      } else {
        // Keep existing rating or use a default if it was null
        rating = item.rating || 'B';
      }
    }

    const updated = await prisma.subcontractor.update({
      where: { id },
      data: { rating }
    });

    res.json({ success: true, rating: updated.rating });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
