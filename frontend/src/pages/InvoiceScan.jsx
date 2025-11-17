import React, { useState } from "react";
import Tesseract from "tesseract.js";
import { useAuth } from "../hooks/useAuth";
import api from "../services/api";
import {
  Upload,
  ScanLine,
  FileText,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";

const InvoiceScan = () => {
  const { user } = useAuth();
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle"); // idle, processing, complete
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImageUrl(URL.createObjectURL(file));
      setOcrText("");
      setResults([]);
      setProgress(0);
      setStatus("idle");
      setError("");
    }
  };

  const handleScan = async () => {
    if (!image) return;
    setStatus("processing");
    setError("");
    setResults([]);
    setOcrText("");

    try {
      const {
        data: { text },
      } = await Tesseract.recognize(image, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      setOcrText(text);

      const response = await api.post(`/api/scan`, { extractedText: text });
      setResults(response.data.results);
      setStatus("complete");
    } catch (err) {
      console.error("Scan Error:", err);
      setError("Failed to scan or analyze the invoice. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold text-gray-900">Scan New Invoice</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Uploader & Preview */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Upload size={22} className="text-indigo-600" />
            1. Upload Invoice Image
          </h2>
          <input
            type="file"
            onChange={handleImageChange}
            accept="image/*"
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2.5 file:px-5
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100 transition-colors cursor-pointer"
          />
          {imageUrl && (
            <div className="mt-4 rounded-lg border border-gray-200 p-2 bg-gray-50">
              <img
                src={imageUrl}
                alt="Invoice preview"
                className="rounded-md max-h-80 w-full object-contain"
              />
            </div>
          )}
          <button
            onClick={handleScan}
            disabled={!image || status === "processing"}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            {status === "processing" ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {`Scanning... ${progress}%`}
              </>
            ) : (
              <>
                <ScanLine size={20} />
                2. Scan & Analyze Invoice
              </>
            )}
          </button>
        </div>

        {/* Results */}
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <FileText size={22} className="text-indigo-600" />
            3. Analysis Results
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={20} />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {status === "idle" && !error && (
            <div className="text-center py-16 text-gray-500">
              <p>Upload an image and click "Scan" to see results here.</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Detected Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Inventory Match
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((result, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {result.parsedName} (Qty: {result.parsedQuantity})
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            result.status === "MATCHED"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {result.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 flex items-center gap-2">
                        {result.status === "MATCHED" ? (
                          <Check size={16} className="text-green-600" />
                        ) : (
                          <X size={16} className="text-red-600" />
                        )}
                        {result.matchedProduct?.name || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ocrText && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-600">
                Raw Extracted Text:
              </h3>
              <pre className="mt-2 p-3 bg-gray-100 rounded-md text-xs text-gray-700 whitespace-pre-wrap h-32 overflow-y-auto border border-gray-200">
                {ocrText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceScan;
