// backend/src/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('Falta configurar JWT_SECRET en las variables de entorno.');
  }

  return secret;
};

export const verificarToken = (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Debes iniciar sesión para realizar esta operación.'
      });
    }

    const token = authorization.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token no proporcionado.' });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    req.user = {
      id: decoded.id,
      rol: decoded.rol
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Tu sesión no es válida o ha expirado. Inicia sesión nuevamente.'
    });
  }
};

export const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        message: 'No tienes permisos para realizar esta operación.'
      });
    }

    next();
  };
};