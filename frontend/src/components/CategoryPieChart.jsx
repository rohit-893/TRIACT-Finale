import React from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

// A more modern, light-theme color palette
const MODERN_COLORS = [
  "#4f46e5", // Indigo-600
  "#34d399", // Emerald-400
  "#f59e0b", // Amber-500
  "#3b82f6", // Blue-500
  "#ec4899", // Pink-500
  "#8b5cf6", // Violet-500
  "#14b8a6", // Teal-500
  "#ef4444", // Red-500
];

// This function will cycle through the colors if there are more categories
const generateColors = (num) => {
  const colors = [];
  for (let i = 0; i < num; i++) {
    colors.push(MODERN_COLORS[i % MODERN_COLORS.length]);
  }
  return colors;
};

const CategoryPieChart = ({ data }) => {
  const colors = generateColors(data.length);
  const borderColors = colors.map(() => "#ffffff"); // Use white borders for a cleaner look

  const chartData = {
    labels: data.map((item) => item._id), // Category names
    datasets: [
      {
        label: "Sales (₹)",
        data: data.map((item) => item.totalSales),
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 2, // Add a border for separation
        hoverOffset: 10, // Pop out slice on hover
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom", // Move legend to the bottom
        labels: {
          color: "#4b5563", // text-gray-600
          font: {
            size: 12,
          },
          padding: 15,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      title: {
        display: true,
        text: "Sales by Category",
        color: "#1f2937", // text-gray-800
        font: {
          size: 18,
          weight: "600",
        },
        padding: {
          bottom: 10,
        },
      },
      tooltip: {
        backgroundColor: "#ffffff",
        titleColor: "#1f2937",
        bodyColor: "#4b5563",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
      },
    },
  };

  return (
    <div className="relative h-80 w-full">
      <Pie data={chartData} options={options} />
    </div>
  );
};

export default CategoryPieChart;
