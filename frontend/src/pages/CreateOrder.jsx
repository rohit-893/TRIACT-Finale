import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import {
  ShoppingCart,
  Search,
  Package,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const CreateOrder = () => {
  // ... (All your hooks and functions remain exactly the same) ...
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const fetchProducts = useCallback(async () => {
    if (!user?.shopId) return;
    try {
      const fetchedProducts = await shopService.getProducts(user.shopId);
      setProducts(fetchedProducts);
    } catch (err) {
      setError("Failed to fetch products.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const existingCategories = useMemo(() => {
    return ["All", ...new Set(products.map((p) => p.category))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let currentProducts = products;
    if (activeCategory !== "All") {
      currentProducts = currentProducts.filter(
        (p) => p.category === activeCategory
      );
    }
    if (searchTerm) {
      currentProducts = currentProducts.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return currentProducts;
  }, [products, activeCategory, searchTerm]);

  const handleAddToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item._id === product._id);
      if (existingItem) {
        if (existingItem.quantity < product.stock) {
          return prevCart.map((item) =>
            item._id === product._id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        return prevCart; // Do nothing if at max stock
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (productId) =>
    setCart(cart.filter((item) => item._id !== productId));

  const handleQuantityChange = (productId, delta) => {
    const product = products.find((p) => p._id === productId);
    const cartItem = cart.find((item) => item._id === productId);
    if (!product || !cartItem) return;

    const newQuantity = cartItem.quantity + delta;

    if (newQuantity > 0 && newQuantity <= product.stock) {
      setCart(
        cart.map((item) =>
          item._id === productId ? { ...item, quantity: newQuantity } : item
        )
      );
    } else if (newQuantity <= 0) {
      handleRemoveFromCart(productId);
    }
  };

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      setError("Cart is empty.");
      return;
    }
    setError(null);
    setSuccess(null);
    const orderData = {
      customerName,
      items: cart.map((item) => ({
        productId: item._id,
        quantity: item.quantity,
      })),
    };
    try {
      const result = await shopService.createOrder(user.shopId, orderData);
      setSuccess(`Order created! Invoice ID: ${result.invoice?._id || "N/A"}`);
      setCart([]);
      setCustomerName("Walk-in Customer");
      fetchProducts(); // Refresh products to get updated stock
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create order.");
    }
  };

  if (loading)
    return (
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading products...</p>
      </div>
    );

  if (error && products.length === 0) {
    return (
      <div className="text-center mt-16 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 text-lg font-semibold">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-112px)]">
      {/* Products Section (Left) - UNCHANGED */}
      <div className="lg:col-span-3 bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Products</h1>
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search products by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 overflow-x-auto">
          <div className="flex flex-nowrap gap-2">
            {existingCategories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  activeCategory === category
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm border border-gray-300"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product._id}
                className={`relative bg-white rounded-lg p-3 border border-gray-200 transition-all duration-200 group flex flex-col justify-between min-h-[100px] ${
                  product.stock > 0
                    ? "hover:border-indigo-500 hover:shadow-lg transform hover:-translate-y-1 cursor-pointer"
                    : "opacity-60 bg-gray-50"
                }`}
                onClick={() => product.stock > 0 && handleAddToCart(product)}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-base text-gray-900 line-clamp-2 group-hover:text-indigo-700 transition-colors">
                      {product.name}
                    </h3>
                    <span
                      className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                        product.stock > 10
                          ? "bg-green-100 text-green-700"
                          : product.stock > 0
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {product.stock > 0 ? `${product.stock} left` : "Out"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-lg font-bold text-gray-800">
                    ₹{(product.price || 0).toFixed(2)}
                  </p>
                  <button
                    disabled={product.stock === 0}
                    className="bg-indigo-600 text-white p-1.5 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-16">
                <Package className="mx-auto text-gray-300 mb-4" size={64} />
                <p className="text-gray-500 text-lg">No products found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- CART SECTION (RIGHT) - THIS IS WHERE THE CHANGES ARE --- */}
      <div className="lg:col-span-1 bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col overflow-hidden">
        {/* Cart Header - Made more compact */}
        <div className="p-5 border-b border-gray-200">
          {" "}
          {/* CHANGED: p-6 to p-5 */}
          <div className="flex items-center justify-between mb-3">
            {" "}
            {/* CHANGED: mb-4 to mb-3 */}
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {" "}
              {/* CHANGED: text-2xl to text-xl */}
              <ShoppingCart size={22} /> {/* CHANGED: size-24 to 22 */}
              Current Order
            </h2>
            {itemCount > 0 && (
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
                {itemCount} items
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {" "}
            {/* CHANGED: space-y-2 to space-y-1.5 */}
            <label
              htmlFor="customerName"
              className="block text-sm font-medium text-gray-700"
            >
              Customer Name
            </label>
            <input
              id="customerName"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition" // CHANGED: py-3 to py-2.5
            />
          </div>
        </div>

        {/* Cart Items - Made more compact */}
        <div className="p-3 overflow-y-auto space-y-2">
          {" "}
          {/* CHANGED: p-4 to p-3, space-y-3 to space-y-2 */}
          {cart.length === 0 ? (
            <div className="text-center py-16 h-full flex flex-col justify-center items-center">
              <ShoppingCart className="mx-auto text-gray-300 mb-4" size={64} />
              <p className="text-gray-500 text-lg font-medium">
                Your cart is empty
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item._id}
                className="bg-gray-50 p-3 rounded-lg border border-gray-200"
              >
                {" "}
                {/* CHANGED: p-4 to p-3 */}
                <div className="flex justify-between items-start mb-2">
                  {" "}
                  {/* CHANGED: mb-3 to mb-2 */}
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 text-sm leading-snug">
                      {item.name}
                    </h3>{" "}
                    {/* CHANGED: font-semibold, removed text-sm (default) */}
                    <p className="text-indigo-600 font-medium mt-1 text-sm">
                      {" "}
                      {/* CHANGED: font-bold to font-medium, added text-sm */}₹
                      {(item.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveFromCart(item._id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} /> {/* CHANGED: size-18 to 16 */}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuantityChange(item._id, -1)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-7 h-7 rounded-full transition-colors" // CHANGED: w-8 h-8 to w-7 h-7
                    >
                      <Minus size={14} className="mx-auto" />{" "}
                      {/* CHANGED: size-16 to 14 */}
                    </button>
                    <span className="font-bold text-base px-1">
                      {item.quantity}
                    </span>{" "}
                    {/* CHANGED: text-lg to text-base, px-2 to px-1 */}
                    <button
                      onClick={() => handleQuantityChange(item._id, 1)}
                      disabled={
                        item.quantity >=
                        products.find((p) => p._id === item._id)?.stock
                      }
                      className="bg-indigo-600 hover:bg-indigo-700 text-white w-7 h-7 rounded-full disabled:bg-gray-300 transition-colors" // CHANGED: w-8 h-8 to w-7 h-7
                    >
                      <Plus size={14} className="mx-auto" />{" "}
                      {/* CHANGED: size-16 to 14 */}
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900 text-base">
                      {" "}
                      {/* CHANGED: text-lg to text-base */}₹
                      {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer - This has mt-auto to stay at the bottom */}
        <div className="p-5 bg-gray-50 border-t border-gray-200 mt-auto">
          {" "}
          {/* CHANGED: p-6 to p-5 */}
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              {" "}
              {/* CHANGED: mb-4 to mb-3 */}
              <AlertCircle className="text-red-600" size={20} />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              {" "}
              {/* CHANGED: mb-4 to mb-3 */}
              <CheckCircle className="text-green-600" size={20} />
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          )}
          <div className="flex justify-between items-center mb-3">
            {" "}
            {/* CHANGED: mb-4 to mb-3 */}
            <span className="text-lg font-semibold text-gray-700">Total</span>
            <span className="text-2xl font-bold text-gray-900">
              ₹{total.toFixed(2)}
            </span>{" "}
            {/* Already text-2xl from your last request */}
          </div>
          <button
            onClick={handleSubmitOrder}
            disabled={cart.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold text-base shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2" // Already updated from your last request
          >
            <CheckCircle size={20} /> {/* Already updated */}
            Create Order & Invoice
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateOrder;
