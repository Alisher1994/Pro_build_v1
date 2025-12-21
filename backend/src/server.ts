import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

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
import normsRoutes from './routes/norms';
import workTypeGroupRoutes from './routes/workTypeGroups';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
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

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/work-types', workTypeRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/supplies', supplyRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/gantt', ganttRoutes);
app.use('/api/instructions', instructionRoutes);
app.use('/api/norms', normsRoutes);
app.use('/api/work-type-groups', workTypeGroupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ProBIM API is running' });
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
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Start server
const portNumber = Number(PORT);
app.listen(portNumber, '0.0.0.0', () => {
  console.log(`🚀 ProBIM Server running on http://0.0.0.0:${portNumber}`);
  console.log(`📊 API available at http://0.0.0.0:${portNumber}/api`);
});

export default app;
