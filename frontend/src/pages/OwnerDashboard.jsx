import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import RevenueChart from "../components/RevenueChart.jsx";
import CategoryPieChart from "../components/CategoryPieChart.jsx";
import CreateShopForm from "../components/CreateShopForm.jsx";
import KpiCard from "../components/KpiCard.jsx"; // Import our clean card

// Import icons from lucide-react
import {
  DollarSign,
  TrendingUp,
  BarChart,
  Package,
  AlertTriangle,
} from "lucide-react";

const OwnerDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user?.shopId) {
      setLoading(false);
      return;
    }
    try {
      const dashboardData = await shopService.getOwnerDashboardData(
        user.shopId
      );
      setData(dashboardData);
    } catch (err) {
      setError("Failed to fetch dashboard data.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount || 0);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
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

  if (user && user.role === "owner" && !user.shopId) {
    return <CreateShopForm />;
  }

  if (!data) {
    return (
      <div className="text-center mt-16 text-gray-500 text-lg">
        No data available.
      </div>
    );
  }

  // Updated KPI array with just the icon color
  const kpis = [
    {
      title: "Revenue (This Month)",
      value: formatCurrency(data.revenueThisMonth),
      icon: <DollarSign />,
      color: "text-green-600",
    },
    {
      title: "Profit (This Month)",
      value: formatCurrency(data.profitThisMonth),
      icon: <TrendingUp />,
      color: "text-blue-600",
    },
    {
      title: "Units Sold (This Month)",
      value: data.unitsSoldThisMonth,
      icon: <BarChart />,
      color: "text-indigo-600",
    },
    {
      title: "Total Product Types",
      value: data.totalProductTypes,
      icon: <Package />,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-gray-900">Owner Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            iconColor={kpi.color}
          />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
          {data.revenueTrend?.length > 0 ? (
            <RevenueChart data={data.revenueTrend} />
          ) : (
            <div className="text-center text-gray-400 py-12">
              No revenue data available.
            </div>
          )}
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
          {data.salesByCategory?.length > 0 ? (
            <CategoryPieChart data={data.salesByCategory} />
          ) : (
            <div className="text-center text-gray-400 py-12">
              No category sales data.
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Low Stock Alerts
        </h2>
        {data.lowStockItems?.length > 0 ? (
          <ul className="space-y-3">
            {data.lowStockItems.map((item) => (
              <li
                key={item._id}
                className="flex justify-between items-center p-4 border-l-4 border-red-500 bg-red-50 rounded-lg transition-all duration-200 hover:bg-red-100"
              >
                <span className="font-medium text-gray-800">{item.name}</span>
                <span className="text-red-600 font-bold">
                  {item.stock} left
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-center py-6">
            All items are sufficiently stocked.
          </p>
        )}
      </div>
    </div>
  );
};

export default OwnerDashboard;
