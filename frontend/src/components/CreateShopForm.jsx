import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import { AlertCircle, CheckCircle } from "lucide-react"; // Import icons

const CreateShopForm = () => {
  const { user, token, logout } = useAuth();
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isShopCreated, setIsShopCreated] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    if (!shopName) {
      setError("Shop name is required.");
      setIsLoading(false);
      return;
    }
    try {
      await shopService.createShop(token, { shopName, address });
      setIsShopCreated(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create shop.");
    } finally {
      setIsLoading(false);
    }
  };

  // This is the "Success" screen after creation
  if (isShopCreated) {
    return (
      // --- FIX: Removed min-h-[80vh] and added h-full ---
      <div className="flex items-center justify-center h-full px-4">
        <div className="w-full max-w-md p-8 text-center bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="text-green-500 mx-auto mb-4">
            <CheckCircle className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Shop Created!
          </h2>
          <p className="text-gray-700 mb-4">
            Your shop <span className="font-semibold">"{shopName}"</span> is
            ready.
          </p>
          <p className="text-gray-500 mb-6 text-sm">
            Log out and log back in to access your new dashboard.
          </p>
          <button
            onClick={logout}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200"
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // This is the "Create Shop" form
  return (
    // --- FIX: Removed min-h-[80vh] and added h-full ---
    <div className="flex items-center justify-center h-full px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Welcome, {user.name}!
            </h2>
            <p className="text-gray-500 mt-2">
              You don’t have a shop yet. Create one to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="shopName"
                className="block text-sm font-medium text-gray-700"
              >
                Shop Name
              </label>
              <input
                id="shopName"
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="Enter your shop name"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="address"
                className="block text-sm font-medium text-gray-700"
              >
                Shop Address (Optional)
              </label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows="3"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="Enter your shop address"
                disabled={isLoading}
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:bg-gray-400"
            >
              {isLoading ? "Creating Shop..." : "Create My Shop"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateShopForm;
