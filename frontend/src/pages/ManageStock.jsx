import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import Modal from "../components/Modal.jsx";
import { Package, Search, Filter, Plus, Edit2, AlertTriangle, TrendingDown, BarChart3 } from "lucide-react";

const ManageStock = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [modalError, setModalError] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    price: "",
    cost: "",
    stock: "",
  });
  const [editFormData, setEditFormData] = useState({
    price: "",
    cost: "",
    stock: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [showLowStock, setShowLowStock] = useState(false);
  const LOW_STOCK_THRESHOLD = 10;

  const existingCategories = useMemo(() => {
    return [
      "All Categories",
      ...new Set(products.map((p) => p.category)),
    ].sort();
  }, [products]);

  const fetchProducts = useCallback(async () => {
    if (!user?.shopId) return;
    try {
      setLoading(true);
      const [productsData, forecastData] = await Promise.all([
        shopService.getProducts(user.shopId),
        shopService.getForecast(user.shopId),
      ]);

      const forecastMap = new Map(
        forecastData.map((p) => [p._id, p.forecast])
      );

      const mergedProducts = productsData.map((p) => ({
        ...p,
        forecast: forecastMap.get(p._id) || null,
      }));

      setProducts(mergedProducts);
    } catch (err) {
      setPageError("Failed to fetch products.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setModalError("");
    try {
      await shopService.addProduct(user.shopId, {
        ...newProduct,
        price: parseFloat(newProduct.price),
        cost: parseFloat(newProduct.cost),
        stock: parseInt(newProduct.stock, 10),
      });
      setIsAddModalOpen(false);
      setNewProduct({ name: "", category: "", price: "", cost: "", stock: "" });
      fetchProducts();
    } catch (err) {
      setModalError(err.response?.data?.message || "Failed to add product.");
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    setModalError("");
    const payload = { stock: parseInt(editFormData.stock, 10) };
    if (user.role === "owner") {
      payload.price = parseFloat(editFormData.price);
      payload.cost = parseFloat(editFormData.cost);
    }
    try {
      await shopService.updateProduct(user.shopId, selectedProduct._id, payload);
      setIsEditModalOpen(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (err) {
      setModalError(err.response?.data?.message || "Failed to update product.");
    }
  };

  const openEditModal = (product) => {
    setModalError("");
    setSelectedProduct(product);
    setEditFormData({
      price: product.price,
      cost: product.cost,
      stock: product.stock,
    });
    setIsEditModalOpen(true);
  };

  const openAddModal = () => {
    setModalError("");
    setNewProduct({ name: "", category: "", price: "", cost: "", stock: "" });
    setIsAddModalOpen(true);
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) =>
        searchTerm ? p.name.toLowerCase().includes(searchTerm.toLowerCase()) : true
      )
      .filter((p) =>
        selectedCategory !== "All Categories" ? p.category === selectedCategory : true
      )
      .filter((p) => (showLowStock ? p.stock < LOW_STOCK_THRESHOLD : true));
  }, [products, searchTerm, selectedCategory, showLowStock]);

  const stats = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter(p => p.stock < LOW_STOCK_THRESHOLD).length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const criticalStock = products.filter(p => p.stock < 5).length;
    return { total, lowStock, totalValue, criticalStock };
  }, [products]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-slate-700"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading stock & forecast...</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="mx-auto text-red-500 mb-4" size={64} />
        <p className="text-red-600 text-xl">{pageError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Add Product Modal */}
        <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Product">
          <form onSubmit={handleAddProduct} className="space-y-4">
            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                {modalError}
              </div>
            )}
            {["name", "category", "price", "cost", "stock"].map((field) => (
              <div key={field}>
                <label className="block text-sm font-semibold text-gray-700 mb-2 capitalize">
                  {field === "cost" ? "Cost (Purchase Price)" : field}
                </label>
                <input
                  type={field === "name" || field === "category" ? "text" : "number"}
                  step={field === "price" || field === "cost" ? "0.01" : undefined}
                  value={newProduct[field]}
                  onChange={(e) => setNewProduct({ ...newProduct, [field]: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all"
                />
              </div>
            ))}
            <button type="submit" className="w-full bg-slate-700 text-white py-3 rounded-lg hover:bg-slate-800 transition-all font-semibold shadow-md hover:shadow-lg">
              Add Product
            </button>
          </form>
        </Modal>

        {/* Edit Product Modal */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit: ${selectedProduct?.name}`}>
          <form onSubmit={handleEditProduct} className="space-y-4">
            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                {modalError}
              </div>
            )}
            {["price", "cost", "stock"].map((field) => (
              <div key={field}>
                <label className="block text-sm font-semibold text-grey-700 mb-2 capitalize">
                  {field === "cost" ? "Cost (Purchase Price)" : field}
                </label>
                <input
                  type="number"
                  step={field !== "stock" ? "0.01" : undefined}
                  value={editFormData[field]}
                  onChange={(e) => setEditFormData({ ...editFormData, [field]: e.target.value })}
                  required
                  disabled={user.role !== "owner" && field !== "stock"}
                  className={`w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all text-black ${
                    user.role !== "owner" && field !== "stock" ? "bg-gray-100 cursor-not-allowed" : ""
                  }`}
                />
              </div>
            ))}
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-all font-semibold shadow-md hover:shadow-lg">
              Save Changes
            </button>
          </form>
        </Modal>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Package className="text-slate-700" size={36} />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Stock Management</h1>
          </div>
          <p className="text-gray-600">Monitor inventory levels and forecasts</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-sm font-medium">Total Products</p>
              <Package className="text-slate-600" size={24} />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-sm font-medium">Low Stock Items</p>
              <AlertTriangle className="text-amber-600" size={24} />
            </div>
            <p className="text-3xl font-bold text-amber-600">{stats.lowStock}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-sm font-medium">Critical Stock</p>
              <TrendingDown className="text-red-600" size={24} />
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.criticalStock}</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-600 text-sm font-medium">Total Value</p>
              <BarChart3 className="text-emerald-600" size={24} />
            </div>
            <p className="text-3xl font-bold text-emerald-600">₹{stats.totalValue.toFixed(0)}</p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-12 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 appearance-none bg-white cursor-pointer min-w-[200px]"
              >
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Low Stock Filter */}
            <button
              onClick={() => setShowLowStock(!showLowStock)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-2 whitespace-nowrap ${
                showLowStock
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
              }`}
            >
              <AlertTriangle size={20} />
              {showLowStock ? "Low Stock Only" : "Show All"}
            </button>

            {/* Add Product Button */}
            <button
              onClick={openAddModal}
              className="bg-slate-700 text-white px-6 py-3 rounded-lg hover:bg-slate-800 shadow-md hover:shadow-lg transition-all font-semibold flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={20} />
              Add Product
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-700">
                <tr>
                  {["Product", "Category", "Price", "Cost", "Stock", "Forecast", "Actions"].map((header) => (
                    <th
                      key={header}
                      className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => {
                  const daysLeft = product.forecast?.daysUntilStockOut;
                  let forecastText = daysLeft === undefined ? "..." : daysLeft === Infinity ? "N/A" : Math.floor(daysLeft);
                  const isLowStock = product.stock < LOW_STOCK_THRESHOLD;
                  const isCritical = product.stock < 5;

                  return (
                    <tr
                      key={product._id}
                      className={`hover:bg-gray-50 transition-colors ${
                        isCritical ? "bg-red-50" : isLowStock ? "bg-amber-50" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {isCritical && <AlertTriangle className="text-red-600" size={18} />}
                          <span className="font-semibold text-gray-900">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full font-medium">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        ₹{(product.price || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-gray-600">₹{(product.cost || 0).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full font-bold text-sm ${
                            isCritical
                              ? "bg-red-100 text-red-700"
                              : isLowStock
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-bold ${
                              daysLeft < 14 && daysLeft !== Infinity ? "text-red-600" : "text-gray-700"
                            }`}
                          >
                            {forecastText}
                            {daysLeft !== undefined && daysLeft !== Infinity && " days"}
                          </span>
                          {daysLeft !== undefined && daysLeft !== Infinity && (
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  daysLeft < 7
                                    ? "bg-red-500"
                                    : daysLeft < 14
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                                style={{ width: `${Math.min(daysLeft / 30, 1) * 100}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => openEditModal(product)}
                          className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-semibold hover:bg-slate-100 px-3 py-2 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <div className="text-center py-16">
                <Package className="mx-auto text-gray-300 mb-4" size={64} />
                <p className="text-gray-500 text-lg font-medium">No products found</p>
                <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageStock;