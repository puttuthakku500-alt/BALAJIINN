import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Plus, Calendar, DollarSign, Users, Clock, History, X } from 'lucide-react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, addDoc, Timestamp, doc, updateDoc, increment, orderBy } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';

type House = {
  id: string;
  name: string;
  type: 'house';
  status: 'available' | 'booked';
};

type HouseBooking = {
  id: string;
  houseId: string;
  houseName: string;
  guestName: string;
  phoneNumber: string;
  idNumber: string;
  numberOfGuests: number;
  daysOfStay: number;
  rent: number;
  initialPayment: number;
  paymentMode: 'cash' | 'gpay';
  acType: string;
  checkedInAt: any;
  checkOutDate: any;
  isCheckedOut: boolean;
  pendingAmount: number;
  extraFees: Array<{
    description: string;
    amount: number;
    timestamp: any;
  }>;
  extensions: Array<{
    additionalDays: number;
    rentForDays: number;
    timestamp: any;
  }>;
};

type PaymentEntry = {
  id: string;
  amount: number;
  mode: string;
  type: string;
  timestamp: any;
  description?: string;
};

const HOUSES = [
  { id: 'white-house-ground', name: 'White House - Ground Floor', type: 'house' as const },
  { id: 'white-house-first', name: 'White House - First Floor', type: 'house' as const },
  { id: 'white-house-second', name: 'White House - Second Floor', type: 'house' as const },
  { id: 'guest-house', name: 'Guest House', type: 'house' as const },
];

