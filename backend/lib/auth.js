// backend/lib/auth.js

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Please define the JWT_SECRET environment variable inside .env');
}

export const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const authMiddleware = (handler) => {
  return async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return handler(req, res);
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
};

export const ownerMiddleware = (handler) => {
  return authMiddleware(async (req, res) => {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Access denied. Owner only.' });
    }
    return handler(req, res);
  });
};
