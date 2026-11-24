// backend/src/controllers/reportController.js
import pool from '../config/db.js';
import crypto from 'crypto';

const TIPOS_PERMITIDOS = [
  'hueco_malla_vial',
  'alumbrado_publico',
  'semaforo_averiado',
  'parques_zonas_verdes',
  'alcantarillado_fuga'
];

const ESTADOS_PERMITIDOS = [
  'pendiente',
  'asignado',
  'en_proceso',
  'resuelto',
  'rechazado'
];

const normalizarTexto = (valor) => {
  if (typeof valor !== 'string') return '';
  return valor.trim();
};

const obtenerTipo = (valor) => {
  const tipo = normalizarTexto(valor).toLowerCase();

  const equivalencias = {
    'hueco': 'hueco_malla_vial',
    'malla vial': 'hueco_malla_vial',
    'huecos en la vía': 'hueco_malla_vial',
    'alumbrado público': 'alumbrado_publico',
    'semaforo': 'semaforo_averiado',
    'semáforo': 'semaforo_averiado',
    'parques': 'parques_zonas_verdes',
    'zonas verdes': 'parques_zonas_verdes',
    'alcantarillado': 'alcantarillado_fuga',
    'fuga de agua': 'alcantarillado_fuga'
  };

  return equivalencias[tipo] || tipo;
};

