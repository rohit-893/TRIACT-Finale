// backend/middleware/cors.js
import Cors from 'cors';

const allowedOrigin = process.env.FRONTEND_URL || 'https://triact-frontend.vercel.app'; // Read from env var

const cors = Cors({
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  origin: allowedOrigin,
  credentials: true,
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handleCors(req, res) {
  await runMiddleware(req, res, cors);
}