import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler, // <-- Make sure to register Filler
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler // <-- Add Filler here for the background gradient
);

const RevenueChart = ({ data }) => {
  const chartData = {
    labels: data.map((item) => item._id),
    datasets: [
      {
        label: "Revenue (₹)",
        data: data.map((item) => item.totalRevenue),
        fill: true, // <-- Set to true to show the gradient
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 200); // Gradient height
          gradient.addColorStop(0, "rgba(79, 70, 229, 0.2)"); // Indigo-600 with 20% opacity
          gradient.addColorStop(1, "rgba(79, 70, 229, 0)"); // Fades to transparent
          return gradient;
        },
        borderColor: "rgba(79, 70, 229, 1)", // Solid Indigo-600
        tension: 0.3, // Smoother curve
        pointRadius: 2,
        pointBackgroundColor: "rgba(79, 70, 229, 1)",
        pointHoverRadius: 5,
        pointHoverBorderWidth: 2,
        pointHoverBackgroundColor: "white",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Allows chart to fill container height
    plugins: {
      legend: {
        display: false, // Hide the legend; the title is clear enough
      },
      title: {
        display: true,
        text: "Revenue Trend (Last 30 Days)",
        color: "#1f2937", // text-gray-800
        font: {
          size: 18,
          weight: "600",
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "#ffffff", // White background
        titleColor: "#1f2937", // text-gray-800
        bodyColor: "#4b5563", // text-gray-600
        borderColor: "#e5e7eb", // border-gray-200
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#6b7280", // text-gray-500
          font: { size: 12 },
        },
        grid: {
          display: false, // Hide vertical grid lines
        },
        border: {
          color: "#e5e7eb", // border-gray-200
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#6b7280", // text-gray-500
          font: { size: 12 },
        },
        grid: {
          color: "#f3f4f6", // Faint grid lines (gray-100)
        },
        border: {
          display: false, // Hide Y-axis line
        },
      },
    },
  };

  return (
    // Set a fixed height for the chart container
    <div className="relative h-80 w-full">
      <Line options={options} data={chartData} />
    </div>
  );
};

export default RevenueChart;
