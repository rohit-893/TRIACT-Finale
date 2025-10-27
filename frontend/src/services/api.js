import axios from "axios";

// 1. Use the VITE_ environment variable for production
// 2. Fall back to "/" for local development (to keep using your proxy)
const API_URL = import.meta.env.VITE_API_BASE_URL || "/";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Function to set the JWT token in the headers for all subsequent requests
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

export default api;
