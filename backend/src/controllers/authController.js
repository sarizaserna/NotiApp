// backend/src/controllers/authController.js
import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const obtenerSecreto = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET no está configurado.');
  }

  return secret;
};

const generarToken = (usuario) => {
  return jwt.sign(
    {
      id: usuario.id,
      rol: usuario.rol
    },
    obtenerSecreto(),
    { expiresIn: '8h' }
  );
};

const formatearUsuario = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre_completo,
  email: usuario.correo,
  rol: usuario.rol,
  entidadId: usuario.entidad_id ?? null
});

export const registerUser = async (req, res) => {
  try {
    const nombre = String(
      req.body.nombre_completo ?? req.body.nombre ?? ''
    ).trim();

    const correo = String(
      req.body.correo ?? req.body.email ?? ''
    ).trim().toLowerCase();

    const password = req.body.password;

    if (!nombre || !correo || typeof password !== 'string') {
      return res.status(400).json({
        message: 'Nombre, correo y contraseña son obligatorios.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'La contraseña debe tener al menos 8 caracteres.'
      });
    }

    if (nombre.length > 150 || correo.length > 254) {
      return res.status(400).json({
        message: 'El nombre o el correo exceden la longitud permitida.'
      });
    }

    const existente = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(correo) = $1 LIMIT 1',
      [correo]
    );

    if (existente.rowCount > 0) {
      return res.status(409).json({
        message: 'Ya existe una cuenta registrada con ese correo.'
      });
    }

    const hash = await bcrypt.hash(password, 12);

    // El rol siempre se asigna en el servidor.
    const resultado = await pool.query(
      `INSERT INTO usuarios
        (nombre_completo, correo, contrasena_hash, rol, estado)
       VALUES ($1, $2, $3, 'ciudadano', 'activo')
       RETURNING id, nombre_completo, correo, rol, entidad_id`,
      [nombre, correo, hash]
    );

    const usuario = resultado.rows[0];
    const token = generarToken(usuario);

    return res.status(201).json({
      message: 'Cuenta creada correctamente.',
      token,
      user: formatearUsuario(usuario)
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'Ya existe una cuenta registrada con ese correo.'
      });
    }

    console.error('Error en registro:', error.message);

    return res.status(500).json({
      message: 'No fue posible crear la cuenta.'
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const correo = String(
      req.body.correo ?? req.body.email ?? ''
    ).trim().toLowerCase();

    const password = req.body.password;

    if (!correo || typeof password !== 'string' || !password) {
      return res.status(400).json({
        message: 'Debes ingresar tu correo y contraseña.'
      });
    }

    const resultado = await pool.query(
      `SELECT
         id,
         nombre_completo,
         correo,
         contrasena_hash,
         rol,
         entidad_id,
         estado
       FROM usuarios
       WHERE LOWER(correo) = $1
       LIMIT 1`,
      [correo]
    );

    if (resultado.rowCount === 0) {
      return res.status(401).json({
        message: 'Correo o contraseña incorrectos.'
      });
    }

    const usuario = resultado.rows[0];

    if (usuario.estado !== 'activo') {
      return res.status(403).json({
        message: 'Esta cuenta no está activa. Contacta al equipo de soporte.'
      });
    }

    if (!usuario.contrasena_hash) {
      return res.status(401).json({
        message: 'La cuenta no tiene una contraseña válida. Contacta al soporte.'
      });
    }

    const passwordValida = await bcrypt.compare(
      password,
      usuario.contrasena_hash
    );

    if (!passwordValida) {
      return res.status(401).json({
        message: 'Correo o contraseña incorrectos.'
      });
    }

    const token = generarToken(usuario);

    return res.status(200).json({
      message: 'Inicio de sesión correcto.',
      token,
      user: formatearUsuario(usuario)
    });
  } catch (error) {
    console.error('Error en inicio de sesión:', error.message);

    return res.status(500).json({
      message: 'No fue posible iniciar sesión.'
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre_completo, correo, rol, entidad_id, estado
       FROM usuarios
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        message: 'No se encontró el usuario.'
      });
    }

    const usuario = resultado.rows[0];

    if (usuario.estado !== 'activo') {
      return res.status(403).json({
        message: 'La cuenta no está activa.'
      });
    }

    return res.json({ user: formatearUsuario(usuario) });
  } catch (error) {
    console.error('Error consultando perfil:', error.message);

    return res.status(500).json({
      message: 'No fue posible consultar el perfil.'
    });
  }
};