import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  increment,
  Timestamp,
  addDoc,
  orderBy,
} from 'firebase/firestore';
import { BedDouble, UserCheck, Loader, PenTool as Tool, ShoppingBag, AlarmClock, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { ShopPurchaseService } from '../shop/ShopPurchaseService';
import { DataService } from '../../services/dataService';
import RoomMatrixSummary from '../../components/RoomMatrixSummary';

type Room = {
  id: string;
  roomNumber: number;
  floor: string;
  type: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'extension';
};

type Booking = {
  id: string;
  roomId: string;
  guestName: string;
  phoneNumber: string;
  checkedInAt: any;
  lastExtensionAt?: any;
  rent: number;
  initialPayment: number;
  roomNumber?: number;
  paymentMode?: 'cash' | 'gpay';
};

type PaymentEntry = {
  id: string;
  amount: number;
  mode: string;
  type: string;
  timestamp: any;
  description?: string;
};

type ShopPurchase = {
  id: string;
  inventoryId: string;
  itemName: string;
  quantity: number;
  amount: number;
  createdAt: any;
  paymentStatus: string;
};

const RoomMatrix = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentEntry[]>([]);
  const [shopPurchases, setShopPurchases] = useState<ShopPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [floors, setFloors] = useState<string[]>([]);
  const [extensionModal, setExtensionModal] = useState(false);
  const [extensionAmount, setExtensionAmount] = useState('');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [processingExtension, setProcessingExtension] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'gpay' | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [stayValidUntil, setStayValidUntil] = useState<Record<string, string>>({});
  const [pendingAmounts, setPendingAmounts] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    // Refresh room data every 60 seconds (reduced from 30)
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 60000);
    const checkInterval = setInterval(checkTimedRooms, 60000); // Check every minute
    return () => {
      clearInterval(refreshInterval);
      clearInterval(checkInterval);
    };
  }, []);

  useEffect(() => {
    // Update stay valid until every minute
    const timer = setInterval(updateStayValidUntil, 60000);
    updateStayValidUntil();
    return () => clearInterval(timer);
  }, [bookings]);

  const updateStayValidUntil = () => {
    const validUntilDates = bookings.reduce<Record<string, string>>((acc, booking) => {
      const checkinTime = booking.checkedInAt?.toDate ? booking.checkedInAt.toDate() : booking.checkedInAt;
      const lastExtensionTime = booking.lastExtensionAt?.toDate ? booking.lastExtensionAt.toDate() : booking.lastExtensionAt;
      
      if (!checkinTime) return acc;
      
      // Use the last extension time if available, otherwise use check-in time
      const referenceTime = lastExtensionTime || checkinTime;
      
      // Add 24 hours to the reference time to get the valid until date
      const validUntilDate = new Date(referenceTime.getTime() + (24 * 60 * 60 * 1000));
      
      // Format the date and time
      const formattedDate = validUntilDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      
      const formattedTime = validUntilDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      acc[booking.id] = `${formattedDate}, ${formattedTime}`;
      
      return acc;
    }, {});
    
    setStayValidUntil(validUntilDates);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch rooms and active checkins in parallel
      const [roomsSnapshot, checkinSnapshot] = await Promise.all([
        getDocs(collection(db, 'rooms')),
        getDocs(query(collection(db, 'checkins'), where('isCheckedOut', '==', false)))
      ]);

      const roomList = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];

      roomList.sort((a, b) => parseInt(a.roomNumber.toString()) - parseInt(b.roomNumber.toString()));

      const activeBookings = checkinSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];

      // Create a room lookup map for O(1) access
      const roomMap = new Map(roomList.map(r => [r.id, r]));

      // Add room numbers to bookings using map lookup
      const bookingsWithRoomNumber = activeBookings.map(booking => ({
        ...booking,
        roomNumber: roomMap.get(booking.roomId)?.roomNumber
      }));

      // Create booking lookup map for O(1) access
      const bookingMap = new Map(activeBookings.map(b => [b.roomId, b]));

      // Update room statuses
      const updatedRooms = roomList.map(room => {
        const booking = bookingMap.get(room.id);
        return booking ? { ...room, status: 'occupied' as const } : room;
      });

      const uniqueFloors = [...new Set(updatedRooms.map(r => r.floor))].sort((a, b) =>
        parseInt(a) - parseInt(b)
      );

      setRooms(updatedRooms);
      setFloors(uniqueFloors);
      setBookings(bookingsWithRoomNumber);

      updateStayValidUntil();
      // Calculate pending amounts in background
      calculatePendingAmounts(activeBookings);
    } catch (error) {
      toast.error('Failed to fetch data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePendingAmounts = async (bookingsList: Booking[]) => {
    try {
      const pending: Record<string, number> = {};

      // Batch fetch all payments and purchases in parallel
      const paymentPromises = bookingsList.map(booking =>
        getDocs(collection(db, 'checkins', booking.id, 'payments'))
      );

      const purchasePromises = bookingsList.map(booking =>
        getDocs(query(collection(db, 'purchases'), where('checkinId', '==', booking.id)))
      );

      const [paymentsResults, purchasesResults] = await Promise.all([
        Promise.all(paymentPromises),
        Promise.all(purchasePromises)
      ]);

      bookingsList.forEach((booking, index) => {
        const payments = paymentsResults[index].docs.map(doc => doc.data());
        const purchases = purchasesResults[index].docs.map(doc => doc.data());

        let totalRent = booking.rent;
        payments.forEach(p => {
          if (p.type === 'extension') {
            totalRent += p.amount;
          }
        });

        const shopTotal = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
        totalRent += shopTotal;

        const totalPaid = booking.initialPayment || 0;

        pending[booking.id] = Math.max(0, totalRent - totalPaid);
      });

      setPendingAmounts(pending);
    } catch (error) {
      console.error('Error calculating pending amounts:', error);
    }
  };

  const checkTimedRooms = () => {
    const now = new Date();
    const hoursInDay = 24;
    const msInHour = 3600000;
    
    const updatedRooms = rooms.map(room => {
      const booking = bookings.find(b => b.roomId === room.id);
      
      if (booking && room.status === 'occupied') {
        const checkinTime = booking.checkedInAt.toDate ? booking.checkedInAt.toDate() : booking.checkedInAt;
        const lastExtensionTime = booking.lastExtensionAt?.toDate ? 
          booking.lastExtensionAt.toDate() : booking.lastExtensionAt;
        
        const referenceTime = lastExtensionTime || checkinTime;
        
        if (referenceTime && ((now.getTime() - referenceTime.getTime()) >= (hoursInDay * msInHour))) {
          return { ...room, status: 'extension' as const };
        }
      }
      
      return room;
    });
    
    setRooms(updatedRooms);
    updateStayValidUntil();
  };

  const getRoomByBookingId = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return null;
    return rooms.find(r => r.id === booking.roomId) || null;
  };

  const getBookingByRoomId = (roomId: string) => 
    bookings.find(b => b.roomId === roomId);

  const fetchPaymentHistory = async (bookingId: string) => {
    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) return;
      
      const paymentRef = collection(db, 'checkins', bookingId, 'payments');
      const q = query(paymentRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as PaymentEntry[];

      // Initial rent entry (original check-in)
      const initialRent = booking.rent - getExtensionPaymentsTotal(history);
      const rentEntry: PaymentEntry = {
        id: 'rent-entry',
        amount: initialRent, // Only include the initial rent, not extensions
        mode: 'n/a',
        type: 'Rent (Check-in)',
        timestamp: booking.checkedInAt || Timestamp.now(),
      };

      const shopPurchases = await ShopPurchaseService.getPurchasesByCheckin(bookingId);
      setShopPurchases(shopPurchases as ShopPurchase[]);

      const initialPayment = history.find(p => p.type === 'initial');
      
      const advanceEntry = initialPayment || {
        id: 'advance-entry',
        amount: booking.initialPayment,
        mode: booking.paymentMode || 'cash',
        type: 'initial',
        timestamp: booking.checkedInAt || Timestamp.now(),
        description: 'Initial payment at check-in'
      };

      // Include rent entry, advance entry, and all history except duplicated initial payment
      const fullHistory = [rentEntry, advanceEntry, ...history.filter(p => p.type !== 'initial')];
      setPaymentHistory(fullHistory);
    } catch (error) {
      toast.error('Failed to load payment history');
      console.error(error);
    }
  };

  // Helper function to calculate extension payments total
  const getExtensionPaymentsTotal = (paymentEntries: PaymentEntry[]) => {
    return paymentEntries
      .filter(entry => entry.type === 'extension')
      .reduce((total, payment) => total + payment.amount, 0);
  };

  const getTotalRentSoFar = (booking: Booking) => {
    // Filter out extension-related entries to avoid double counting
    // Since we already separated initial rent and extension payments
    const rentPayments = paymentHistory.filter(entry => 
      entry.type === 'Rent (Check-in)' || entry.type === 'extension' || entry.type === 'shop-purchase'
    );

    return rentPayments.reduce((total, payment) => total + Math.abs(payment.amount), 0);
  };

  const getTotalPaidSoFar = (booking: Booking) => {
    const cashAndGpayPayments = paymentHistory.filter(entry => 
      (entry.type === 'initial' || entry.type === 'advance') &&
      (entry.mode === 'cash' || entry.mode === 'gpay')
    );
    return cashAndGpayPayments.reduce((total, payment) => total + payment.amount, 0);
  };

  const handleAddPayment = async (bookingId: string) => {
    const amount = parseFloat(prompt('Enter amount to add:') || '0');
    if (!amount || amount <= 0) return;
    
    setPaymentAmount(amount.toString());
    setShowPaymentModal(true);
  };

  const processPayment = async (bookingId: string) => {
    if (!paymentMode || !paymentAmount) return;
    
    const amount = parseFloat(paymentAmount);

    try {
      const paymentRef = collection(db, 'checkins', bookingId, 'payments');
      await addDoc(paymentRef, {
        amount,
        mode: paymentMode,
        type: 'advance',
        timestamp: Timestamp.now(),
      });

      await updateDoc(doc(db, 'checkins', bookingId), {
        initialPayment: increment(amount),
      });

      toast.success('Payment added successfully');
      setShowPaymentModal(false);
      setPaymentMode(null);
      setPaymentAmount('');
      fetchData();
      fetchPaymentHistory(bookingId);
    } catch (error) {
      toast.error('Failed to add payment');
      console.error(error);
    }
  };

  const handleExtendStay = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    const room = getRoomByBookingId(bookingId);
    if (!room) return;
    
    setCurrentRoom(room);
    setCurrentBooking(booking);
    setExtensionModal(true);
  };

  const handleExtendRoom = async () => {
    if (!currentRoom || !currentBooking || !extensionAmount || parseFloat(extensionAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    setProcessingExtension(true);
    
    try {
      const amount = parseFloat(extensionAmount);
      
      // Get the check-in time
      const checkinTime = currentBooking.checkedInAt?.toDate ? 
        currentBooking.checkedInAt.toDate() : 
        currentBooking.checkedInAt;
      
      // Get the last extension time if available
      const lastExtensionTime = currentBooking.lastExtensionAt?.toDate ? 
        currentBooking.lastExtensionAt.toDate() : 
        currentBooking.lastExtensionAt;
      
      // Calculate next day from check-in with same time
      let nextExtensionDate;
      
      if (lastExtensionTime) {
        // If there was a previous extension, use that as the reference
        // Add one day to the last extension date
        nextExtensionDate = new Date(lastExtensionTime);
        nextExtensionDate.setDate(nextExtensionDate.getDate() + 1);
      } else {
        // If this is the first extension, use check-in as reference
        // Add one day to the check-in date
        nextExtensionDate = new Date(checkinTime);
        nextExtensionDate.setDate(nextExtensionDate.getDate() + 1);
      }
      
      // Create a Timestamp for the extension date
      const extensionTimestamp = Timestamp.fromDate(nextExtensionDate);
      
      // Add payment entry with the calculated extension timestamp
      const paymentRef = collection(db, 'checkins', currentBooking.id, 'payments');
      await addDoc(paymentRef, {
        amount,
        mode: 'n/a',
        type: 'extension',
        timestamp: extensionTimestamp,
        description: 'Room extension payment'
      });

      // Update the booking with the new extension time
      await updateDoc(doc(db, 'checkins', currentBooking.id), {
        rent: increment(amount),
        lastExtensionAt: extensionTimestamp,
      });

      // Update room status
      await updateDoc(doc(db, 'rooms', currentRoom.id), {
        status: 'occupied',
      });

      toast.success('Room extended successfully');
      setExtensionModal(false);
      setExtensionAmount('');
      setCurrentRoom(null);
      setCurrentBooking(null);
      fetchData();
      if (selectedBooking && selectedBooking.id === currentBooking.id) {
        fetchPaymentHistory(currentBooking.id);
      }
    } catch (error) {
      console.error('Error extending room:', error);
      toast.error('Failed to extend room');
    } finally {
      setProcessingExtension(false);
    }
  };

  const handleCheckout = async (booking: Booking) => {
    const pending = getTotalRentSoFar(booking) - getTotalPaidSoFar(booking);
    if (pending > 0) {
      toast.error(`Pending amount ₹${pending} must be cleared before checkout.`);
      return;
    }

    try {
      await updateDoc(doc(db, 'checkins', booking.id), {
        isCheckedOut: true,
        checkedOutAt: Timestamp.now(),
      });

      await updateDoc(doc(db, 'rooms', booking.roomId), {
        status: 'cleaning',
      });

      toast.success('Checkout successful. Room marked for cleaning.');
      setSelectedBooking(null);
      setShopPurchases([]);
      setPaymentHistory([]);
      fetchData();
    } catch (error) {
      toast.error('Checkout failed. Try again.');
      console.error(error);
    }
  };

  const getStatusColor = (status: Room['status']) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'cleaning': return 'bg-yellow-500';
      case 'maintenance': return 'bg-purple-500';
      case 'extension': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: Room['status']) => {
    switch (status) {
      case 'available': return <BedDouble className="h-5 w-5 text-white" />;
      case 'occupied': return <UserCheck className="h-5 w-5 text-white" />;
      case 'cleaning': return <Loader className="h-5 w-5 text-white" />;
      case 'extension': return <AlarmClock className="h-5 w-5 text-white" />;
      default: return null;
    }
  };

  const getTotalShopPurchases = useMemo(() => {
    return shopPurchases.reduce((total, purchase) => total + purchase.amount, 0);
  }, [shopPurchases]);

  const getTimeRemainingColor = (validUntil: string) => {
    if (!validUntil) return 'text-gray-600';

    const now = new Date();
    // Parse the formatted date string properly
    const parts = validUntil.split(',');
    if (parts.length < 2) return 'text-gray-600';

    const validUntilDate = new Date(validUntil);

    if (isNaN(validUntilDate.getTime())) return 'text-gray-600';

    const msRemaining = validUntilDate.getTime() - now.getTime();

    // Only show red when time is actually over
    if (msRemaining < 0) return 'text-red-600';

    const hoursRemaining = msRemaining / (1000 * 60 * 60);
    if (hoursRemaining < 6) return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Room Matrix</h1>

      <RoomMatrixSummary />

      {selectedBooking && (
        <div className="bg-white shadow p-6 rounded-lg mb-6">
          <h2 className="text-xl font-bold mb-4">Booking Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p><strong>Name:</strong> {selectedBooking.guestName}</p>
              <p><strong>Phone:</strong> {selectedBooking.phoneNumber}</p>
              <p><strong>Room Number:</strong> {selectedBooking.roomNumber}</p>
              <p className="flex items-center">
                <strong>Stay Valid for:</strong> 
                <span className={`ml-2 font-medium flex items-center ${getTimeRemainingColor(stayValidUntil[selectedBooking.id] || '')}`}>
                  <Clock className="h-4 w-4 mr-1" />
                  {stayValidUntil[selectedBooking.id] || 'Calculating...'}
                </span>
              </p>
            </div>
            <div>
              <p><strong>Rent so far:</strong> ₹{getTotalRentSoFar(selectedBooking)}</p>
              <p><strong>Paid so far:</strong> ₹{getTotalPaidSoFar(selectedBooking)}</p>
              <p className="font-semibold text-red-600">
                <strong>Pending:</strong> ₹{Math.max(0, getTotalRentSoFar(selectedBooking) - getTotalPaidSoFar(selectedBooking))}
                {shopPurchases.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs">
                    Includes ₹{getTotalShopPurchases} shop purchases
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => handleAddPayment(selectedBooking.id)}
              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Add Payment
            </button>
            <button
              onClick={() => handleExtendStay(selectedBooking.id)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
            >
              <AlarmClock className="h-4 w-4 mr-1" /> Extend Stay
            </button>
            <button
              onClick={() => handleCheckout(selectedBooking)}
              disabled={getTotalRentSoFar(selectedBooking) - getTotalPaidSoFar(selectedBooking) > 0}
              className={`px-3 py-1 text-white rounded ${
                getTotalRentSoFar(selectedBooking) - getTotalPaidSoFar(selectedBooking) > 0 ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Checkout
            </button>
            <button
              onClick={() => {
                setSelectedBooking(null);
                setPaymentHistory([]);
                setShopPurchases([]);
              }}
              className="px-3 py-1 bg-gray-300 text-black rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>

          <div className="mt-6">
            <h3 className="font-bold mb-2">Transaction History</h3>
            <div className="overflow-auto max-h-64 border rounded">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Time</th>
                    <th className="p-2 text-left">Process</th>
                    <th className="p-2 text-left">Cash</th>
                    <th className="p-2 text-left">Gpay</th>
                    <th className="p-2 text-left">Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((entry, i) => {
                    const dt = entry.timestamp?.toDate?.();
                    const date = dt ? new Date(dt).toLocaleDateString('en-IN') : '—';
                    const time = dt ? new Date(dt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '—';

                    let process = '';
                    let rentAmount = null;
                    let cashAmount = null;
                    let gpayAmount = null;

                    switch (entry.type) {
                      case 'Rent (Check-in)':
                        process = 'Check-in';
                        rentAmount = entry.amount;
                        break;
                      case 'extension':
                        process = 'Extension';
                        rentAmount = entry.amount;
                        break;
                      case 'initial':
                        process = 'Initial Payment';
                        if (entry.mode === 'cash') cashAmount = entry.amount;
                        if (entry.mode === 'gpay') gpayAmount = entry.amount;
                        break;
                      case 'advance':
                        process = 'Additional Payment';
                        if (entry.mode === 'cash') cashAmount = entry.amount;
                        if (entry.mode === 'gpay') gpayAmount = entry.amount;
                        break;
                      case 'shop-purchase':
                        process = 'Shop Purchase';
                        rentAmount = Math.abs(entry.amount);
                        break;
                    }

                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2">{date}</td>
                        <td className="p-2">{time}</td>
                        <td className="p-2">{process}</td>
                        <td className="p-2">{cashAmount ? `₹${cashAmount.toFixed(2)}` : '—'}</td>
                        <td className="p-2">{gpayAmount ? `₹${gpayAmount.toFixed(2)}` : '—'}</td>
                        <td className="p-2">{rentAmount ? `₹${rentAmount.toFixed(2)}` : '—'}</td>
                      </tr>
                    );
                  })}
                  {paymentHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-gray-500">
                        No transaction history found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading rooms...</p>
        </div>
      ) : (
        floors.map(floor => {
          const floorRooms = rooms.filter(room => room.floor === floor);
          return (
            <div key={floor} className="mb-6">
              <h2 className="text-xl font-semibold mb-3">Floor {floor}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {floorRooms.map(room => {
                  const booking = getBookingByRoomId(room.id);
                  return (
                    <motion.div
                      key={room.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={async () => {
                        if (room.status === 'occupied') {
                          const booking = getBookingByRoomId(room.id);
                          if (booking) {
                            setSelectedBooking(booking);
                            fetchPaymentHistory(booking.id);
                          }
                        } else if (room.status === 'extension') {
                          const booking = getBookingByRoomId(room.id);
                          if (booking) {
                            setCurrentRoom(room);
                            setCurrentBooking(booking);
                            setExtensionModal(true);
                          }
                        } else if (room.status === 'available') {
                          navigate(`/check-in/${room.id}`);
                        } else if (room.status === 'cleaning') {
                          const confirmed = window.confirm('Is cleaning completed?');
                          if (confirmed) {
                            try {
                              await updateDoc(doc(db, 'rooms', room.id), {
                                status: 'available',
                              });
                              toast.success(`Room ${room.roomNumber} marked as available`);
                              fetchData();
                            } catch (error) {
                              toast.error('Failed to update room status');
                              console.error(error);
                            }
                          }
                        } else {
                          navigate(`/rooms/edit/${room.id}`);
                        }
                      }}
                      className={`relative p-4 rounded-lg shadow border text-center cursor-pointer ${
                        room.status === 'occupied' 
                          ? 'bg-red-100' 
                          : room.status === 'extension'
                            ? 'bg-purple-100'
                            : 'bg-white'
                      }`}
                    >
                      <div className={`w-10 h-10 mx-auto ${getStatusColor(room.status)} rounded-full flex items-center justify-center mb-2`}>
                        {getStatusIcon(room.status)}
                      </div>
                      <div className="font-bold text-lg">{room.roomNumber}</div>
                      <div className="text-xs uppercase">{room.type}</div>

                      {room.status === 'occupied' && booking && (
                        <>
                          <div className="mt-1 flex justify-center">
                            <div className={`text-xs font-medium flex items-center ${getTimeRemainingColor(stayValidUntil[booking.id] || '')}`}>
                              <Clock className="h-3 w-3 mr-1" />
                              {stayValidUntil[booking.id] ? stayValidUntil[booking.id].split(',')[0] : '...'}
                            </div>
                          </div>
                          {pendingAmounts[booking.id] > 0 && (
                            <div className="mt-1 text-xs font-semibold text-red-600">
                              Pending: ₹{pendingAmounts[booking.id].toFixed(0)}
                            </div>
                          )}
                        </>
                      )}

                      {room.status === 'occupied' && (
                        <div className="absolute top-2 right-2">
                          {(() => {
                            const booking = getBookingByRoomId(room.id);
                            if (booking && pendingAmounts[booking.id] > 0) {
                              return (
                                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center"
                                     title={`Pending: ₹${pendingAmounts[booking.id].toFixed(0)}`}>
                                  <span className="text-white text-xs">₹</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                      
                      {room.status === 'extension' && (
                        <div className="absolute -top-1 -right-1">
                          <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center animate-pulse" 
                               title="Needs extension">
                            <AlarmClock className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
      
      {extensionModal && currentRoom && currentBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full"
          >
            <h2 className="text-xl font-bold mb-4">Room Extension</h2>
            <p className="mb-2 text-gray-600">
              Room {currentRoom.roomNumber} - {currentBooking.guestName}
            </p>
            <p className="mb-4 flex items-center">
              <span className="text-sm">Current stay valid until: </span>
              <span className={`ml-2 text-sm font-medium flex items-center ${getTimeRemainingColor(stayValidUntil[currentBooking.id] || '')}`}>
                <Clock className="h-4 w-4 mr-1" />
                {stayValidUntil[currentBooking.id] || 'Calculating...'}
              </span>
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter Extension Amount (₹)
              </label>
              <input
                type="number"
                value={extensionAmount}
                onChange={(e) => setExtensionAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full rounded-md border border-gray-300 shadow-sm p-2 focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Extending will add 24 hours to your current stay period.
              </p>
            </div>
            
            <div className="flex justify-between">
              <button 
                onClick={() => {
                  setExtensionModal(false);
                  handleCheckout(currentBooking);
                }}
                disabled={processingExtension || (getTotalRentSoFar(currentBooking) - getTotalPaidSoFar(currentBooking) > 0)}
                className={`px-4 py-2 rounded ${
                  getTotalRentSoFar(currentBooking) - getTotalPaidSoFar(currentBooking) > 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                Checkout
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setExtensionModal(false)}
                  disabled={processingExtension}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtendRoom}
                  disabled={processingExtension || !extensionAmount || parseFloat(extensionAmount) <= 0}
                  className={`px-4 py-2 text-white rounded ${
                    processingExtension || !extensionAmount || parseFloat(extensionAmount) <= 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } flex items-center`}
                >
                  {processingExtension ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    'Extend Room'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Select Payment Mode</h2>
            <p className="mb-4">Amount: ₹{paymentAmount}</p>
            
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => {
                  setPaymentMode('cash');
                  processPayment(selectedBooking!.id);
                }}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Cash
              </button>
              <button
                onClick={() => {
                  setPaymentMode('gpay');
                  processPayment(selectedBooking!.id);
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                GPay
              </button>
            </div>
            
            <button
              onClick={() => {
                setShowPaymentModal(false);
                setPaymentMode(null);
                setPaymentAmount('');
              }}
              className="w-full py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomMatrix;