const HousePage = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<HouseBooking[]>([]);
  const [historicalBookings, setHistoricalBookings] = useState<HouseBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkInModal, setCheckInModal] = useState(false);
  const [confirmCheckInModal, setConfirmCheckInModal] = useState(false);
  const [extendModal, setExtendModal] = useState(false);
  const [extraFeeModal, setExtraFeeModal] = useState(false);
  const [addPaymentModal, setAddPaymentModal] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<typeof HOUSES[0] | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<HouseBooking | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentEntry[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'gpay'>('cash');

  const [checkInForm, setCheckInForm] = useState({
    guestName: '',
    phoneNumber: '',
    idNumber: '',
    numberOfGuests: 1,
    stayType: 'days' as 'month' | 'days',
    daysOfStay: 1,
    acType: 'NON AC' as 'AC' | 'NON AC',
    rent: '',
    initialPayment: '',
    paymentMode: 'cash' as 'cash' | 'gpay'
  });

  const [extendForm, setExtendForm] = useState({
    additionalDays: 1,
    rentForDays: ''
  });

  const [extraFeeForm, setExtraFeeForm] = useState({
    description: '',
    amount: ''
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const [activeBookingsSnapshot, historicalSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'house_bookings'), where('isCheckedOut', '==', false))),
        getDocs(query(collection(db, 'house_bookings'), where('isCheckedOut', '==', true)))
      ]);

      const activeList = activeBookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HouseBooking[];

      const historicalList = historicalSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HouseBooking[];

      historicalList.sort((a, b) => {
        const aTime = a.checkedInAt?.toDate?.() || new Date(0);
        const bTime = b.checkedInAt?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });

      setBookings(activeList);
      setHistoricalBookings(historicalList);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const getHouseStatus = (houseId: string): 'available' | 'booked' => {
    return bookings.some(b => b.houseId === houseId && !b.isCheckedOut) ? 'booked' : 'available';
  };

  const getHouseBooking = (houseId: string) => {
    return bookings.find(b => b.houseId === houseId && !b.isCheckedOut);
  };

  const getHouseHistory = (houseId: string) => {
    return historicalBookings.filter(b => b.houseId === houseId);
  };

  const handleHouseClick = async (house: typeof HOUSES[0]) => {
    const status = getHouseStatus(house.id);
    const booking = getHouseBooking(house.id);

    if (status === 'available') {
      setSelectedHouse(house);
      setCheckInModal(true);
    } else if (booking) {
      try {
        await fetchPaymentHistory(booking.id);
        setSelectedBooking(booking);
      } catch (error) {
        console.error('Error loading booking details:', error);
        toast.error('Failed to load booking details');
      }
    }
  };

  const fetchPaymentHistory = async (bookingId: string) => {
    try {
      const booking = bookings.find(b => b.id === bookingId) || historicalBookings.find(b => b.id === bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const paymentRef = collection(db, 'house_bookings', bookingId, 'payments');
      const q = query(paymentRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentEntry[];

      const rentEntry: PaymentEntry = {
        id: 'rent-entry',
        amount: booking.rent,
        mode: 'n/a',
        type: 'Rent',
        timestamp: booking.checkedInAt || Timestamp.now(),
      };

      const fullHistory = [rentEntry, ...history];
      setPaymentHistory(fullHistory);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      throw error;
    }
  };

  const getTotalRentSoFar = (booking: HouseBooking) => {
    return paymentHistory
      .filter(entry => entry.type === 'Rent' || entry.type === 'extension' || entry.type === 'extra-fee')
      .reduce((total, payment) => total + Math.abs(payment.amount), 0);
  };

  const getTotalPaidSoFar = (booking: HouseBooking) => {
    const cashAndGpayPayments = paymentHistory.filter(entry =>
      (entry.type === 'initial' || entry.type === 'advance') &&
      (entry.mode === 'cash' || entry.mode === 'gpay')
    );
    return cashAndGpayPayments.reduce((total, payment) => total + payment.amount, 0);
  };

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouse || !checkInForm.guestName || !checkInForm.phoneNumber || !checkInForm.idNumber || !checkInForm.rent || !checkInForm.initialPayment) {
      toast.error('Please fill in all required fields');
      return;
    }
    setConfirmCheckInModal(true);
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedHouse) return;

    try {
      const rent = parseFloat(checkInForm.rent);
      const initialPayment = parseFloat(checkInForm.initialPayment);
      const daysOfStay = checkInForm.stayType === 'month' ? 30 : checkInForm.daysOfStay;

      const checkInDate = Timestamp.now();
      const checkOutDate = new Date();
      checkOutDate.setDate(checkOutDate.getDate() + daysOfStay);

      const bookingData = {
        houseId: selectedHouse.id,
        houseName: selectedHouse.name,
        guestName: checkInForm.guestName.toUpperCase(),
        phoneNumber: checkInForm.phoneNumber,
        idNumber: checkInForm.idNumber.toUpperCase(),
        numberOfGuests: checkInForm.numberOfGuests,
        daysOfStay: daysOfStay,
        acType: checkInForm.acType,
        rent: rent,
        initialPayment: initialPayment,
        paymentMode: checkInForm.paymentMode,
        checkedInAt: checkInDate,
        checkOutDate: Timestamp.fromDate(checkOutDate),
        isCheckedOut: false,
        pendingAmount: rent - initialPayment,
        extraFees: [],
        extensions: []
      };

      const bookingRef = await addDoc(collection(db, 'house_bookings'), bookingData);

      await addDoc(collection(db, 'house_bookings', bookingRef.id, 'payments'), {
        amount: initialPayment,
        mode: checkInForm.paymentMode,
        type: 'initial',
        timestamp: checkInDate,
        description: 'Initial payment at check-in'
      });

      await addDoc(collection(db, 'payments'), {
        type: 'check-in',
        amount: initialPayment,
        mode: checkInForm.paymentMode,
        paymentMode: checkInForm.paymentMode,
        customerName: checkInForm.guestName.toUpperCase(),
        roomNumber: selectedHouse.name,
        note: `House check-in: ${selectedHouse.name}`,
        timestamp: checkInDate,
        paymentStatus: 'completed',
        description: `Initial payment for ${selectedHouse.name}`,
      });

      toast.success('Check-in successful!');
      setConfirmCheckInModal(false);
      setCheckInModal(false);
      setSelectedHouse(null);
      setCheckInForm({
        guestName: '',
        phoneNumber: '',
        idNumber: '',
        numberOfGuests: 1,
        stayType: 'days',
        daysOfStay: 1,
        acType: 'NON AC',
        rent: '',
        initialPayment: '',
        paymentMode: 'cash'
      });
      fetchBookings();
    } catch (error) {
      console.error('Error during check-in:', error);
      toast.error('Check-in failed. Please try again.');
    }
  };

  const handleExtend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBooking || !extendForm.rentForDays) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const rentForDays = parseFloat(extendForm.rentForDays);
      const extensionData = {
        additionalDays: extendForm.additionalDays,
        rentForDays: rentForDays,
        timestamp: Timestamp.now()
      };

      const newCheckOutDate = new Date(selectedBooking.checkOutDate.toDate());
      newCheckOutDate.setDate(newCheckOutDate.getDate() + extendForm.additionalDays);

      const bookingRef = doc(db, 'house_bookings', selectedBooking.id);
      const currentExtensions = selectedBooking.extensions || [];
      const currentPending = selectedBooking.pendingAmount || 0;

      await addDoc(collection(db, 'house_bookings', selectedBooking.id, 'payments'), {
        amount: rentForDays,
        mode: 'n/a',
        type: 'extension',
        timestamp: Timestamp.now(),
        description: `Extension: ${extendForm.additionalDays} days`
      });

      await updateDoc(bookingRef, {
        extensions: [...currentExtensions, extensionData],
        checkOutDate: Timestamp.fromDate(newCheckOutDate),
        daysOfStay: selectedBooking.daysOfStay + extendForm.additionalDays,
        rent: selectedBooking.rent + rentForDays,
        pendingAmount: currentPending + rentForDays
      });

      toast.success('Stay extended successfully!');
      setExtendModal(false);
      setExtendForm({ additionalDays: 1, rentForDays: '' });

      const updatedBooking = {
        ...selectedBooking,
        extensions: [...currentExtensions, extensionData],
        checkOutDate: Timestamp.fromDate(newCheckOutDate),
        daysOfStay: selectedBooking.daysOfStay + extendForm.additionalDays,
        rent: selectedBooking.rent + rentForDays,
        pendingAmount: currentPending + rentForDays
      };
      setSelectedBooking(updatedBooking);
      await fetchPaymentHistory(selectedBooking.id);
      fetchBookings();
    } catch (error) {
      console.error('Error extending stay:', error);
      toast.error('Failed to extend stay');
    }
  };

  const handleAddExtraFee = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBooking || !extraFeeForm.description || !extraFeeForm.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const amount = parseFloat(extraFeeForm.amount);
      const extraFeeData = {
        description: extraFeeForm.description.toUpperCase(),
        amount: amount,
        timestamp: Timestamp.now()
      };

      const bookingRef = doc(db, 'house_bookings', selectedBooking.id);
      const currentExtraFees = selectedBooking.extraFees || [];
      const currentPending = selectedBooking.pendingAmount || 0;

      await addDoc(collection(db, 'house_bookings', selectedBooking.id, 'payments'), {
        amount: amount,
        mode: 'n/a',
        type: 'extra-fee',
        timestamp: Timestamp.now(),
        description: extraFeeForm.description.toUpperCase()
      });

      await updateDoc(bookingRef, {
        extraFees: [...currentExtraFees, extraFeeData],
        rent: selectedBooking.rent + amount,
        pendingAmount: currentPending + amount
      });

      toast.success('Extra fee added successfully!');
      setExtraFeeModal(false);
      setExtraFeeForm({ description: '', amount: '' });

      const updatedBooking = {
        ...selectedBooking,
        extraFees: [...currentExtraFees, extraFeeData],
        rent: selectedBooking.rent + amount,
        pendingAmount: currentPending + amount
      };
      setSelectedBooking(updatedBooking);
      await fetchPaymentHistory(selectedBooking.id);
      fetchBookings();
    } catch (error) {
      console.error('Error adding extra fee:', error);
      toast.error('Failed to add extra fee');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBooking || !paymentAmount) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const amount = parseFloat(paymentAmount);
      if (amount <= 0) {
        toast.error('Amount must be greater than zero');
        return;
      }

      await addDoc(collection(db, 'house_bookings', selectedBooking.id, 'payments'), {
        amount: amount,
        mode: paymentMode,
        type: 'advance',
        timestamp: Timestamp.now(),
        description: 'Additional payment'
      });

      const bookingRef = doc(db, 'house_bookings', selectedBooking.id);
      await updateDoc(bookingRef, {
        initialPayment: increment(amount),
        pendingAmount: increment(-amount)
      });

      await addDoc(collection(db, 'payments'), {
        type: 'advance',
        amount: amount,
        mode: paymentMode,
        paymentMode: paymentMode,
        customerName: selectedBooking.guestName,
        roomNumber: selectedBooking.houseName,
        note: `Additional payment for ${selectedBooking.houseName}`,
        timestamp: Timestamp.now(),
        paymentStatus: 'completed',
        description: 'Additional house payment',
      });

      toast.success('Payment added successfully!');
      setAddPaymentModal(false);
      setPaymentAmount('');
      setPaymentMode('cash');

      const updatedBooking = {
        ...selectedBooking,
        initialPayment: selectedBooking.initialPayment + amount,
        pendingAmount: Math.max(0, selectedBooking.pendingAmount - amount)
      };
      setSelectedBooking(updatedBooking);
      await fetchPaymentHistory(selectedBooking.id);
      fetchBookings();
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('Failed to add payment');
    }
  };

  const handleCheckout = async () => {
    if (!selectedBooking) return;

    const pending = getTotalRentSoFar(selectedBooking) - getTotalPaidSoFar(selectedBooking);
    if (pending > 0) {
      toast.error(`Pending amount ₹${pending} must be cleared before checkout.`);
      return;
    }

    try {
      const bookingRef = doc(db, 'house_bookings', selectedBooking.id);
      await updateDoc(bookingRef, {
        isCheckedOut: true,
        checkedOutAt: Timestamp.now()
      });

      toast.success('Checkout successful!');
      setSelectedBooking(null);
      setPaymentHistory([]);
      fetchBookings();
    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error('Checkout failed. Please try again.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">House Management</h1>
        <p className="text-gray-600">Manage check-ins, extensions, and extra fees for houses</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOUSES.map((house) => {
            const status = getHouseStatus(house.id);
            const booking = getHouseBooking(house.id);

            return (
              <motion.div
                key={house.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleHouseClick(house)}
                className={`cursor-pointer rounded-lg border-2 shadow-lg overflow-hidden transition-all duration-200 ${
                  status === 'booked'
                    ? 'border-red-500 bg-red-50'
                    : 'border-green-500 bg-green-50 hover:shadow-xl'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-center justify-center mb-4">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        status === 'booked' ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    >
                      <Home className="h-8 w-8 text-white" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-center mb-2">{house.name}</h3>

                  <div
                    className={`text-center text-sm font-medium py-1 px-3 rounded-full ${
                      status === 'booked'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-green-200 text-green-800'
                    }`}
                  >
                    {status === 'booked' ? 'BOOKED' : 'AVAILABLE'}
                  </div>

                  {booking && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center text-gray-700">
                          <Users className="h-4 w-4 mr-2" />
                          <span className="font-medium">{booking.guestName}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>
                            {booking.daysOfStay} days
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Clock className="h-4 w-4 mr-2" />
                          <span>
                            Until: {new Date(booking.checkOutDate.toDate()).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        {booking.pendingAmount > 0 && (
                          <div className="flex items-center text-red-600 font-semibold">
                            <DollarSign className="h-4 w-4 mr-2" />
                            <span>Pending: ₹{booking.pendingAmount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {selectedBooking && !checkInModal && !extendModal && !extraFeeModal && !addPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{selectedBooking.houseName}</h2>
              <button
                onClick={() => {
                  setSelectedBooking(null);
                  setPaymentHistory([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Guest Name</p>
                  <p className="font-medium">{selectedBooking.guestName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone Number</p>
                  <p className="font-medium">{selectedBooking.phoneNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">ID Number</p>
                  <p className="font-medium">{selectedBooking.idNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Number of Guests</p>
                  <p className="font-medium">{selectedBooking.numberOfGuests}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Room Type</p>
                  <p className="font-medium">{selectedBooking.acType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Days of Stay</p>
                  <p className="font-medium">{selectedBooking.daysOfStay} days</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Check-out Date</p>
                  <p className="font-medium">
                    {new Date(selectedBooking.checkOutDate.toDate()).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Rent</p>
                    <p className="font-bold text-lg">₹{getTotalRentSoFar(selectedBooking).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Paid Amount</p>
                    <p className="font-bold text-lg text-green-600">
                      ₹{getTotalPaidSoFar(selectedBooking).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pending Amount</p>
                    <p className="font-bold text-lg text-red-600">
                      ₹{Math.max(0, getTotalRentSoFar(selectedBooking) - getTotalPaidSoFar(selectedBooking)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
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
                          case 'Rent':
                            process = 'Check-in';
                            rentAmount = entry.amount;
                            break;
                          case 'extension':
                            process = 'Extension';
                            rentAmount = entry.amount;
                            break;
                          case 'extra-fee':
                            process = entry.description || 'Extra Fee';
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
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAddPaymentModal(true)}
                className="flex-1 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 flex items-center justify-center"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Add Payment
              </button>
              <button
                onClick={() => setExtendModal(true)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Extend Stay
              </button>
              <button
                onClick={() => setExtraFeeModal(true)}
                className="flex-1 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 flex items-center justify-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Extra Fee
              </button>
              <button
                onClick={handleCheckout}
                disabled={getTotalRentSoFar(selectedBooking) - getTotalPaidSoFar(selectedBooking) > 0}
                className={`flex-1 py-2 text-white rounded-md flex items-center justify-center ${
                  getTotalRentSoFar(selectedBooking) - getTotalPaidSoFar(selectedBooking) > 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                Checkout
              </button>
            </div>

            {selectedBooking.isCheckedOut === false && (
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-bold mb-4 flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Previous Bookings for this House
                </h3>
                <div className="space-y-4">
                  {getHouseHistory(selectedBooking.houseId).slice(0, 5).map((historicalBooking) => (
                    <div key={historicalBooking.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">{historicalBooking.guestName}</span>
                        </div>
                        <div className="text-right">
                          {new Date(historicalBooking.checkedInAt.toDate()).toLocaleDateString('en-IN')} -
                          {historicalBooking.checkedOutAt ? ` ${new Date(historicalBooking.checkedOutAt.toDate()).toLocaleDateString('en-IN')}` : ' Present'}
                        </div>
                        <div className="text-gray-600">Total: ₹{historicalBooking.rent.toFixed(2)}</div>
                        <div className="text-gray-600 text-right">Paid: ₹{historicalBooking.initialPayment.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                  {getHouseHistory(selectedBooking.houseId).length === 0 && (
                    <p className="text-gray-500 text-center py-4">No previous bookings</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {checkInModal && selectedHouse && !confirmCheckInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8"
          >
            <h2 className="text-2xl font-bold mb-6">Check-In: {selectedHouse.name}</h2>

            <form onSubmit={handleCheckInSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guest Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={checkInForm.guestName}
                    onChange={(e) => setCheckInForm({ ...checkInForm, guestName: e.target.value.toUpperCase() })}
                    className="w-full rounded-md border-gray-300 shadow-sm uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={checkInForm.phoneNumber}
                    onChange={(e) => setCheckInForm({ ...checkInForm, phoneNumber: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={checkInForm.idNumber}
                    onChange={(e) => setCheckInForm({ ...checkInForm, idNumber: e.target.value.toUpperCase() })}
                    className="w-full rounded-md border-gray-300 shadow-sm uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Guests
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={checkInForm.numberOfGuests}
                    onChange={(e) => setCheckInForm({ ...checkInForm, numberOfGuests: parseInt(e.target.value) })}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={checkInForm.acType === 'AC'}
                        onChange={() => setCheckInForm({ ...checkInForm, acType: 'AC' })}
                        className="mr-2"
                      />
                      AC
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={checkInForm.acType === 'NON AC'}
                        onChange={() => setCheckInForm({ ...checkInForm, acType: 'NON AC' })}
                        className="mr-2"
                      />
                      NON AC
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days of Stay <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={checkInForm.stayType === 'month'}
                        onChange={() => setCheckInForm({ ...checkInForm, stayType: 'month', daysOfStay: 30 })}
                        className="mr-2"
                      />
                      1 Month (30 days)
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={checkInForm.stayType === 'days'}
                        onChange={() => setCheckInForm({ ...checkInForm, stayType: 'days' })}
                        className="mr-2"
                      />
                      Custom Days
                    </label>
                  </div>
                  {checkInForm.stayType === 'days' && (
                    <input
                      type="number"
                      min="1"
                      value={checkInForm.daysOfStay}
                      onChange={(e) => setCheckInForm({ ...checkInForm, daysOfStay: parseInt(e.target.value) })}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full rounded-md border-gray-300 shadow-sm mt-2"
                      placeholder="Enter number of days"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rent (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={checkInForm.rent}
                    onChange={(e) => setCheckInForm({ ...checkInForm, rent: e.target.value })}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Payment (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={checkInForm.initialPayment}
                    onChange={(e) => setCheckInForm({ ...checkInForm, initialPayment: e.target.value })}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-md border-gray-300 shadow-sm"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Mode <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={checkInForm.paymentMode === 'cash'}
                        onChange={() => setCheckInForm({ ...checkInForm, paymentMode: 'cash' })}
                        className="mr-2"
                      />
                      Cash
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={checkInForm.paymentMode === 'gpay'}
                        onChange={() => setCheckInForm({ ...checkInForm, paymentMode: 'gpay' })}
                        className="mr-2"
                      />
                      GPay
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setCheckInModal(false);
                    setSelectedHouse(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Review Details
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {confirmCheckInModal && selectedHouse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
          >
            <h2 className="text-2xl font-bold mb-6">Confirm Check-In Details</h2>

            <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">House</p>
                  <p className="font-medium">{selectedHouse.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Guest Name</p>
                  <p className="font-medium">{checkInForm.guestName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone Number</p>
                  <p className="font-medium">{checkInForm.phoneNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">ID Number</p>
                  <p className="font-medium">{checkInForm.idNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Room Type</p>
                  <p className="font-medium">{checkInForm.acType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Days of Stay</p>
                  <p className="font-medium">{checkInForm.daysOfStay} days</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Rent</p>
                  <p className="font-medium">₹{checkInForm.rent}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Initial Payment</p>
                  <p className="font-medium">₹{checkInForm.initialPayment}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Mode</p>
                  <p className="font-medium uppercase">{checkInForm.paymentMode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pending Amount</p>
                  <p className="font-medium text-red-600">
                    ₹{(parseFloat(checkInForm.rent) - parseFloat(checkInForm.initialPayment)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmCheckInModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCheckIn}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
              >
                Confirm Check-In
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {extendModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h2 className="text-xl font-bold mb-4">Extend Stay</h2>

            <form onSubmit={handleExtend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Days <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={extendForm.additionalDays}
                  onChange={(e) => setExtendForm({ ...extendForm, additionalDays: parseInt(e.target.value) })}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rent for Additional Days (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={extendForm.rentForDays}
                  onChange={(e) => setExtendForm({ ...extendForm, rentForDays: e.target.value })}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setExtendModal(false);
                    setExtendForm({ additionalDays: 1, rentForDays: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Extend Stay
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {extraFeeModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h2 className="text-xl font-bold mb-4">Add Extra Fee</h2>

            <form onSubmit={handleAddExtraFee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description / Remark <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={extraFeeForm.description}
                  onChange={(e) => setExtraFeeForm({ ...extraFeeForm, description: e.target.value.toUpperCase() })}
                  className="w-full rounded-md border-gray-300 shadow-sm uppercase"
                  placeholder="e.g., ELECTRICITY BILL, DAMAGE CHARGES"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={extraFeeForm.amount}
                  onChange={(e) => setExtraFeeForm({ ...extraFeeForm, amount: e.target.value })}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setExtraFeeModal(false);
                    setExtraFeeForm({ description: '', amount: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
                >
                  Add Fee
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {addPaymentModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h2 className="text-xl font-bold mb-4">Add Payment</h2>

            <form onSubmit={handleAddPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-full rounded-md border-gray-300 shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Mode <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={paymentMode === 'cash'}
                      onChange={() => setPaymentMode('cash')}
                      className="mr-2"
                    />
                    Cash
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={paymentMode === 'gpay'}
                      onChange={() => setPaymentMode('gpay')}
                      className="mr-2"
                    />
                    GPay
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setAddPaymentModal(false);
                    setPaymentAmount('');
                    setPaymentMode('cash');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-500 text-white rounded-md text-sm font-medium hover:bg-yellow-600"
                >
                  Add Payment
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default HousePage;
