import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { jwtDecode } from "jwt-decode";
import { setAuthToken } from "../services/api.js";
import authService from "../services/authService.js";
import shopService from "../services/shopService.js";

const AuthContext = createContext();

const CHAT_STORAGE_KEY = "triactAiChatHistory";

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [shopDetails, setShopDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDataFromToken = useCallback(async (authToken) => {
    try {
      const decodedUser = jwtDecode(authToken);
      const currentTime = Date.now() / 1000;
      if (decodedUser.exp > currentTime) {
        setAuthToken(authToken);
        setUser(decodedUser);
        if (decodedUser.shopId) {
          const details = await shopService.getShopDetails(decodedUser.shopId);
          setShopDetails(details);
        } else {
          setShopDetails(null); // Explicitly clear shop details if no shopId
        }
      } else {
        // Token expired
        localStorage.removeItem("token");
        localStorage.removeItem(CHAT_STORAGE_KEY); // Also clear chat if token expires
        setToken(null);
        setUser(null);
        setShopDetails(null);
        setAuthToken(null);
      }
    } catch (error) {
      console.error("Error loading data from token:", error);
      localStorage.removeItem("token");
      localStorage.removeItem(CHAT_STORAGE_KEY); // Clear chat on error too
      setToken(null);
      setUser(null);
      setShopDetails(null);
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken); // Set token state
      loadDataFromToken(storedToken); // Then load data
    } else {
      setLoading(false); // No token, finish loading
    }
  }, [loadDataFromToken]);

  const login = async (email, password) => {
    // --- ADD LOG ---
    console.log("Attempting login...");
    try { // Add try block if not already present around the whole function
      const { token: newToken } = await authService.login(email, password);

      // --- ADD LOG ---
      console.log("Login successful, received token:", newToken);

      if (newToken) { // Add a check to ensure token exists
        localStorage.setItem("token", newToken);

        // --- ADD LOG ---
        console.log("Token saved to localStorage. Checking storage:", localStorage.getItem("token"));

        setToken(newToken); // Update state
        await loadDataFromToken(newToken); // Load user data (this might still fail due to CORS on shop details)

         // --- ADD LOG ---
         console.log("User data loaded after setting token.");

      } else {
         // --- ADD LOG ---
         console.error("Login succeeded but no token received!");
         throw new Error("No token received from server.");
      }
    } catch (error) {
       // --- ADD LOG ---
       console.error("Error during login process:", error);
       // Re-throw the error so the calling component (Login.jsx) can catch it
       throw error;
    }
    // const { token: newToken } = await authService.login(email, password);
    // localStorage.setItem("token", newToken);
    // setToken(newToken);
    // await loadDataFromToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    // --- ADD THIS LINE ---
    localStorage.removeItem(CHAT_STORAGE_KEY); // Clear AI chat history on logout
    // --------------------
    setToken(null);
    setUser(null);
    setShopDetails(null);
    setAuthToken(null); // Clear token from API headers
  };

  // Memoize context value to prevent unnecessary re-renders
  const authContextValue = useMemo(
    () => ({
      user,
      token,
      shopDetails,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      setShopDetails, // Keep this if needed elsewhere
    }),
    [user, token, shopDetails, loading] // Dependencies for memoization
  );

  return (
    <AuthContext.Provider value={authContextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
