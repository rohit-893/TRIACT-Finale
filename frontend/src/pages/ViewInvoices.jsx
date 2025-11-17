import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import { FileText, Search, Download, AlertTriangle } from "lucide-react"; // Import icons

const ViewInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [billerFilter, setBillerFilter] = useState("");
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [invoiceIdFilter, setInvoiceIdFilter] = useState("");

  const fetchInvoices = useCallback(async () => {
    if (!user?.shopId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setLoading(true);
      const data = await shopService.getInvoices(user.shopId);
      setInvoices(data);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
      setError("Failed to fetch invoices. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount || 0);

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => {
        const invoiceDate = new Date(invoice.date);
        if (startDate && invoiceDate < new Date(startDate + "T00:00:00"))
          return false;
        if (endDate && invoiceDate > new Date(endDate + "T23:59:59"))
          return false;
        if (
          billerFilter &&
          !invoice.billerName
            ?.toLowerCase()
            .includes(billerFilter.toLowerCase())
        )
          return false;
        if (
          customerNameFilter &&
          !invoice.customerName
            ?.toLowerCase()
            .includes(customerNameFilter.toLowerCase())
        )
          return false;
        if (
          invoiceIdFilter &&
          !(
            invoice.orderId?.toString().includes(invoiceIdFilter) ||
            invoice._id?.toString().includes(invoiceIdFilter)
          )
        )
          return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first
  }, [
    invoices,
    startDate,
    endDate,
    billerFilter,
    customerNameFilter,
    invoiceIdFilter,
  ]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading invoices...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center mt-16 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 text-lg font-semibold">{error}</p>
      </div>
    );
  }

  // Reusable filter input component
  const FilterInput = ({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
  }) => (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        {type === "text" && (
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-lg py-2.5 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${
            type === "text" ? "pl-9 pr-3" : "px-3"
          }`}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
        <FileText size={32} className="text-indigo-600" />
        View Invoices
      </h1>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <FilterInput
            label="From Date"
            type="date"
            value={startDate}
            onChange={setStartDate}
          />
          <FilterInput
            label="To Date"
            type="date"
            value={endDate}
            onChange={setEndDate}
          />
          <FilterInput
            label="Invoice/Order ID"
            value={invoiceIdFilter}
            onChange={setInvoiceIdFilter}
            placeholder="Search ID..."
          />
          <FilterInput
            label="Customer Name"
            value={customerNameFilter}
            onChange={setCustomerNameFilter}
            placeholder="Search Name..."
          />
          <FilterInput
            label="Billed By"
            value={billerFilter}
            onChange={setBillerFilter}
            placeholder="Search Biller..."
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-hidden bg-white rounded-2xl shadow-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {[
                  "Order ID",
                  "Customer",
                  "Biller",
                  "Date",
                  "Total",
                  "Action",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr
                  key={invoice._id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap">
                    {invoice.orderId}
                  </td>
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                    {invoice.customerName}
                  </td>
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                    {invoice.billerName || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                    {new Date(invoice.date).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-6 py-4 text-gray-800 font-semibold whitespace-nowrap">
                    {formatCurrency(invoice.total)}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <a
                      href={invoice.pdfPath} // Use the Blob URL directly
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center space-x-2 text-sm font-semibold ${
                        invoice.pdfPath
                          ? "text-indigo-600 hover:text-indigo-800"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                      title={
                        invoice.pdfPath
                          ? `View PDF for Order ${invoice.orderId}`
                          : "PDF not available"
                      }
                      onClick={(e) => !invoice.pdfPath && e.preventDefault()}
                    >
                      <Download size={16} />
                      <span>View PDF</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredInvoices.length === 0 && (
            <p className="text-center text-gray-500 py-10">
              {invoices.length > 0
                ? "No invoices match your current filters."
                : "No invoices found."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewInvoices;
