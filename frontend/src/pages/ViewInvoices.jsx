import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import { MagnifyingGlassIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";

const ViewInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [billerFilter, setBillerFilter] = useState("");
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [invoiceIdFilter, setInvoiceIdFilter] = useState("");

  const fetchInvoices = useCallback(async () => {
    if (!user?.shopId) return;
    try {
      setLoading(true);
      const data = await shopService.getInvoices(user.shopId);
      setInvoices(data);
    } catch (err) {
      setError("Failed to fetch invoices.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount || 0);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const invoiceDate = new Date(invoice.date);

      if (startDate && invoiceDate < new Date(startDate + "T00:00:00")) return false;
      if (endDate && invoiceDate > new Date(endDate + "T23:59:59")) return false;
      if (billerFilter && !invoice.billerName?.toLowerCase().includes(billerFilter.toLowerCase())) return false;
      if (customerNameFilter && !invoice.customerName?.toLowerCase().includes(customerNameFilter.toLowerCase())) return false;
      if (invoiceIdFilter && !invoice.orderId.toString().startsWith(invoiceIdFilter)) return false;

      return true;
    });
  }, [invoices, startDate, endDate, billerFilter, customerNameFilter, invoiceIdFilter]);

  if (loading) return <div className="text-center mt-10 text-gray-500">Loading invoices...</div>;
  if (error) return <div className="text-center mt-10 text-red-500">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 sm:p-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 text-center mb-4">Past Invoices</h1>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-xl shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700">From Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">To Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Invoice ID</label>
          <div className="relative mt-1">
            <input type="text" placeholder="Search..." value={invoiceIdFilter} onChange={(e) => setInvoiceIdFilter(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500" />
            <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-2.5 text-gray-400" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Customer Name</label>
          <input type="text" placeholder="Search..." value={customerNameFilter} onChange={(e) => setCustomerNameFilter(e.target.value)} className="mt-1 border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Billed By</label>
          <input type="text" placeholder="Search..." value={billerFilter} onChange={(e) => setBillerFilter(e.target.value)} className="mt-1 border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-indigo-50">
            <tr>
              {["Order ID", "Customer", "Biller", "Date", "Total", "Action"].map((col) => (
                <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredInvoices.map((invoice) => (
              <tr key={invoice._id} className="hover:bg-indigo-50 transition">
                <td className="px-6 py-4 font-medium text-gray-900">{invoice.orderId}</td>
                <td className="px-6 py-4 text-gray-500">{invoice.customerName}</td>
                <td className="px-6 py-4 text-gray-500">{invoice.billerName || "N/A"}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(invoice.date).toLocaleString()}</td>
                <td className="px-6 py-4 text-gray-500">{formatCurrency(invoice.total)}</td>
                <td className="px-6 py-4 text-right">
                  {/* --- MODIFY THIS LINK --- */}
              <a
                // Construct the API endpoint URL dynamically
                href={`${import.meta.env.VITE_API_BASE_URL}/api/shops/${user.shopId}/invoices/${invoice._id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-900 font-medium"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                <span>View PDF</span>
              </a>
              {/* --- END MODIFICATION --- */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredInvoices.length === 0 && (
          <p className="text-center text-gray-500 py-4">
            {invoices.length > 0 ? "No invoices match your current filters." : "No invoices found."}
          </p>
        )}
      </div>
    </div>
  );
};

export default ViewInvoices;
