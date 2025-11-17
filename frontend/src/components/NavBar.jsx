// frontend/src/components/NavBar.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import { useClickOutside } from "../hooks/useClickOutside.js";
// --- 1. IMPORT MOTION & ANIMATEPRESENCE ---
import { motion, AnimatePresence } from "framer-motion";

// (Icons are unchanged)
const BellIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.017 5.454 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
    />
  </svg>
);
const ChevronDownIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
    />
  </svg>
);

// Dropdown Component
const Dropdown = ({
  buttonContent,
  children,
  widthClass = "w-56",
  onOpen = () => {},
  onClose = () => {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const closeDropdown = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
      onClose();
    }
  }, [isOpen, onClose]);

  useClickOutside(dropdownRef, closeDropdown);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    nextState ? onOpen() : onClose();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        // --- 2. ADDED HOVER ANIMATION ---
        className="flex items-center space-x-1 text-gray-700 hover:text-indigo-600 font-medium transform transition-all duration-200 hover:-translate-y-0.5"
      >
        <span>{buttonContent}</span>
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* --- 3. ADDED FRAMER MOTION --- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className={`absolute right-0 mt-2 ${widthClass} bg-white rounded-lg shadow-xl z-20 py-1 border border-gray-200 origin-top-right`}
          >
            <div onClick={() => setIsOpen(false)}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Dropdown Link Item
const DropdownLink = ({ to, children }) => (
  <Link
    to={to}
    // --- 4. ADDED HOVER ANIMATION ---
    className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-all duration-200 transform hover:translate-x-1"
  >
    {children}
  </Link>
);

// Main NavBar Component
const NavBar = () => {
  // (All the logic hooks are unchanged)
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const fetchNotifications = useCallback(() => {
    if (isAuthenticated && user?.shopId) {
      shopService
        .getNotifications(user.shopId)
        .then(setNotifications)
        .catch(console.error);
    } else setNotifications([]);
  }, [isAuthenticated, user]);
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 3000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const handleMarkNotificationsRead = () => {
    if (unreadCount > 0) {
      shopService.markNotificationsAsRead(user.shopId).then(() => {
        setNotifications((current) =>
          current.map((n) => ({ ...n, isRead: true }))
        );
      });
    }
  };
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            to="/"
            // --- 5. ADDED HOVER ANIMATION ---
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 transition-all duration-200 transform hover:scale-105"
          >
            TRIACT
          </Link>

          {/* Links & dropdowns */}
          <div className="flex items-center space-x-6">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-gray-700 hover:text-indigo-600 font-medium transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  Home
                </Link>
                <Link
                  to="/ai-chat"
                  className="text-gray-700 hover:text-indigo-600 font-medium transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  TRIACT.AI
                </Link>

                <Dropdown buttonContent="Orders">
                  <DropdownLink to="/create-order">Create Order</DropdownLink>
                  <DropdownLink to="/scan-invoice">Scan Invoice</DropdownLink>
                  <DropdownLink to="/view-invoices">View Invoices</DropdownLink>
                </Dropdown>

                {user?.role === "owner" && (
                  <Dropdown buttonContent="Settings">
                    <DropdownLink to="/manage-stock">Manage Stock</DropdownLink>
                    <DropdownLink to="/manage-employees">
                      Manage Employees
                    </DropdownLink>
                    <DropdownLink to="/shop-settings">
                      Shop Settings
                    </DropdownLink>
                  </Dropdown>
                )}

                {user?.role === "employee" && (
                  <Link
                    to="/salary-info"
                    className="text-gray-700 hover:text-indigo-600 font-medium transition-all duration-200 transform hover:-translate-y-0.5"
                  >
                    Salary Info
                  </Link>
                )}

                {/* Profile Section */}
                <div className="flex items-center space-x-4 border-l border-gray-200 pl-6">
                  {/* Notifications Dropdown */}
                  <Dropdown
                    buttonContent={
                      // --- 6. ADDED HOVER ANIMATION ---
                      <div className="relative transform transition-transform hover:scale-110">
                        <BellIcon className="w-6 h-6 text-gray-700 hover:text-indigo-600 transition-colors cursor-pointer" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </div>
                    }
                    onClose={handleMarkNotificationsRead}
                    widthClass="w-80"
                  >
                    {/* (Dropdown content is unchanged) */}
                    <div className="p-3 font-semibold border-b border-gray-200 text-sm flex justify-between items-center bg-gray-50 rounded-t-md">
                      <span className="text-gray-800">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-xs text-indigo-600 font-medium">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <ul className="py-1 max-h-80 overflow-y-auto bg-white rounded-b-md">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <li
                            key={n._id}
                            className={`px-4 py-3 border-b last:border-b-0 transition-all duration-200 rounded-md cursor-pointer ${
                              !n.isRead
                                ? "bg-indigo-50 hover:bg-indigo-100"
                                : "bg-white hover:bg-gray-50"
                            }`}
                          >
                            <p
                              className={`text-sm leading-snug ${
                                !n.isRead
                                  ? "font-semibold text-gray-900"
                                  : "text-gray-700"
                              }`}
                            >
                              {n.message}
                            </p>
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(n.createdAt).toLocaleString()}
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="px-4 py-6 text-sm text-gray-500 text-center">
                          You're all caught up! 🎉
                        </li>
                      )}
                    </ul>
                  </Dropdown>

                  <span className="text-gray-800 font-medium hidden sm:block">
                    Hi, {user.name}
                  </span>

                  <button
                    onClick={handleLogout}
                    // --- 7. ADDED HOVER ANIMATION ---
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transform transition-all duration-200 hover:scale-105"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-indigo-600 font-medium transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
