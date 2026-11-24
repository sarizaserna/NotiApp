// backend/src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import pool from './config/db.js';

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.resolve(
  process.env.UPLOADS_DIR || path.join(__dirname, '../uploads')
);

const origenesPermitidos = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      origenesPermitidos.includes('*') ||
      origenesPermitidos.includes(origin)
    ) {
      return callback(null, true);
    }

    return callback(new Error('Origen no permitido por CORS.'));
  }
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(uploadsDir));

app.get('/', (req, res) => {
  res.json({
    message: 'NotiApp Bogotá - API funcionando correctamente.'
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: 'La ruta solicitada no existe.'
  });
});

app.use((error, req, res, next) => {
  console.error('Error del servidor:', error.message);

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      message: 'El contenido JSON enviado no es válido.'
    });
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: 'El archivo supera el límite permitido de 15 MB.'
    });
  }

  if (error.message === 'Formato de archivo no permitido.') {
    return res.status(400).json({
      message: error.message
    });
  }

  return res.status(500).json({
    message: 'Ocurrió un error interno en el servidor.'
  });
});

const PORT = process.env.PORT || 4000;

const iniciarServidor = async () => {
  try {
    await pool.query('SELECT NOW()');

    console.log('Conexión con PostgreSQL verificada.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`NotiApp API ejecutándose en el puerto ${PORT}.`);
    });
  } catch (error) {
    console.error('No fue posible conectar con PostgreSQL:', error.message);
    process.exit(1);
  }
};

iniciarServidor();