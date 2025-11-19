import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc, addDoc, Timestamp, query, where, orderBy } from 'firebase/firestore';
import { Plus, Calendar, Phone, CreditCard, XCircle, Search, Check, History, Users, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

type Room = {
  id: string;
  roomNumber: number;
  floor: string;
  type: string;
  status: string;
};

type RoomDetail = {
  roomId: string;
  roomNumber: number;
};

type AdvanceBooking = {
  id: string;
  name: string;
  mobile: string;
  aadhar: string;
  date_of_booking: string;
  room_type: string;
  number_of_rooms: number;
  price_per_room: number;
  advance_amount: number;
  payment_mode?: string;
  rooms: RoomDetail[];
  status: string;
  created_at: any;
  cancelled_at: any;
  completed_at: any;
  refund_amount: number;
  refund_mode?: string;
};

const AdvanceBookingsList = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<AdvanceBooking[]>([]);
  const [historyBookings, setHistoryBookings] = useState<AdvanceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cancelModal, setCancelModal] = useState<{
    show: boolean;
    booking: AdvanceBooking | null;
  }>({ show: false, booking: null });
  const [bookModal, setBookModal] = useState<{
    show: boolean;
    booking: AdvanceBooking | null;
  }>({ show: false, booking: null });
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMode, setRefundMode] = useState<'cash' | 'gpay'>('cash');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const bookingsSnapshot = await getDocs(collection(db, 'advance_bookings'));
      const allBookings = bookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdvanceBooking[];

      const activeBookings = allBookings.filter(b => b.status === 'pending');
      const completedOrCancelled = allBookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

      activeBookings.sort((a, b) => a.date_of_booking.localeCompare(b.date_of_booking));
      completedOrCancelled.sort((a, b) => {
        const aTime = b.completed_at || b.cancelled_at;
        const bTime = a.completed_at || a.cancelled_at;
        return (aTime?.seconds || 0) - (bTime?.seconds || 0);
      });

      setBookings(activeBookings);
      setHistoryBookings(completedOrCancelled);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = async (booking: AdvanceBooking) => {
    setProcessing(true);
    try {
      const roomsSnapshot = await getDocs(collection(db, 'rooms'));
      const allRooms = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];

      const checkinsQuery = query(
        collection(db, 'checkins'),
        where('isCheckedOut', '==', false)
      );
      const checkinsSnapshot = await getDocs(checkinsQuery);

      const occupiedRoomIds = new Set<string>();
      checkinsSnapshot.docs.forEach(doc => {
        occupiedRoomIds.add(doc.data().roomId);
      });

      const availableRoomsList = allRooms.filter(room =>
        !occupiedRoomIds.has(room.id) &&
        room.status === 'available' &&
        room.type.toLowerCase() === booking.room_type.toLowerCase().replace(' ', '-')
      );

      availableRoomsList.sort((a, b) => a.roomNumber - b.roomNumber);

      setAvailableRooms(availableRoomsList);
      setBookModal({ show: true, booking });
      setSelectedRooms([]);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
      toast.error('Failed to fetch available rooms');
    } finally {
      setProcessing(false);
    }
  };

  const handleRoomSelect = (roomId: string) => {
    if (selectedRooms.includes(roomId)) {
      setSelectedRooms(selectedRooms.filter(id => id !== roomId));
    } else {
      if (selectedRooms.length < (bookModal.booking?.number_of_rooms || 0)) {
        setSelectedRooms([...selectedRooms, roomId]);
      } else {
        toast.warning(`You can only select ${bookModal.booking?.number_of_rooms} room(s)`);
      }
    }
  };

  const confirmBooking = async () => {
    if (!bookModal.booking) return;

    if (selectedRooms.length !== bookModal.booking.number_of_rooms) {
      toast.error(`Please select exactly ${bookModal.booking.number_of_rooms} room(s)`);
      return;
    }

    setProcessing(true);
    try {
      const booking = bookModal.booking;

      // For each selected room, create a check-in
      for (const roomId of selectedRooms) {
        const room = availableRooms.find(r => r.id === roomId);
        if (!room) continue;

        // Create check-in record
        const checkinRef = await addDoc(collection(db, 'checkins'), {
          guestName: booking.name,
          phoneNumber: booking.mobile,
          idNumber: booking.aadhar,
          numberOfGuests: 1,
          acType: booking.room_type,
          rent: booking.price_per_room,
          initialPayment: booking.advance_amount / selectedRooms.length,
          paymentMode: booking.payment_mode || 'cash',
          roomId: room.id,
          roomNumber: room.roomNumber,
          isCheckedOut: false,
          checkedInAt: Timestamp.now(),
          advanceBookingId: booking.id
        });

        // Add initial payment entry
        await addDoc(collection(db, 'checkins', checkinRef.id, 'payments'), {
          amount: booking.advance_amount / selectedRooms.length,
          mode: booking.payment_mode || 'cash',
          type: 'initial',
          timestamp: Timestamp.now(),
          description: 'Initial payment from advance booking'
        });

        // Update room status to occupied
        await updateDoc(doc(db, 'rooms', room.id), {
          status: 'occupied'
        });
      }

      // Update advance booking status
      const roomDetails = selectedRooms.map(roomId => {
        const room = availableRooms.find(r => r.id === roomId);
        return {
          roomId: room!.id,
          roomNumber: room!.roomNumber
        };
      });

      await updateDoc(doc(db, 'advance_bookings', booking.id), {
        status: 'completed',
        rooms: roomDetails,
        completed_at: Timestamp.now()
      });

      toast.success('Check-in completed successfully!');
      setBookModal({ show: false, booking: null });
      setSelectedRooms([]);
      fetchBookings();
    } catch (error) {
      console.error('Error confirming booking:', error);
      toast.error('Failed to complete check-in');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelBooking = (booking: AdvanceBooking) => {
    setCancelModal({ show: true, booking });
    setRefundAmount(booking.advance_amount.toString());
    setRefundMode(booking.payment_mode === 'gpay' ? 'gpay' : 'cash');
  };

  const confirmCancellation = async () => {
    if (!cancelModal.booking) return;

    const refund = parseFloat(refundAmount);
    if (isNaN(refund) || refund < 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    if (refund > cancelModal.booking.advance_amount) {
      toast.error('Refund amount cannot exceed advance amount');
      return;
    }

    setProcessing(true);
    try {
      await updateDoc(doc(db, 'advance_bookings', cancelModal.booking.id), {
        status: 'cancelled',
        cancelled_at: Timestamp.now(),
        refund_amount: refund,
        refund_mode: refundMode
      });

      if (refund > 0) {
        await addDoc(collection(db, 'payments'), {
          type: 'refund',
          amount: -refund,
          mode: refundMode,
          paymentMode: refundMode,
          customerName: cancelModal.booking.name,
          date_of_booking: cancelModal.booking.date_of_booking,
          note: `Refund for cancelled advance booking - ${cancelModal.booking.name} (${cancelModal.booking.date_of_booking})`,
          timestamp: Timestamp.now(),
          paymentStatus: 'completed',
          description: `Refund via ${refundMode}`,
          roomNumber: 'Cancelled Booking'
        });
      }

      toast.success('Booking cancelled and refund recorded successfully');
      setCancelModal({ show: false, booking: null });
      setRefundAmount('');
      setRefundMode('cash');
      fetchBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel booking');
    } finally {
      setProcessing(false);
    }
  };

  const getTotalPrice = (booking: AdvanceBooking) => {
    return booking.price_per_room * booking.number_of_rooms;
  };

  const filteredBookings = searchQuery
    ? bookings.filter(booking =>
        booking.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.mobile.includes(searchQuery) ||
        booking.date_of_booking.includes(searchQuery)
      )
    : bookings;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Advance Bookings</h1>
          <p className="text-sm text-gray-600 mt-1">
            {bookings.length} pending bookings
          </p>
        </div>
        <button
          onClick={() => navigate('/advance-booking/new')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Booking
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, mobile, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Calendar className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No Pending Bookings</h3>
          <p className="text-gray-500 mb-6">
            {searchQuery ? 'No bookings match your search.' : 'Start by creating your first advance booking.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => navigate('/advance-booking/new')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Booking
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Guest Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Booking Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rooms & Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{booking.name}</div>
                      <div className="text-sm text-gray-500 flex items-center mt-1">
                        <Phone className="h-3 w-3 mr-1" />
                        {booking.mobile}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        {new Date(booking.date_of_booking).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {booking.number_of_rooms} room(s)
                      </div>
                      <div className="text-xs text-gray-500 mt-1 capitalize">{booking.room_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Total: ₹{getTotalPrice(booking).toFixed(2)}
                      </div>
                      <div className="text-xs text-green-600 mt-1 flex items-center">
                        <CreditCard className="h-3 w-3 mr-1" />
                        Advance: ₹{booking.advance_amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleBookClick(booking)}
                          className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          BOOK
                        </button>
                        <button
                          onClick={() => handleCancelBooking(booking)}
                          className="flex items-center px-3 py-1 text-red-600 hover:text-red-900 border border-red-600 rounded hover:bg-red-50 transition-colors duration-200"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Section */}
      {historyBookings.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center mb-6">
            <History className="h-6 w-6 text-gray-600 mr-2" />
            <h2 className="text-2xl font-bold text-gray-800">Booking History</h2>
            <span className="ml-3 px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
              {historyBookings.length}
            </span>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Guest Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Booking Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rooms Assigned
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{booking.name}</div>
                        <div className="text-sm text-gray-500 flex items-center mt-1">
                          <Phone className="h-3 w-3 mr-1" />
                          {booking.mobile}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {new Date(booking.date_of_booking).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 capitalize">{booking.room_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.status === 'completed' && booking.rooms.length > 0 ? (
                          <div className="text-sm text-gray-900">
                            {booking.rooms.map(r => r.roomNumber).join(', ')}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">Not Assigned</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Total: ₹{getTotalPrice(booking).toFixed(2)}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Advance: ₹{booking.advance_amount.toFixed(2)}
                        </div>
                        {booking.status === 'cancelled' && booking.refund_amount > 0 && (
                          <div className="text-xs text-red-600 mt-1">
                            Refunded: ₹{booking.refund_amount.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.status === 'completed' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Cancelled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.completed_at ? (
                          new Date(booking.completed_at.toDate()).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        ) : booking.cancelled_at ? (
                          new Date(booking.cancelled_at.toDate()).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        ) : (
                          'N/A'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Book Modal */}
      <AnimatePresence>
        {bookModal.show && bookModal.booking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => !processing && setBookModal({ show: false, booking: null })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">Assign Rooms</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Select {bookModal.booking.number_of_rooms} room(s) for {bookModal.booking.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setBookModal({ show: false, booking: null })}
                    disabled={processing}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                  >
                    <X className="h-6 w-6 text-gray-500" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {availableRooms.length} rooms available | Selected: {selectedRooms.length}/{bookModal.booking.number_of_rooms}
                </p>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
                {availableRooms.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Rooms Available</h3>
                    <p className="text-gray-500">
                      All rooms are currently occupied. Please try again later.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {availableRooms.map((room) => {
                      const isSelected = selectedRooms.includes(room.id);
                      return (
                        <button
                          key={room.id}
                          onClick={() => handleRoomSelect(room.id)}
                          className={`p-4 rounded-lg border-2 text-center transition-all duration-200 ${
                            isSelected
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                          }`}
                        >
                          <div className="text-2xl font-bold mb-1">{room.roomNumber}</div>
                          <div className="text-xs text-gray-600">Floor {room.floor}</div>
                          {isSelected && (
                            <div className="mt-2 text-xs font-medium text-green-600">Selected</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
                <button
                  onClick={() => setBookModal({ show: false, booking: null })}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBooking}
                  disabled={processing || selectedRooms.length !== bookModal.booking.number_of_rooms}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {cancelModal.show && cancelModal.booking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => !processing && setCancelModal({ show: false, booking: null })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">Cancel Booking</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Are you sure you want to cancel this booking?
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Guest:</span>
                    <span className="font-medium">{cancelModal.booking.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">
                      {new Date(cancelModal.booking.date_of_booking).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Advance Paid:</span>
                    <span className="font-medium">₹{cancelModal.booking.advance_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refund Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={cancelModal.booking.advance_amount}
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                    placeholder="Enter refund amount"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum refundable: ₹{cancelModal.booking.advance_amount.toFixed(2)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refund Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={refundMode}
                    onChange={(e) => setRefundMode(e.target.value as 'cash' | 'gpay')}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="gpay">GPay</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setCancelModal({ show: false, booking: null });
                    setRefundAmount('');
                  }}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Keep Booking
                </button>
                <button
                  onClick={confirmCancellation}
                  disabled={processing}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdvanceBookingsList;
