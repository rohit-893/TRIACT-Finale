// frontend/src/pages/ViewInvoices.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService"; // For getInvoices
import api from "../services/api"; // For authenticated PDF fetch
import { MagnifyingGlassIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";

const ViewInvoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // General page error
  const [pdfError, setPdfError] = useState(null); // PDF specific error

  // State for filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [billerFilter, setBillerFilter] = useState("");
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [invoiceIdFilter, setInvoiceIdFilter] = useState(""); // Can search by Invoice or Order ID

  // Fetch initial invoice list
  const fetchInvoices = useCallback(async () => {
    if (!user?.shopId) {
      setLoading(false); // Stop loading if no shopId
      return;
    }
    setError(null); // Clear previous page errors
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

  // Helper to format currency
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount || 0);

  // Memoized filtering logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const invoiceDate = new Date(invoice.date);

      // Date range filter
      if (startDate && invoiceDate < new Date(startDate + "T00:00:00")) return false;
      if (endDate && invoiceDate > new Date(endDate + "T23:59:59")) return false;
      // Text filters (case-insensitive)
      if (billerFilter && !invoice.billerName?.toLowerCase().includes(billerFilter.toLowerCase())) return false;
      if (customerNameFilter && !invoice.customerName?.toLowerCase().includes(customerNameFilter.toLowerCase())) return false;
      // ID filter (check both Invoice _id and Order ID)
      if (invoiceIdFilter && !(invoice.orderId?.toString().includes(invoiceIdFilter) || invoice._id?.toString().includes(invoiceIdFilter))) return false;

      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first
  }, [invoices, startDate, endDate, billerFilter, customerNameFilter, invoiceIdFilter]);

  // --- Function to fetch and open PDF using authenticated request ---
  const handleViewPdf = async (invoiceId) => {
    setPdfError(null); // Clear previous PDF errors
    if (!user?.shopId) {
      setPdfError("User or Shop ID missing.");
      return;
    }
    try {
      const url = `/api/shops/${user.shopId}/invoices/${invoiceId}`;
      console.log("Fetching PDF from:", url);

      // Make authenticated request expecting blob data
      const response = await api.get(url, {
        responseType: 'blob', // Expect binary data
      });

      // --- Robust check for PDF content type ---
      if (response.data.type !== 'application/pdf') {
          // If the server sent a JSON error (like 404), try to parse it
          if (response.data.type === "application/json") {
             try {
                const errorJson = JSON.parse(await response.data.text());
                throw new Error(errorJson.message || 'Server returned non-PDF content.');
             } catch (parseError) {
                 // Fallback if parsing fails
                 throw new Error('Server returned non-PDF content.');
             }
          } else {
             // Handle other unexpected content types
             throw new Error('Server returned unexpected content type: ' + response.data.type);
          }
      }
      // --- End check ---


      // Create a URL for the received blob
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);

      // Open the PDF in a new tab
      window.open(fileURL, '_blank');

      // Optional: Revoke the object URL after some time to free memory
      // Browsers often handle this, but explicit revocation can be safer
      setTimeout(() => URL.revokeObjectURL(fileURL), 10000); // e.g., after 10 seconds

    } catch (err) {
      console.error("Error fetching or opening PDF:", err);
      // Attempt to parse error response if it's a blob of JSON (e.g., from a 404/500)
      if (err.response && err.response.data instanceof Blob && err.response.data.type === "application/json") {
         try {
            const errorJson = JSON.parse(await err.response.data.text());
            setPdfError(`Failed to load PDF: ${errorJson.message || 'Server error'}`);
         } catch (parseError) {
             setPdfError("Failed to load PDF. Check server logs for details.");
         }
      } else {
         // Handle network errors or non-blob/non-JSON errors
         setPdfError(err.response?.data?.message || err.message || "Failed to load PDF. Check network or server status.");
      }
    }
  };
  // --- End PDF handling function ---


  // Loading state display
  if (loading) return <div className="text-center mt-10 text-gray-500">Loading invoices...</div>;

  // Render the component
  return (
    <div className="max-w-6xl mx-auto p-6 sm:p-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 text-center mb-4">Past Invoices</h1>

      {/* Display Page-level error if initial fetch failed */}
      {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-center">{error}</div>}
      {/* Display PDF-specific error if PDF loading fails */}
      {pdfError && <div className="p-3 bg-orange-100 text-orange-700 rounded-md text-center">{pdfError}</div>}


      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-xl shadow-sm border border-gray-200">
        {/* Date Filters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" />
        </div>
        {/* Text Filters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice/Order ID</label>
          <div className="relative mt-1">
            <input type="text" placeholder="Search ID..." value={invoiceIdFilter} onChange={(e) => setInvoiceIdFilter(e.target.value)} className="w-full border rounded-lg px-3 py-2 pl-8 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" />
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
          <input type="text" placeholder="Search Name..." value={customerNameFilter} onChange={(e) => setCustomerNameFilter(e.target.value)} className="mt-1 border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Billed By</label>
          <input type="text" placeholder="Search Biller..." value={billerFilter} onChange={(e) => setBillerFilter(e.target.value)} className="mt-1 border rounded-lg px-3 py-2 w-full focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Table Headers */}
              {["Order ID", "Customer", "Biller", "Date", "Total", "Action"].map((col) => (
                <th key={col} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Table Rows */}
            {filteredInvoices.map((invoice) => (
              <tr key={invoice._id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{invoice.orderId}</td>
                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{invoice.customerName}</td>
                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{invoice.billerName || "N/A"}</td>
                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{new Date(invoice.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="px-6 py-4 text-gray-700 font-semibold whitespace-nowrap">{formatCurrency(invoice.total)}</td>
                <td className="px-6 py-4 text-center whitespace-nowrap">
                  {/* --- Changed to Button --- */}
                  <button
                    onClick={() => handleViewPdf(invoice._id)} // Call the fetch function
                    className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-900 font-medium disabled:text-gray-400 transition-colors"
                    title={`View PDF for Order ${invoice.orderId}`}
                  >
                    <DocumentArrowDownIcon className="w-5 h-5" />
                    <span>View PDF</span>
                  </button>
                  {/* --- End Change --- */}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Empty State / No Results Message */}
        {filteredInvoices.length === 0 && (
          <p className="text-center text-gray-500 py-6">
            {invoices.length > 0 ? "No invoices match your current filters." : "No invoices found."}
          </p>
        )}
      </div>
    </div>
  );
};

export default ViewInvoices;