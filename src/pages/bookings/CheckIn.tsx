import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { toast } from 'react-toastify';

const CheckIn: React.FC = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [roomNumber, setRoomNumber] = useState<string>('');
  
  useEffect(() => {
    const fetchRoomNumber = async () => {
      if (roomId) {
        const roomDoc = await getDoc(doc(db, 'rooms', roomId));
        if (roomDoc.exists()) {
          setRoomNumber(roomDoc.data().roomNumber);
        }
      }
    };
    fetchRoomNumber();
  }, [roomId]);

  const [formData, setFormData] = useState({
    guestName: '',
    phoneNumber: '',
    idNumber: '',
    numberOfGuests: 1,
    acType: 'NON AC' as 'NON AC' | 'AC',
    rent: '',
    initialPayment: '',
    paymentMode: 'cash' as 'cash' | 'gpay'
  });
  const [confirmModal, setConfirmModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const processedValue = ['guestName', 'idNumber'].includes(name) ? value.toUpperCase() : value;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'numberOfGuests' ? parseInt(value) : processedValue,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.guestName ||
      !formData.phoneNumber ||
      !formData.idNumber ||
      !formData.rent ||
      !formData.initialPayment
    ) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setConfirmModal(true);
  };

  const confirmCheckIn = async () => {
    setProcessing(true);
    try {
      const checkinRef = await addDoc(collection(db, 'checkins'), {
        ...formData,
        roomId,
        roomNumber,
        rent: parseFloat(formData.rent),
        initialPayment: parseFloat(formData.initialPayment),
        isCheckedOut: false,
        checkedInAt: Timestamp.now(),
      });

      await addDoc(collection(db, 'checkins', checkinRef.id, 'payments'), {
        amount: parseFloat(formData.initialPayment),
        mode: formData.paymentMode,
        type: 'initial',
        timestamp: Timestamp.now(),
        description: 'Initial payment at check-in'
      });

      toast.success('Check-in completed successfully!');
      navigate('/rooms/matrix');
    } catch (error) {
      console.error('Error during check-in:', error);
      toast.error('Check-in failed. Please try again.');
    } finally {
      setProcessing(false);
      setConfirmModal(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Check In - Room {roomNumber}</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Guest Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Guest Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="guestName"
              value={formData.guestName}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm uppercase"
              placeholder="Enter guest name"
              required
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Enter phone number"
              required
            />
          </div>

          {/* ID Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="idNumber"
              value={formData.idNumber}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 shadow-sm uppercase"
              placeholder="Enter ID number"
              required
            />
          </div>

          {/* Number of Guests */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Guests
            </label>
            <input
              type="number"
              name="numberOfGuests"
              min="1"
              value={formData.numberOfGuests}
              onChange={handleChange}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          {/* AC or NON AC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Type
            </label>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="acType"
                  value="NON AC"
                  checked={formData.acType === 'NON AC'}
                  onChange={handleChange}
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2">NON AC</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="acType"
                  value="AC"
                  checked={formData.acType === 'AC'}
                  onChange={handleChange}
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2">AC</span>
              </label>
            </div>
          </div>

          {/* Rent of the Room */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rent (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="rent"
              value={formData.rent}
              onChange={handleChange}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Enter rent amount"
              required
            />
          </div>

          {/* Initial Payment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Payment (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="initialPayment"
              value={formData.initialPayment}
              onChange={handleChange}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Enter initial payment amount"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Mode
            </label>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="paymentMode"
                  value="cash"
                  checked={formData.paymentMode === 'cash'}
                  onChange={handleChange}
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2">Cash</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="paymentMode"
                  value="gpay"
                  checked={formData.paymentMode === 'gpay'}
                  onChange={handleChange}
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2">GPay</span>
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/rooms/matrix')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Complete Check In
            </button>
          </div>
        </form>
      </div>

      {confirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Confirm Check-In</h2>
            <p className="text-sm text-gray-600 mb-4">Please review the details before confirming:</p>

            <div className="space-y-2 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Guest Name:</span>
                <span className="font-medium">{formData.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone Number:</span>
                <span className="font-medium">{formData.phoneNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">ID Number:</span>
                <span className="font-medium">{formData.idNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Number of Guests:</span>
                <span className="font-medium">{formData.numberOfGuests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Room Type:</span>
                <span className="font-medium">{formData.acType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rent:</span>
                <span className="font-medium">₹{parseFloat(formData.rent).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Initial Payment:</span>
                <span className="font-medium">₹{parseFloat(formData.initialPayment).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Mode:</span>
                <span className="font-medium capitalize">{formData.paymentMode}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-700 font-medium">Pending Amount:</span>
                <span className="font-bold text-red-600">₹{(parseFloat(formData.rent) - parseFloat(formData.initialPayment)).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmModal(false)}
                disabled={processing}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCheckIn}
                disabled={processing}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  'Confirm Check-In'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckIn;
