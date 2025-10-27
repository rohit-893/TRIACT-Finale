import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import { ShoppingCart, Search, Package, Plus, Minus, Trash2, X, CheckCircle, AlertCircle } from "lucide-react";

const CreateOrder = () => {
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
        return prevCart;
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (productId) =>
    setCart(cart.filter((item) => item._id !== productId));

  const handleQuantityChange = (productId, delta) => {
    const product = products.find((p) => p._id === productId);
    const cartItem = cart.find((item) => item._id === productId);
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
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create order.");
    }
  };

  if (loading)
    return (
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-slate-700"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading products...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Point of Sale</h1>
          <p className="text-gray-600">Create new orders and manage your cart</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
              {/* Search and Header */}
              <div className="bg-slate-800 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Package className="text-white" size={28} />
                  <h2 className="text-2xl font-bold text-white">Products</h2>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white rounded-lg shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  {existingCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeCategory === category
                          ? "bg-slate-700 text-white shadow-md"
                          : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm border border-gray-200"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Grid */}
              <div className="p-6 h-[calc(100vh-400px)] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => (
                    <div
                      key={product._id}
                      className="group bg-white rounded-lg p-5 border border-gray-200 hover:border-slate-400 hover:shadow-lg transition-all duration-200 cursor-pointer"
                      onClick={() => product.stock > 0 && handleAddToCart(product)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900 line-clamp-2 group-hover:text-slate-700 transition-colors">
                            {product.name}
                          </h3>
                        </div>
                        <span className={`ml-2 px-2 py-1 rounded-md text-xs font-semibold ${
                          product.stock > 10 
                            ? "bg-emerald-100 text-emerald-700" 
                            : product.stock > 0 
                            ? "bg-amber-100 text-amber-700" 
                            : "bg-red-100 text-red-700"
                        }`}>
                          {product.stock > 0 ? `${product.stock} left` : "Out"}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-slate-700">
                            ₹{(product.price || 0).toFixed(2)}
                          </p>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(product);
                          }}
                          disabled={product.stock === 0}
                          className="bg-slate-700 text-white p-2 rounded-lg hover:bg-slate-800 hover:shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <Plus size={20} />
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
          </div>

          {/* Cart Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-xl sticky top-24 border border-gray-200 flex flex-col max-h-[calc(100vh-7rem)]">
              <div className="bg-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="text-white" size={28} />
                    <h2 className="text-2xl font-bold text-white">Cart</h2>
                  </div>
                  {cart.length > 0 && (
                    <span className="bg-white text-slate-800 px-3 py-1 rounded-lg text-sm font-bold">
                      {itemCount} items
                    </span>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Cart Items */}
              <div className="p-4 flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="text-center py-16">
                    <ShoppingCart className="mx-auto text-gray-300 mb-4" size={64} />
                    <p className="text-gray-400 text-lg font-medium">Your cart is empty</p>
                    <p className="text-gray-400 text-sm mt-2">Add products to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item._id}
                        className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:shadow-sm transition-all"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{item.name}</h3>
                            <p className="text-slate-700 font-bold mt-1">
                              ₹{(item.price || 0).toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveFromCart(item._id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-gray-200">
                          <button
                            onClick={() => handleQuantityChange(item._id, -1)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-md transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          
                          <span className="font-bold text-lg px-4">{item.quantity}</span>
                          
                          <button
                            onClick={() => handleQuantityChange(item._id, 1)}
                            disabled={item.quantity >= products.find(p => p._id === item._id)?.stock}
                            className="bg-slate-700 hover:bg-slate-800 text-white p-2 rounded-md disabled:bg-gray-300 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        
                        <div className="mt-2 text-right">
                          <span className="text-sm text-gray-600">Subtotal: </span>
                          <span className="font-bold text-gray-900">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart Footer */}
              <div className="p-6 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-300">
                  <span className="text-lg font-semibold text-gray-700">Total</span>
                  <span className="text-3xl font-bold text-gray-900">₹{total.toFixed(2)}</span>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="text-red-600" size={20} />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}
                
                {success && (
                  <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                    <CheckCircle className="text-emerald-600" size={20} />
                    <p className="text-emerald-700 text-sm">{success}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmitOrder}
                  disabled={cart.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-lg font-bold text-lg shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={24} />
                  Create Order & Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrder;