import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { BedDouble, Home, Loader } from 'lucide-react';

type SummaryData = {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  cleaningRooms: number;
  // totalHouses: number;
  // availableHouses: number;
  // bookedHouses: number;
};

const RoomMatrixSummary = () => {
  const [summary, setSummary] = useState<SummaryData>({
    totalRooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    cleaningRooms: 0,
    // totalHouses: 4,
    // availableHouses: 0,
    // bookedHouses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSummary = async () => {
    try {
      const [roomsSnapshot, checkinsSnapshot, houseBookingsSnapshot] = await Promise.all([
        getDocs(collection(db, 'rooms')),
        getDocs(query(collection(db, 'checkins'), where('isCheckedOut', '==', false))),
        getDocs(query(collection(db, 'house_bookings'), where('isCheckedOut', '==', false)))
      ]);

      const rooms = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const occupiedRoomIds = new Set(
        checkinsSnapshot.docs.map(doc => doc.data().roomId)
      );

      const roomStatuses = {
        available: 0,
        occupied: 0,
        cleaning: 0,
        maintenance: 0,
      };

      rooms.forEach(room => {
        const status = occupiedRoomIds.has(room.id) ? 'occupied' : room.status;
        if (status === 'available') roomStatuses.available++;
        else if (status === 'occupied') roomStatuses.occupied++;
        else if (status === 'cleaning') roomStatuses.cleaning++;
        else if (status === 'maintenance') roomStatuses.maintenance++;
      });

      const totalHouses = 4;
      const bookedHouses = houseBookingsSnapshot.docs.length;
      const availableHouses = totalHouses - bookedHouses;

      setSummary({
        totalRooms: rooms.length,
        availableRooms: roomStatuses.available,
        occupiedRooms: roomStatuses.occupied,
        cleaningRooms: roomStatuses.cleaning,
        totalHouses,
        availableHouses,
        bookedHouses,
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching summary:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-center">
          <Loader className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Property Overview</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <BedDouble className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700">{summary.availableRooms}</p>
          <p className="text-xs text-green-600 font-medium mt-1">VACANT</p>
        </div>

        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <BedDouble className="h-6 w-6 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700">{summary.occupiedRooms}</p>
          <p className="text-xs text-red-600 font-medium mt-1">FULL</p>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Loader className="h-6 w-6 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-700">{summary.cleaningRooms}</p>
          <p className="text-xs text-yellow-600 font-medium mt-1">CLEAN</p>
        </div>

        <div className="bg-gray-50 border-2 border-gray-400 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <BedDouble className="h-6 w-6 text-gray-600" />
          </div>
          <p className="text-2xl font-bold text-gray-700">{summary.totalRooms}</p>
          <p className="text-xs text-gray-600 font-medium mt-1">TOTAL ROOMS</p>
        </div>

        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Home className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700">{summary.availableHouses}</p>
          <p className="text-xs text-green-600 font-medium mt-1">HOUSES VACANT</p>
        </div>

        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Home className="h-6 w-6 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700">{summary.bookedHouses}</p>
          <p className="text-xs text-red-600 font-medium mt-1">HOUSES FULL</p>
        </div>

        <div className="bg-gray-50 border-2 border-gray-400 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center mb-2">
            <Home className="h-6 w-6 text-gray-600" />
          </div>
          <p className="text-2xl font-bold text-gray-700">{summary.totalHouses}</p>
          <p className="text-xs text-gray-600 font-medium mt-1">TOTAL HOUSES</p>
        </div>
      </div>
    </div>
  );
};

export default RoomMatrixSummary;
