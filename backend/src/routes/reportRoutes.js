// backend/src/routes/reportRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import {
  getReports,
  getMisReportes,
  createReport,
  updateReportStatus
} from '../controllers/reportController.js';

import {
  verificarToken,
  permitirRoles
} from '../middleware/authMiddleware.js';

const router = express.Router();

const uploadsDir = process.env.UPLOADS_DIR || 'uploads';

fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadsDir);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const nombre = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    callback(null, nombre);
  }
});

const extensionesPermitidas = [
  '.jpg', '.jpeg', '.png', '.webp',
  '.mp4', '.mov', '.webm'
];

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const mimePermitidos = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm'
    ];

    if (
      extensionesPermitidas.includes(extension) &&
      mimePermitidos.includes(file.mimetype)
    ) {
      return callback(null, true);
    }

    callback(new Error('Formato de archivo no permitido.'));
  }
});

// Consulta pública: no necesita token.
router.get('/', getReports);

// Consulta privada: solo los reportes del usuario autenticado.
router.get('/mine', verificarToken, getMisReportes);

// Crear reporte: requiere iniciar sesión.
router.post(
  '/',
  verificarToken,
  upload.single('evidencia'),
  createReport
);

// Actualizar estados: solo entidad o administrador.
router.patch(
  '/:id/status',
  verificarToken,
  permitirRoles('entidad', 'administrador'),
  updateReportStatus
);

export default router;