import React from "react";

const KpiCard = ({ title, value, icon, iconColor = "text-indigo-600" }) => {
  return (
    // Clean card with a subtle shadow and "lift" on hover
    <div className="bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:shadow-xl border border-gray-200">
      <div className="flex items-center space-x-4">
        <div
          className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 ${iconColor}`}
        >
          {/* We clone the icon to add standard styling */}
          {React.cloneElement(icon, { className: "w-6 h-6" })}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default KpiCard;
