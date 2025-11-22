import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';

type RoomFormData = {
  roomNumber: string;
  floor: string;
  type: 'ac' | 'non-ac' | 'house';
};

const AddRoom = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<RoomFormData>();
  const navigate = useNavigate();

  const onSubmit = async (data: RoomFormData) => {
    try {
      const parsedData = {
        ...data,
        roomNumber: String(data.roomNumber),
        floor: String(data.floor),
        status: 'available' as const,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'rooms'), parsedData);
      toast.success('Room added successfully');
      navigate('/rooms');
    } catch (error) {
      console.error('Error adding room:', error);
      toast.error('Failed to add room');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Add New Room</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white shadow-md rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Room Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
            <input
              type="string"
              {...register('roomNumber', {
                required: 'Room number is required',
                min: { value: 100, message: 'Room number must be at least 100' }
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.roomNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.roomNumber.message}</p>
            )}
          </div>

          {/* Floor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
            <input
              type="string"
              {...register('floor', {
                required: 'Floor is required',
                min: { value: 1, message: 'Floor must be at least 1' }
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.floor && (
              <p className="mt-1 text-sm text-red-600">{errors.floor.message}</p>
            )}
          </div>

          {/* Room Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
            <select
              {...register('type', { required: 'Room type is required' })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select type</option>
              <option value="ac">AC</option>
              <option value="non-ac">Non-AC</option>
              <option value="house">House</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/rooms')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Add Room
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddRoom;