import React, { useState, useEffect } from "react"; // <-- THIS LINE IS NOW FIXED
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import { Copy, Check, Store, AlertCircle, CheckCircle } from "lucide-react"; // Import icons

// Reusable input component
const FormInput = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  required = true,
  disabled = false,
}) => (
  <div className="space-y-2">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
    <input
      id={name}
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={`w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${
        disabled ? "bg-gray-100 cursor-not-allowed" : ""
      }`}
    />
  </div>
);

// Reusable textarea component
const FormTextarea = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
}) => (
  <div className="space-y-2">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      rows={rows}
      className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
      placeholder={placeholder}
    ></textarea>
  </div>
);

const ShopSettings = () => {
  const { user, shopDetails, setShopDetails } = useAuth();
  const [formData, setFormData] = useState({ shopName: "", address: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (shopDetails) {
      setFormData({
        shopName: shopDetails.shopName,
        address: shopDetails.address || "",
      });
    }
  }, [shopDetails]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setIsLoading(true);
    try {
      const updatedShop = await shopService.updateShopDetails(
        user.shopId,
        formData
      );
      setShopDetails(updatedShop); // Update the global context
      setMessage("Shop details updated successfully!");
    } catch (error) {
      setError("Failed to update shop details.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyShopId = () => {
    navigator.clipboard.writeText(user.shopId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!shopDetails) {
    return (
      <div className="text-center mt-10 text-gray-500">
        Loading shop settings...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center flex items-center justify-center gap-3">
        <Store size={30} className="text-indigo-600" />
        Shop Settings
      </h1>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="p-8 space-y-6">
            {message && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="text-green-600" size={20} />
                <p className="text-green-700 text-sm font-medium">{message}</p>
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="text-red-600" size={20} />
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            <FormInput
              label="Shop Name"
              name="shopName"
              value={formData.shopName}
              onChange={handleChange}
              required
            />

            <FormTextarea
              label="Shop Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter your shop address"
            />

            {/* Shop ID */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Your Shop ID (for employees)
              </label>
              <div className="flex rounded-lg shadow-sm border border-gray-300">
                <input
                  type="text"
                  readOnly
                  value={user.shopId}
                  className="flex-1 bg-gray-100 px-4 py-3 text-gray-600 focus:outline-none rounded-l-lg"
                />
                <button
                  type="button"
                  onClick={copyShopId}
                  className="flex items-center space-x-2 px-4 bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors rounded-r-lg"
                >
                  {isCopied ? (
                    <Check size={18} className="text-green-600" />
                  ) : (
                    <Copy size={18} />
                  )}
                  <span className="text-sm font-medium">
                    {isCopied ? "Copied!" : "Copy"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-6 border-t border-gray-200 text-right">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto bg-indigo-600 text-white py-3 px-8 rounded-lg hover:bg-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg disabled:bg-gray-400"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShopSettings;
