// frontend/src/components/NavBar.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import { useClickOutside } from "../hooks/useClickOutside.js";
import { BellIcon as Bell, ChevronDownIcon } from "@heroicons/react/24/outline";

const Dropdown = ({ buttonContent, children, widthClass = "w-56", onOpen = () => {}, onClose = () => {} }) => {
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
        // --- THIS LINE IS UPDATED ---
        className="flex items-center space-x-1 text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
      >
        {buttonContent}
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className={`absolute right-0 mt-2 ${widthClass} bg-white dark:bg-gray-800 rounded-lg shadow-lg z-20 py-1 border border-gray-200 dark:border-gray-700`}>
          <div onClick={() => setIsOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
};

const NavBar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(() => {
    if (isAuthenticated && user?.shopId) {
      shopService.getNotifications(user.shopId).then(setNotifications).catch(console.error);
    } else setNotifications([]);
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 3000); // 3s polling
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkNotificationsRead = () => {
    if (unreadCount > 0) {
      shopService.markNotificationsAsRead(user.shopId).then(() => {
        setNotifications((current) => current.map((n) => ({ ...n, isRead: true })));
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-sm relative z-30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
        {/* Logo */}
       <Link
  to="/"
  className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-colors"
>
  TRIACT
</Link>


        {/* Links & dropdowns */}
        <div className="flex items-center space-x-6">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                Home
              </Link>
              <Link to="/ai-chat" className="text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                TRIACT.AI
              </Link>

              <Dropdown buttonContent={<span>Orders</span>}>
                <Link to="/create-order" className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                  Create Order
                </Link>
                <Link to="/scan-invoice" className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                  Scan Invoice
                </Link>
                <Link to="/view-invoices" className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                  View Invoices
                </Link>
              </Dropdown>

              {user?.role === "owner" && (
                <Dropdown buttonContent={<span>Settings</span>}>
                  <Link to="/manage-stock" className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                    Manage Stock
                  </Link>
                  <Link to="/manage-employees" className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                    Manage Employees
                  </Link>
                  <Link to="/shop-settings" className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
                    Shop Settings
                  </Link>
                </Dropdown>
              )}

              {user?.role === "employee" && (
                <Link to="/salary-info" className="text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
                  Salary Info
                </Link>
              )}

              {/* Notifications & Profile */}
              {/* Notifications & Profile */}
<div className="flex items-center space-x-4 border-l border-gray-200 dark:border-gray-700 pl-6">
  {/* --- Notifications Dropdown --- */}
  <Dropdown
    buttonContent={
      <div className="relative">
        <Bell className="w-6 h-6 text-gray-700 dark:text-gray-200 hover:text-indigo-500 transition-colors cursor-pointer" />
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
    {/* Dropdown header */}
    <div className="p-3 font-semibold border-b border-gray-200 dark:border-gray-700 text-sm flex justify-between items-center bg-gray-50 dark:bg-gray-800 rounded-t-md">
      <span className="text-gray-800 dark:text-gray-100">Notifications</span>
      {unreadCount > 0 && (
        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
          {unreadCount} new
        </span>
      )}
    </div>

    {/* Notification list */}
    <ul className="py-1 max-h-80 overflow-y-auto bg-white dark:bg-gray-900 rounded-b-md">
      {notifications.length > 0 ? (
        notifications.map((n) => (
          <li
            key={n._id}
            className={`px-4 py-3 border-b last:border-b-0 transition-all duration-200 rounded-md cursor-pointer ${
              !n.isRead
                ? "bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-800"
                : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <p
              className={`text-sm leading-snug ${
                !n.isRead
                  ? "font-semibold text-gray-900 dark:text-gray-100"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {n.message}
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {new Date(n.createdAt).toLocaleString()}
            </div>
          </li>
        ))
      ) : (
        <li className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          You're all caught up! 🎉
        </li>
      )}
    </ul>
  </Dropdown>

  {/* --- Greeting + Logout (unchanged) --- */}
  <span className="text-gray-800 dark:text-gray-200 font-medium">Hi, {user.name}</span>
  <button
    onClick={handleLogout}
    className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-4 py-1 rounded-lg transition-colors"
  >
    Logout
  </button>
</div>

            </>
          ) : (
            <>
              <Link to="/login" className="text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">Login</Link>
              <Link to="/register" className="text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;