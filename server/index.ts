import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { ENV } from './env';
import { api } from './routes';

const app = express();
app.use(express.json({ limit: '12mb' })); // images arrive as JSON base64 for OCR

// tiny request log
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.path}`);
  next();
});

app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }));

// In production also serve the built SPA (single-port deploy)
const dist = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) return res.sendFile(path.join(dist, 'index.html'));
    next();
  });
}

// centralized error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API error:', err.message);
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message, details: err.details });
});

app.listen(ENV.PORT, '0.0.0.0', () => {
  console.log(`MarginMind API listening on http://0.0.0.0:${ENV.PORT}`);
  console.log(`DB: ${ENV.DATABASE_FILE} · LLM extraction: ${ENV.OPENAI_API_KEY ? 'enabled (' + ENV.OPENAI_MODEL + ')' : 'not configured (rule parser active)'}`);
});
