// backend/middleware/cors.js
import Cors from 'cors';

// Initialize the cors middleware
// You can customize the options as needed
const cors = Cors({
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  origin: 'https://triact-frontend.vercel.app', // IMPORTANT: Use your frontend URL
  credentials: true, // Allows cookies and authorization headers
});

// Helper method to wait for a middleware to execute before continuing
// And to throw an error when an error happens in a middleware
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
  // Run the middleware
  await runMiddleware(req, res, cors);
}