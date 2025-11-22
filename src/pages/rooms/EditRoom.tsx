
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';

type RoomFormData = {
  roomNumber: string;
  floor: string;
  type: 'AC' | 'NON-AC';
};

const EditRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<RoomFormData>();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (roomId) {
      fetchRoomData();
    }
  }, [roomId]);

  const fetchRoomData = async () => {
    try {
      const roomRef = doc(db, 'rooms', roomId!);
      const roomSnap = await getDoc(roomRef);
      
      if (roomSnap.exists()) {
        const roomData = roomSnap.data();
        reset({
          roomNumber: roomData.roomNumber,
          floor: roomData.floor,
          type: roomData.type,
        });
      } else {
        toast.error('Room not found');
        navigate('/rooms');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching room data:', error);
      toast.error('Failed to fetch room data');
      setLoading(false);
      navigate('/rooms');
    }
  };

  const onSubmit = async (data: RoomFormData) => {
    try {
      const parsedData = {
        ...data,
        roomNumber: Number(data.roomNumber),
        floor: Number(data.floor),
        updatedAt: new Date()
      };
      
      const roomRef = doc(db, 'rooms', roomId!);
      await updateDoc(roomRef, parsedData);
      
      toast.success('Room updated successfully');
      navigate('/rooms');
    } catch (error) {
      console.error('Error updating room:', error);
      toast.error('Failed to update room');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Edit Room</h1>
      
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-md rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Number
            </label>
            <input
              type="string"
              {...register('roomNumber', { 
                required: 'Room number is required',
                min: {
                  value: 100,
                  message: 'Room number must be at least 100'
                }
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.roomNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.roomNumber.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Floor
            </label>
            <input
              type="string"
              {...register('floor', { 
                required: 'Floor is required',
                min: {
                  value: 1,
                  message: 'Floor must be at least 1'
                }
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.floor && (
              <p className="mt-1 text-sm text-red-600">{errors.floor.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Type
            </label>
            <select
              {...register('type', { required: 'Room type is required' })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="ac">AC</option>
              <option value="non-ac">Non-AC</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>
          
          
        </div>
        
        
        
        <div className="flex justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/rooms')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
          >
            Update Room
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditRoom;
