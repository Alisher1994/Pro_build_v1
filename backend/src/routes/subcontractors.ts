import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const requiredFields = ['projectId', 'company', 'lastName', 'firstName', 'phone', 'password'];

// GET /api/subcontractors?projectId=...
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const list = await prisma.subcontractor.findMany({
      where: { projectId: String(projectId) },
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

    const data: any = {
      projectId: body.projectId,
      company: body.company,
      lastName: body.lastName,
      firstName: body.firstName,
      middleName: body.middleName || null,
      phone: body.phone,
      email: body.email || null,
      password: body.password,
      status: body.status || 'active',
      mfo: body.mfo || null,
      inn: body.inn || null,
      bankName: body.bankName || null,
      account: body.account || null,
      address: body.address || null,
      companyPhoto: body.companyPhoto || null,
      directorPhoto: body.directorPhoto || null,
    };

    const created = await prisma.subcontractor.create({ data });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/subcontractors/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const data: any = {};
    const fields = [
      'projectId',
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
      'address',
      'companyPhoto',
      'directorPhoto',
    ];

    fields.forEach((key) => {
      if (body[key] !== undefined) {
        data[key] = body[key] === '' ? null : body[key];
      }
    });

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const updated = await prisma.subcontractor.update({ where: { id }, data });
    res.json(updated);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Subcontractor not found' });
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

export default router;
