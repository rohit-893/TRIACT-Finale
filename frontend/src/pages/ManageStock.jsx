import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import Modal from "../components/Modal.jsx";
import KpiCard from "../components/KpiCard.jsx"; // Import our KpiCard

// Import icons from lucide-react
import {
  Package,
  Search,
  Filter,
  Plus,
  Edit2,
  AlertTriangle,
  TrendingDown,
  BarChart3,
  DollarSign,
} from "lucide-react";

// Reusable input component for cleaner forms
const FormInput = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  step,
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
      step={step}
      required={required}
      disabled={disabled}
      className={`w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${
        disabled ? "bg-gray-100 cursor-not-allowed" : ""
      }`}
    />
  </div>
);

const ManageStock = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [modalError, setModalError] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoadingForm, setIsLoadingForm] = useState(false);

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

      const forecastMap = new Map(forecastData.map((p) => [p._id, p.forecast]));

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
    setIsLoadingForm(true);
    try {
      await shopService.addProduct(user.shopId, {
        ...newProduct,
        price: parseFloat(newProduct.price),
        cost: parseFloat(newProduct.cost),
        stock: parseInt(newProduct.stock, 10),
      });
      setIsAddModalOpen(false);
      setNewProduct({ name: "", category: "", price: "", cost: "", stock: "" });
      fetchProducts(); // Refresh data
    } catch (err) {
      setModalError(err.response?.data?.message || "Failed to add product.");
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    setModalError("");
    setIsLoadingForm(true);
    const payload = { stock: parseInt(editFormData.stock, 10) };

    // Only owners can change price and cost
    if (user.role === "owner") {
      payload.price = parseFloat(editFormData.price);
      payload.cost = parseFloat(editFormData.cost);
    }

    try {
      await shopService.updateProduct(
        user.shopId,
        selectedProduct._id,
        payload
      );
      setIsEditModalOpen(false);
      setSelectedProduct(null);
      fetchProducts(); // Refresh data
    } catch (err) {
      setModalError(err.response?.data?.message || "Failed to update product.");
    } finally {
      setIsLoadingForm(false);
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
        searchTerm
          ? p.name.toLowerCase().includes(searchTerm.toLowerCase())
          : true
      )
      .filter((p) =>
        selectedCategory !== "All Categories"
          ? p.category === selectedCategory
          : true
      )
      .filter((p) => (showLowStock ? p.stock < LOW_STOCK_THRESHOLD : true));
  }, [products, searchTerm, selectedCategory, showLowStock]);

  const stats = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter(
      (p) => p.stock < LOW_STOCK_THRESHOLD
    ).length;
    const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
    const criticalStock = products.filter((p) => p.stock < 5).length;
    return { total, lowStock, totalValue, criticalStock };
  }, [products]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount || 0);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
        <p className="mt-4 text-gray-600 font-medium">
          Loading stock & forecast...
        </p>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="text-center mt-16 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 text-lg font-semibold">{pageError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Product Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Product"
      >
        <form onSubmit={handleAddProduct} className="space-y-4">
          {modalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {modalError}
            </div>
          )}
          <FormInput
            label="Product Name"
            name="name"
            value={newProduct.name}
            onChange={(e) =>
              setNewProduct({ ...newProduct, name: e.target.value })
            }
            placeholder="e.g., Parle-G 100g"
          />
          <FormInput
            label="Category"
            name="category"
            value={newProduct.category}
            onChange={(e) =>
              setNewProduct({ ...newProduct, category: e.target.value })
            }
            placeholder="e.g., Snacks"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              label="Price (₹)"
              name="price"
              type="number"
              step="0.01"
              value={newProduct.price}
              onChange={(e) =>
                setNewProduct({ ...newProduct, price: e.target.value })
              }
              placeholder="10.00"
            />
            <FormInput
              label="Cost (₹)"
              name="cost"
              type="number"
              step="0.01"
              value={newProduct.cost}
              onChange={(e) =>
                setNewProduct({ ...newProduct, cost: e.target.value })
              }
              placeholder="8.00"
            />
            <FormInput
              label="Stock"
              name="stock"
              type="number"
              value={newProduct.stock}
              onChange={(e) =>
                setNewProduct({ ...newProduct, stock: e.target.value })
              }
              placeholder="100"
            />
          </div>
          <button
            type="submit"
            disabled={isLoadingForm}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg disabled:bg-gray-400"
          >
            {isLoadingForm ? "Adding..." : "Add Product"}
          </button>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit: ${selectedProduct?.name}`}
      >
        <form onSubmit={handleEditProduct} className="space-y-4">
          {modalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {modalError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              label="Price (₹)"
              name="price"
              type="number"
              step="0.01"
              value={editFormData.price}
              onChange={(e) =>
                setEditFormData({ ...editFormData, price: e.target.value })
              }
              disabled={user.role !== "owner"}
            />
            <FormInput
              label="Cost (₹)"
              name="cost"
              type="number"
              step="0.01"
              value={editFormData.cost}
              onChange={(e) =>
                setEditFormData({ ...editFormData, cost: e.target.value })
              }
              disabled={user.role !== "owner"}
            />
            <FormInput
              label="Stock"
              name="stock"
              type="number"
              value={editFormData.stock}
              onChange={(e) =>
                setEditFormData({ ...editFormData, stock: e.target.value })
              }
            />
          </div>
          {user.role !== "owner" && (
            <p className="text-sm text-gray-500">
              Only owners can edit price and cost.
            </p>
          )}
          <button
            type="submit"
            disabled={isLoadingForm}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg disabled:bg-gray-400"
          >
            {isLoadingForm ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </Modal>

      {/* Header */}
      <h1 className="text-4xl font-bold text-gray-900">Stock Management</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Total Product Types"
          value={stats.total}
          icon={<Package />}
          iconColor="text-indigo-600"
        />
        <KpiCard
          title="Low Stock Items"
          value={stats.lowStock}
          icon={<AlertTriangle />}
          iconColor="text-amber-600"
        />
        <KpiCard
          title="Critical Stock (< 5)"
          value={stats.criticalStock}
          icon={<TrendingDown />}
          iconColor="text-red-600"
        />
        <KpiCard
          title="Total Stock Value"
          value={formatCurrency(stats.totalValue)}
          icon={<DollarSign />}
          iconColor="text-green-600"
        />
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search products by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full lg:w-auto pl-12 pr-8 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition appearance-none bg-white cursor-pointer"
            >
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Filter */}
          <button
            onClick={() => setShowLowStock(!showLowStock)}
            className={`px-5 py-3 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 whitespace-nowrap ${
              showLowStock
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
            }`}
          >
            <AlertTriangle size={18} />
            {showLowStock ? "Low Stock Only" : "Show All"}
          </button>

          {/* Add Product Button */}
          {user.role === "owner" && (
            <button
              onClick={openAddModal}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Plus size={20} />
              Add Product
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {[
                  "Product",
                  "Category",
                  "Price",
                  "Cost",
                  "Stock",
                  "AI Forecast (Days Left)",
                  "Actions",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const daysLeft = product.forecast?.daysUntilStockOut;
                let forecastText =
                  daysLeft === undefined
                    ? "N/A"
                    : daysLeft === Infinity
                    ? "N/A"
                    : Math.floor(daysLeft);
                const isLowStock = product.stock < LOW_STOCK_THRESHOLD;
                const isCritical = product.stock < 5;
                const isForecastCritical = daysLeft < 7;
                const isForecastWarning = daysLeft < 14;

                return (
                  <tr
                    key={product._id}
                    className={`hover:bg-gray-50 transition-colors ${
                      isCritical ? "bg-red-50" : isLowStock ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(product.cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full font-bold text-sm ${
                          isCritical
                            ? "bg-red-100 text-red-700"
                            : isLowStock
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`font-bold ${
                          isForecastCritical
                            ? "text-red-600"
                            : isForecastWarning
                            ? "text-amber-600"
                            : "text-gray-700"
                        }`}
                      >
                        {forecastText}
                        {daysLeft !== undefined &&
                          daysLeft !== Infinity &&
                          " days"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(product)}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-900 font-semibold hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all text-sm"
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
    </div>
  );
};

export default ManageStock;
