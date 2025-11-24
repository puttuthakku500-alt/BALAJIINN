import React, { useEffect,useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BedDouble,
  Grid3X3,
  Users,
  ShoppingBag,
  Package,
  Receipt,
  LogOut,
  Menu,
  X,
  CalendarCheck,
  Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';




const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const { logout, currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handlePaymentsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === '1234') {
      setShowPasswordModal(false);
      setPasswordInput('');
      navigate('/payments');
    } else {
      alert('Incorrect password');
      setPasswordInput('');
    }
  };

  const navigation = [
    // { name: 'Rooms', href: '/rooms', icon: BedDouble },
    { name: 'Room Matrix', href: '/rooms/matrix', icon: Grid3X3 },
    // { name: 'Houses', href: '/houses', icon: Home },
    { name: 'Booked Rooms', href: '/booked-rooms', icon: Users },
    { name: 'Advance Bookings', href: '/advance-bookings', icon: CalendarCheck },
    { name: 'Payments', href: '/payments', icon: Receipt },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-0 left-0 z-50 p-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-md text-gray-600 hover:text-gray-900 focus:outline-none"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
      
      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div className="relative flex flex-col w-full max-w-xs h-full bg-blue-900 pt-5 pb-4">
              <div className="absolute top-0 right-0 p-4">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-md text-white hover:text-gray-200 focus:outline-none"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="flex-shrink-0 flex items-center px-4">
                <h1 className="text-2xl font-bold text-white">BALAJI INN</h1> 
              </div>
              <div className="mt-8 flex-1 h-0 overflow-y-auto">
                <nav className="px-2 space-y-1">
                  {navigation.map((item) => (
                    item.name === 'Payments' ? (
                      <button
                        key={item.name}
                        onClick={(e) => {
                          setSidebarOpen(false);
                          handlePaymentsClick(e);
                        }}
                        className="w-full flex items-center px-4 py-3 text-base font-medium rounded-md transition-colors duration-200 text-blue-100 hover:bg-blue-800"
                      >
                        <item.icon className="mr-3 h-6 w-6 flex-shrink-0" />
                        {item.name}
                      </button>
                    ) : (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        className={({ isActive }) =>
                          `flex items-center px-4 py-3 text-base font-medium rounded-md transition-colors duration-200 ${
                            isActive
                              ? 'bg-blue-800 text-white'
                              : 'text-blue-100 hover:bg-blue-800'
                          }`
                        }
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className="mr-3 h-6 w-6 flex-shrink-0" />
                        {item.name}
                      </NavLink>
                    )
                  ))}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-3 text-base font-medium rounded-md text-blue-100 hover:bg-blue-800 transition-colors duration-200"
                  >
                    <LogOut className="mr-3 h-6 w-6 flex-shrink-0" />
                    Logout
                  </button>
                </nav>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-blue-900">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-2xl font-bold text-white">BALAJI INN</h1>
              </div>
              <div className="mt-8 flex-1 px-2 space-y-1">
                {navigation.map((item) => (
                  item.name === 'Payments' ? (
                    <button
                      key={item.name}
                      onClick={handlePaymentsClick}
                      className="w-full flex items-center px-4 py-3 text-base font-medium rounded-md transition-colors duration-200 text-blue-100 hover:bg-blue-800"
                    >
                      <item.icon className="mr-3 h-6 w-6 flex-shrink-0" />
                      {item.name}
                    </button>
                  ) : (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center px-4 py-3 text-base font-medium rounded-md transition-colors duration-200 ${
                          isActive
                            ? 'bg-blue-800 text-white'
                            : 'text-blue-100 hover:bg-blue-800'
                        }`
                      }
                    >
                      <item.icon className="mr-3 h-6 w-6 flex-shrink-0" />
                      {item.name}
                    </NavLink>
                  )
                ))}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-3 text-base font-medium rounded-md text-blue-100 hover:bg-blue-800 transition-colors duration-200"
                >
                  <LogOut className="mr-3 h-6 w-6 flex-shrink-0" />
                  Logout
                </button>
              </div>
            </div>
            <div className="flex-shrink-0 flex border-t border-blue-800 p-4">
              <div className="flex items-center">
                <div>
                  <div className="text-sm font-medium text-white">
                    {currentUser?.email}
                  </div>
                  <div className="text-xs text-blue-200">Hotel Admin</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none pt-8 px-4 md:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h2 className="text-xl font-bold mb-4">Password Required</h2>
            <p className="text-gray-600 mb-4">Enter password to access Payments</p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              className="w-full px-4 py-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter password"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordInput('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Submit
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
