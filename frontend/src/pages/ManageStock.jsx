// frontend/src/pages/ManageStock.jsx - UPDATED WITH BETTER NULL HANDLING

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import Modal from "../components/Modal";
import { 
  Search, 
  Filter, 
  Pencil, 
  Trash2, 
  Plus, 
  AlertTriangle,
  Package,
  TrendingUp
} from "lucide-react";

const LOW_STOCK_THRESHOLD = 10;

const ManageStock = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [showLowStock, setShowLowStock] = useState(false);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    cost: "",
    stock: "",
  });

  // Fetch products with forecast data
  const fetchProducts = useCallback(async () => {
    if (!user?.shopId) return;
    
    try {
      setLoading(true);
      console.log("Fetching forecast data for shop:", user.shopId);
      
      // Fetch forecast data
      const forecastData = await shopService.getForecast(user.shopId);
      console.log("Forecast data received:", forecastData);
      
      setProducts(forecastData || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching forecast:", err);
      console.error("Error response:", err.response?.data);
      setError("Failed to fetch product data.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Get unique categories
  const existingCategories = useMemo(() => {
    return [
      "All Categories",
      ...new Set(products.map((p) => p.category)),
    ].sort();
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) =>
        searchTerm
          ? p.name.toLowerCase().includes(searchTerm.toLowerCase())
          : true
      )
      .filter((p) =>
        selectedCategory !== "All Categories"
          ? p.category === selectedCategory
          : true
      )
      .filter((p) => (showLowStock ? p.stock <= LOW_STOCK_THRESHOLD : true));
  }, [products, searchTerm, selectedCategory, showLowStock]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount || 0);

  // Format forecast days - WITH BETTER NULL HANDLING
  const formatForecastDays = (days) => {
    if (days === undefined || days === null || isNaN(days)) return "No data";
    if (days === Infinity) return "Never";
    if (days < 0) return "Out of stock";
    if (days < 7) return `${Math.round(days)}d`;
    if (days < 30) return `${Math.round(days)}d`;
    if (days < 90) return `${Math.round(days / 7)}w`;
    return `${Math.round(days / 30)}m`;
  };

  // Get forecast color class - WITH BETTER NULL HANDLING
  const getForecastColorClass = (days) => {
    if (days === undefined || days === null || isNaN(days)) return "text-gray-400";
    if (days === Infinity) return "text-gray-400";
    if (days < 0) return "text-red-700 font-bold";
    if (days < 7) return "text-red-600 font-bold";
    if (days < 14) return "text-orange-600 font-semibold";
    if (days < 30) return "text-yellow-600";
    return "text-green-600";
  };

  // Format average daily sales - WITH BETTER NULL HANDLING
  const formatAvgSales = (avg) => {
    if (avg === undefined || avg === null || isNaN(avg)) return "0.00";
    return avg.toFixed(2);
  };

  const handleAdd = () => {
    setFormData({ name: "", category: "", price: "", cost: "", stock: "" });
    setIsAddModalOpen(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price,
      cost: product.cost,
      stock: product.stock,
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?"))
      return;
    
    try {
      await shopService.deleteProduct(user.shopId, productId);
      await fetchProducts();
    } catch (err) {
      alert("Failed to delete product.");
      console.error(err);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await shopService.addProduct(user.shopId, {
        ...formData,
        price: parseFloat(formData.price),
        cost: parseFloat(formData.cost),
        stock: parseInt(formData.stock, 10),
      });
      setIsAddModalOpen(false);
      await fetchProducts();
    } catch (err) {
      alert("Failed to add product.");
      console.error(err);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await shopService.updateProduct(user.shopId, editingProduct._id, {
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock, 10),
      });
      setIsEditModalOpen(false);
      setEditingProduct(null);
      await fetchProducts();
    } catch (err) {
      alert("Failed to update product.");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center mt-16 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 text-lg font-semibold">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-900">Stock Management</h1>
        {user?.role === "owner" && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-all duration-200"
          >
            <Plus size={20} />
            Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 font-semibold">
          <Filter size={20} />
          <span>Filters</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            {existingCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle */}
          <label className="flex items-center gap-3 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-700 font-medium">Show Low Stock Only</span>
          </label>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Product Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={16} />
                    AI Forecast
                  </div>
                </th>
                {user?.role === "owner" && (
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                // SAFELY ACCESS FORECAST DATA
                const forecastDays = product.forecast?.daysUntilStockOut;
                const avgSales = product.forecast?.averageDailySales;
                
                return (
                  <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                      {formatCurrency(product.price)}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                        product.stock <= (product.lowStockThreshold || LOW_STOCK_THRESHOLD)
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {product.stock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className={`font-semibold ${getForecastColorClass(forecastDays)}`}>
                          {formatForecastDays(forecastDays)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Avg: {formatAvgSales(avgSales)}/day
                        </div>
                      </div>
                    </td>
                    {user?.role === "owner" && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(product._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <Package className="mx-auto text-gray-300 mb-4" size={64} />
              <p className="text-gray-500 text-lg font-medium">
                No products found
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Try adjusting your filters
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Product"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Product Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <input
            type="text"
            placeholder="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Cost"
            value={formData.cost}
            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <input
            type="number"
            placeholder="Initial Stock"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-all duration-200"
          >
            Add Product
          </button>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProduct(null);
        }}
        title="Edit Product"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name (Read-only)
            </label>
            <input
              type="text"
              value={formData.name}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock
            </label>
            <input
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-all duration-200"
          >
            Update Product
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default ManageStock;
