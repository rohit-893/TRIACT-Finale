// backend/pages/api/auth/login.js

import connectDB from '../../../lib/db.js';
import User from '../../../models/User.js';
import { signToken } from '../../../lib/auth.js';
import handleCors from '../../../middleware/cors.js';

export default async function handler(req, res) {
  await handleCors(req, res);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  await connectDB();
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user);
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      shopId: user.shopId,
    };

    res.status(200).json({ 
      message: 'Logged in successfully', 
      token, 
      user: userResponse 
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
