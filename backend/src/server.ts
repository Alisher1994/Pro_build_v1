// Last updated: 2025-12-25T05:06:00
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import logger from './utils/logger';

// Routes
import projectRoutes from './routes/projects';
import blockRoutes from './routes/blocks';
import estimateRoutes from './routes/estimates';
import sectionRoutes from './routes/sections';
import stageRoutes from './routes/stages';
import workTypeRoutes from './routes/workTypes';
import resourceRoutes from './routes/resources';
import scheduleRoutes from './routes/schedules';
import supplyRoutes from './routes/supplies';
import financeRoutes from './routes/finances';
import ganttRoutes from './routes/gantt';
import instructionRoutes from './routes/instructions';
import workTypeGroupRoutes from './routes/workTypeGroups';
import subcontractorRoutes from './routes/subcontractors';
import tenderRoutes from './routes/tenders';
import departmentRoutes from './routes/departments';
import positionRoutes from './routes/positions';
import employeeRoutes from './routes/employees';
import authRoutes from './routes/auth';
import monitoringRoutes from './routes/monitoring';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Minimal security headers without extra deps
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Allow embedding uploaded files (PDF/image) into the frontend modal; keep protection elsewhere
  if (!req.path.startsWith('/uploads')) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  next();
});

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (для загруженных IFC/XKT файлов)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve Frontend Static Files
// В продакшене (dist) и в разработке (src) путь к frontend одинаковый относительно __dirname (если структура сохраняется)
// backend/dist/server.js -> ../../frontend
// backend/src/server.ts -> ../../frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// API Routes - Protected
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/blocks', authMiddleware, blockRoutes);
app.use('/api/estimates', authMiddleware, estimateRoutes);
app.use('/api/sections', authMiddleware, sectionRoutes);
app.use('/api/stages', authMiddleware, stageRoutes);
app.use('/api/work-types', authMiddleware, workTypeRoutes);
app.use('/api/resources', authMiddleware, resourceRoutes);
app.use('/api/schedules', authMiddleware, scheduleRoutes);
app.use('/api/supplies', authMiddleware, supplyRoutes);
app.use('/api/finances', authMiddleware, financeRoutes);
app.use('/api/gantt', authMiddleware, ganttRoutes);
app.use('/api/instructions', authMiddleware, instructionRoutes);
app.use('/api/work-type-groups', authMiddleware, workTypeGroupRoutes);
app.use('/api/subcontractors', authMiddleware, subcontractorRoutes);
app.use('/api/departments', authMiddleware, departmentRoutes);
app.use('/api/positions', authMiddleware, positionRoutes);
app.use('/api/employees', authMiddleware, employeeRoutes);
app.use('/api/monitoring', authMiddleware, monitoringRoutes);

// API Routes - Public or with internal auth
app.use('/api/tenders', tenderRoutes); // Tender routes handle their own auth for subcontractors
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ProBIM API is running' });
});

// Proxy for external images to bypass CORS (for face recognition)
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) {
    res.status(400).send('URL is required');
    return;
  }
  try {
    const parsed = new URL(imageUrl);
    const host = parsed.hostname.toLowerCase();
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
    const isPrivate = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    if (isLocal || isPrivate) {
      res.status(400).send('Blocked host');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const maxBytes = 5 * 1024 * 1024; // 5MB guard
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
      res.status(413).send('Image too large');
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      res.status(413).send('Image too large');
      return;
    }

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    res.send(buffer);
  } catch (error: any) {
    logger.error(`Proxy error: ${error.message}`);
    if (error.name === 'AbortError') {
      res.status(504).send('Upstream timeout');
      return;
    }
    res.status(500).send('Error proxying image');
  }
});

// Frontend fallback (SPA support)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'API endpoint not found' });
    return;
  }
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Start server
const portNumber = Number(PORT);
app.listen(portNumber, '0.0.0.0', () => {
  logger.info(`🚀 ProBIM Server running on http://0.0.0.0:${portNumber}`);
  logger.info(`📊 API available at http://0.0.0.0:${portNumber}/api`);
  logger.info(`🔄 Routes reloaded at ${new Date().toISOString()}`);
});

export default app;
