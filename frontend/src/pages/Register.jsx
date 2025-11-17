import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import authService from "../services/authService";
import { AlertCircle, CheckCircle } from "lucide-react";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "owner",
    shopId: "",
  });

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const { name, email, password, role, shopId } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const userData = { name, email, password, role };

      if (role === "employee") {
        if (!shopId) {
          setError("Shop ID is required for employees.");
          setIsLoading(false);
          return;
        }
        userData.shopId = shopId;
      }

      await authService.register(userData);
      setSuccess("Registration successful! Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(
        err.response?.data?.message || "Registration failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-50 px-4">
      {/* Card Container */}
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Create an Account
            </h1>
            <p className="text-gray-500 mt-2">Get started with TRIACT today.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-green-700">{success}</p>
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={name}
                onChange={onChange}
                required
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                disabled={isLoading}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={email}
                onChange={onChange}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                value={password}
                onChange={onChange}
                required
                minLength="6"
                placeholder="•••••••• (Min. 6 characters)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                disabled={isLoading}
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700"
              >
                I am a...
              </label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={onChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                disabled={isLoading}
              >
                <option value="owner">Shop Owner</option>
                <option value="employee">Employee</option>
              </select>
            </div>

            {/* Shop ID for employees */}
            {role === "employee" && (
              <div className="space-y-2">
                <label
                  htmlFor="shopId"
                  className="block text-sm font-medium text-gray-700"
                >
                  Shop ID
                </label>
                <input
                  id="shopId"
                  type="text"
                  name="shopId"
                  value={shopId}
                  onChange={onChange}
                  required
                  placeholder="Ask your owner for this ID"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200"
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline transition-colors"
          >
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