const obtenerCodigo = () => {
  return `REP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

const formatearReporte = (fila) => {
  const codigo = fila.codigo || fila.codigo_reporte || null;
  const tipo = fila.tipo || fila.categoria || null;
  const ubicacion = fila.ubicacion_texto || fila.direccion || '';

  return {
    id: fila.id,
    codigo,
    codigo_reporte: codigo,
    tipo,
    categoria: fila.categoria || tipo,
    titulo: fila.titulo || tipo,
    descripcion: fila.descripcion || '',
    ubicacion_texto: ubicacion,
    ubicacion,
    direccion: fila.direccion || ubicacion,
    latitud: fila.latitud === null ? null : Number(fila.latitud),
    longitud: fila.longitud === null ? null : Number(fila.longitud),
    url_imagen: fila.url_imagen,
    evidencia: fila.url_imagen,
    estado: fila.estado,
    prioridad: fila.prioridad,
    cuadrilla: fila.cuadrilla,
    observacion_tecnica: fila.observacion_tecnica,
    es_duplicado: fila.es_duplicado,
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en
  };
};

const consultaBase = `
  SELECT
    r.id,
    r.codigo,
    r.codigo_reporte,
    r.tipo,
    r.categoria,
    r.titulo,
    r.descripcion,
    r.ubicacion_texto,
    r.direccion,
    r.latitud,
    r.longitud,
    r.url_imagen,
    r.estado,
    r.prioridad,
    r.cuadrilla,
    r.observacion_tecnica,
    r.es_duplicado,
    r.creado_en,
    r.actualizado_en
  FROM reportes r
`;

// GET /api/reports
// Consulta pública. No devuelve datos personales del ciudadano.
export const getReports = async (req, res) => {
  try {
    const resultado = await pool.query(
      `${consultaBase}
       ORDER BY r.creado_en DESC`
    );

    return res.json({
      reports: resultado.rows.map(formatearReporte)
    });
  } catch (error) {
    console.error('Error consultando reportes:', error.message);

    return res.status(500).json({
      message: 'No fue posible consultar los reportes.'
    });
  }
};

// GET /api/reports/mine
// Consulta privada del ciudadano autenticado.
export const getMisReportes = async (req, res) => {
  try {
    const resultado = await pool.query(
      `${consultaBase}
       WHERE r.ciudadano_id = $1
       ORDER BY r.creado_en DESC`,
      [req.user.id]
    );

    return res.json({
      reports: resultado.rows.map(formatearReporte)
    });
  } catch (error) {
    console.error('Error consultando reportes del usuario:', error.message);

    return res.status(500).json({
      message: 'No fue posible consultar tus reportes.'
    });
  }
};

// POST /api/reports
// El ciudadano se toma exclusivamente del token, nunca del formulario.
export const createReport = async (req, res) => {
  try {
    const tipo = obtenerTipo(
      req.body.tipo ?? req.body.type ?? req.body.categoria
    );

    const descripcion = normalizarTexto(
      req.body.descripcion ?? req.body.description
    );

    const ubicacion = normalizarTexto(
      req.body.ubicacion_texto ??
      req.body.location ??
      req.body.direccion
    );

    const latitudTexto = req.body.latitud ?? req.body.lat;
    const longitudTexto = req.body.longitud ?? req.body.lng;

    const latitud = latitudTexto === undefined || latitudTexto === ''
      ? null
      : Number(latitudTexto);

    const longitud = longitudTexto === undefined || longitudTexto === ''
      ? null
      : Number(longitudTexto);

    if (!TIPOS_PERMITIDOS.includes(tipo)) {
      return res.status(400).json({
        message: 'El tipo de reporte seleccionado no es válido.'
      });
    }

    if (!descripcion || descripcion.length < 10) {
      return res.status(400).json({
        message: 'La descripción debe tener al menos 10 caracteres.'
      });
    }

    if (descripcion.length > 5000) {
      return res.status(400).json({
        message: 'La descripción es demasiado larga.'
      });
    }

    if (!ubicacion || ubicacion.length > 500) {
      return res.status(400).json({
        message: 'Debes indicar una ubicación válida.'
      });
    }

    if (
      latitud !== null &&
      (!Number.isFinite(latitud) || latitud < -90 || latitud > 90)
    ) {
      return res.status(400).json({
        message: 'La latitud no es válida.'
      });
    }

    if (
      longitud !== null &&
      (!Number.isFinite(longitud) || longitud < -180 || longitud > 180)
    ) {
      return res.status(400).json({
        message: 'La longitud no es válida.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: 'Debes adjuntar una fotografía o video como evidencia.'
      });
    }

    const codigo = obtenerCodigo();
    const urlImagen = `/uploads/${req.file.filename}`;

    const resultado = await pool.query(
      `INSERT INTO reportes (
        codigo,
        codigo_reporte,
        tipo,
        descripcion,
        ubicacion_texto,
        latitud,
        longitud,
        url_imagen,
        ciudadano_id
      )
      VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        codigo,
        codigo_reporte,
        tipo,
        categoria,
        titulo,
        descripcion,
        ubicacion_texto,
        direccion,
        latitud,
        longitud,
        url_imagen,
        estado,
        prioridad,
        cuadrilla,
        observacion_tecnica,
        es_duplicado,
        creado_en,
        actualizado_en`,
      [
        codigo,
        tipo,
        descripcion,
        ubicacion,
        latitud,
        longitud,
        urlImagen,
        req.user.id
      ]
    );

    return res.status(201).json({
      message: 'Reporte creado correctamente.',
      report: formatearReporte(resultado.rows[0])
    });
  } catch (error) {
    console.error('Error creando reporte:', error.message);

    if (error.code === '22P02') {
      return res.status(400).json({
        message: 'Uno de los valores enviados no es válido.'
      });
    }

    if (error.code === '23503') {
      return res.status(400).json({
        message: 'No se pudo asociar el reporte con tu cuenta.'
      });
    }

    return res.status(500).json({
      message: 'No fue posible crear el reporte.'
    });
  }
};

// PATCH /api/reports/:id/status
// La ruta ya exige rol entidad o administrador.
// Además, una entidad solo puede actualizar reportes de su entidad.
export const updateReportStatus = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const estado = normalizarTexto(
      req.body.estado ?? req.body.status
    ).toLowerCase();

    const observacion = normalizarTexto(
      req.body.observacion_tecnica ?? req.body.observacion ?? ''
    );

    const cuadrilla = normalizarTexto(req.body.cuadrilla ?? '');

    if (!id) {
      return res.status(400).json({
        message: 'Debes indicar el reporte que deseas actualizar.'
      });
    }

    if (!ESTADOS_PERMITIDOS.includes(estado)) {
      return res.status(400).json({
        message: 'El estado indicado no es válido.'
      });
    }

    let entidadId = null;

    if (req.user.rol === 'entidad') {
      const usuario = await pool.query(
        'SELECT entidad_id FROM usuarios WHERE id = $1 AND estado = $2',
        [req.user.id, 'activo']
      );

      if (
        usuario.rowCount === 0 ||
        usuario.rows[0].entidad_id === null
      ) {
        return res.status(403).json({
          message: 'Tu cuenta no tiene una entidad asignada.'
        });
      }

      entidadId = usuario.rows[0].entidad_id;
    }

    const esNumerico = /^\d+$/.test(id);

    const valores = [
      estado,
      cuadrilla || null,
      observacion || null
    ];

    let condicionIdentificador;
    if (esNumerico) {
      valores.push(id);
      condicionIdentificador = `id = $${valores.length}`;
    } else {
      valores.push(id);
      condicionIdentificador = `(codigo = $${valores.length} OR codigo_reporte = $${valores.length})`;
    }

    let condicionEntidad = '';
    if (entidadId !== null) {
      valores.push(entidadId);
      condicionEntidad = ` AND entidad_id = $${valores.length}`;
    }

    const resultado = await pool.query(
      `UPDATE reportes
       SET
         estado = $1::estado_reporte,
         cuadrilla = COALESCE($2, cuadrilla),
         observacion_tecnica = COALESCE($3, observacion_tecnica),
         actualizado_en = NOW()
       WHERE ${condicionIdentificador}${condicionEntidad}
       RETURNING
         id,
         codigo,
         codigo_reporte,
         tipo,
         categoria,
         titulo,
         descripcion,
         ubicacion_texto,
         direccion,
         latitud,
         longitud,
         url_imagen,
         estado,
         prioridad,
         cuadrilla,
         observacion_tecnica,
         es_duplicado,
         creado_en,
         actualizado_en`,
      valores
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        message: 'No se encontró el reporte o no pertenece a tu entidad.'
      });
    }

    return res.json({
      message: 'Estado del reporte actualizado correctamente.',
      report: formatearReporte(resultado.rows[0])
    });
  } catch (error) {
    console.error('Error actualizando reporte:', error.message);

    return res.status(500).json({
      message: 'No fue posible actualizar el estado del reporte.'
    });
  }
};