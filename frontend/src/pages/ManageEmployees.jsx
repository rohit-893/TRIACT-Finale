import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import Modal from "../components/Modal.jsx";
import { Users, Plus, AlertTriangle } from "lucide-react";

// Reusable input component for cleaner forms
const FormInput = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  step,
  required = true,
  disabled = false,
}) => (
  <div className="space-y-2">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
    <input
      id={name}
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      step={step}
      required={required}
      disabled={disabled}
      className={`w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition ${
        disabled ? "bg-gray-100 cursor-not-allowed" : ""
      }`}
    />
  </div>
);

const ManageEmployees = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [modalError, setModalError] = useState("");
  const [isLoadingForm, setIsLoadingForm] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    salary: { amount: "" },
  });

  const fetchEmployees = useCallback(async () => {
    if (!user?.shopId) return;
    try {
      setLoading(true);
      const data = await shopService.getEmployees(user.shopId);
      setEmployees(data);
    } catch (err) {
      setPageError("Failed to fetch employees.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "amount") {
      setFormData((prev) => ({
        ...prev,
        salary: { ...prev.salary, amount: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setModalError("");
    setIsLoadingForm(true);
    try {
      await shopService.addEmployee(user.shopId, {
        ...formData,
        salary: { amount: parseFloat(formData.salary.amount) },
      });
      setIsAddModalOpen(false);
      fetchEmployees();
    } catch (err) {
      setModalError(
        err.response?.data?.message || "An unknown error occurred."
      );
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleEditEmployee = async (e) => {
    e.preventDefault();
    setModalError("");
    setIsLoadingForm(true);
    try {
      const updatedSalary = {
        amount: parseFloat(formData.salary.amount),
      };
      // We don't reset the status here, just update the amount
      await shopService.updateEmployee(user.shopId, selectedEmployee._id, {
        salary: { ...selectedEmployee.salary, ...updatedSalary },
      });
      setIsEditModalOpen(false);
      fetchEmployees();
    } catch (err) {
      setModalError(err.response?.data?.message || "Failed to update salary.");
    } finally {
      setIsLoadingForm(false);
    }
  };

  const handleRemoveEmployee = async (employeeId) => {
    if (window.confirm("Are you sure you want to remove this employee?")) {
      try {
        await shopService.removeEmployee(user.shopId, employeeId);
        fetchEmployees();
      } catch (err) {
        setPageError("Failed to remove employee.");
      }
    }
  };

  const handlePaySalary = async (employee) => {
    try {
      await shopService.updateEmployee(user.shopId, employee._id, {
        salary: { ...employee.salary, status: "paid" }, // Keep existing amount
      });
      fetchEmployees();
    } catch (err) {
      setPageError("Failed to pay salary.");
    }
  };

  const handleResetAllSalaries = async () => {
    if (
      window.confirm(
        'Are you sure you want to reset all employee salaries to "Due"?'
      )
    ) {
      try {
        const updatePromises = employees.map((emp) =>
          shopService.updateEmployee(user.shopId, emp._id, {
            salary: { ...emp.salary, status: "pending" }, // Keep existing amount
          })
        );
        await Promise.all(updatePromises);
        fetchEmployees();
      } catch (err) {
        setPageError("Failed to reset salaries.");
      }
    }
  };

  const openEditModal = (employee) => {
    setModalError("");
    setSelectedEmployee(employee);
    setFormData({ salary: { amount: employee.salary.amount } });
    setIsEditModalOpen(true);
  };

  const openAddModal = () => {
    setModalError("");
    setFormData({ name: "", email: "", password: "", salary: { amount: "" } });
    setIsAddModalOpen(true);
  };

  if (loading)
    return (
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
        <p className="mt-4 text-gray-600 font-medium">
          Loading employee data...
        </p>
      </div>
    );
  if (pageError)
    return (
      <div className="text-center mt-16 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 text-lg font-semibold">{pageError}</p>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Modals */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Employee"
      >
        <form onSubmit={handleAddEmployee} className="space-y-4">
          {modalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {modalError}
            </div>
          )}
          <FormInput
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleFormChange}
            placeholder="John Doe"
          />
          <FormInput
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleFormChange}
            placeholder="john@example.com"
          />
          <FormInput
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleFormChange}
            placeholder="••••••••"
          />
          <FormInput
            label="Salary (₹)"
            name="amount"
            type="number"
            step="0.01"
            value={formData.salary.amount}
            onChange={handleFormChange}
            placeholder="15000"
          />
          <button
            type="submit"
            disabled={isLoadingForm}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg disabled:bg-gray-400"
          >
            {isLoadingForm ? "Adding..." : "Add Employee"}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Salary for ${selectedEmployee?.name}`}
      >
        <form onSubmit={handleEditEmployee} className="space-y-4">
          {modalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {modalError}
            </div>
          )}
          <FormInput
            label="New Salary (₹)"
            name="amount"
            type="number"
            step="0.01"
            value={formData.salary.amount}
            onChange={handleFormChange}
          />
          <button
            type="submit"
            disabled={isLoadingForm}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg disabled:bg-gray-400"
          >
            {isLoadingForm ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </Modal>

      {/* Header + Actions */}
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center space-y-4 md:space-y-0">
        <h1 className="text-4xl font-bold text-gray-900">Manage Employees</h1>
        <div className="flex space-x-3">
          <button
            onClick={handleResetAllSalaries}
            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            Reset All to Due
          </button>
          <button
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Plus size={20} /> Add Employee
          </button>
        </div>
      </div>

      {/* Employee Table */}
      <div className="overflow-x-auto rounded-2xl shadow-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {["Name", "Email", "Salary", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr
                key={employee._id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800">
                  {employee.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {employee.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-medium">
                  ₹{(employee.salary.amount || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-3 py-1 inline-flex text-xs font-semibold leading-5 rounded-full ${
                      employee.salary.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {employee.salary.status === "paid" ? "Paid" : "Due"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-4 text-sm font-medium">
                  {employee.salary.status === "pending" && (
                    <button
                      onClick={() => handlePaySalary(employee)}
                      className="text-green-600 hover:text-green-800 transition font-semibold"
                    >
                      Pay Salary
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(employee)}
                    className="text-indigo-600 hover:text-indigo-800 transition font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemoveEmployee(employee._id)}
                    className="text-red-600 hover:text-red-800 transition font-semibold"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && (
          <div className="text-center py-16">
            <Users className="mx-auto text-gray-300 mb-4" size={64} />
            <p className="text-gray-500 text-lg font-medium">
              No employees found
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Add one to get started!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageEmployees;
