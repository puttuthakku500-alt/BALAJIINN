import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, addDoc, Timestamp, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { Calendar, DollarSign, CreditCard, Wallet, TrendingUp, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';

type Payment = {
  id: string;
  amount: number;
  timestamp: any;
  customerName: string;
  roomNumber: string;
  type: string;
  paymentStatus: string;
  description: string;
  paymentMode?: string;
  mode?: string;
  date_of_booking?: string;
};

type CollectionLog = {
  id: string;
  cashAmount: number;
  gpayAmount: number;
  totalAmount: number;
  collectedAt: any;
};

const NewPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [collectionLogs, setCollectionLogs] = useState<CollectionLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [pendingCash, setPendingCash] = useState(0);
  const [pendingGpay, setPendingGpay] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollecting, setIsCollecting] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchPayments(),
        fetchCollectionLogs(),
        calculatePendingAmounts()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load payments data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const paymentRecords: Payment[] = [];

      const checkinsSnapshot = await getDocs(collection(db, 'checkins'));

      for (const checkinDoc of checkinsSnapshot.docs) {
        const checkinData = checkinDoc.data();

        const paymentsSnapshot = await getDocs(collection(db, 'checkins', checkinDoc.id, 'payments'));
        const additionalPayments = paymentsSnapshot.docs.map((payDoc) => {
          const payData = payDoc.data();
          return {
            id: payDoc.id,
            amount: payData.amount,
            timestamp: payData.timestamp?.toDate() || new Date(),
            type: payData.type || 'additional',
            paymentStatus: 'completed',
            customerName: checkinData.guestName || 'Guest',
            roomNumber: checkinData.roomNumber || 'N/A',
            description: `${payData.type === 'extension' ? 'Stay extension' : payData.type === 'initial' ? 'Initial payment' : 'Additional payment'}`,
            paymentMode: payData.mode,
            mode: payData.mode
          };
        });

        paymentRecords.push(...additionalPayments);
      }

      const directPaymentsSnapshot = await getDocs(collection(db, 'payments'));
      const directPayments = directPaymentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: data.amount || 0,
          timestamp: data.timestamp?.toDate() || new Date(),
          type: data.type || 'payment',
          paymentStatus: data.paymentStatus || 'completed',
          customerName: data.customerName || data.customer_name || 'Guest',
          roomNumber: data.roomNumber || 'N/A',
          description: data.description || data.note || 'Payment',
          paymentMode: data.paymentMode || data.mode,
          mode: data.mode || data.paymentMode
        };
      });

      paymentRecords.push(...directPayments);
      setPayments(paymentRecords);
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  };

  const fetchCollectionLogs = async () => {
    try {
      const logsQuery = query(
        collection(db, 'collection_logs'),
        firestoreOrderBy('collectedAt', 'desc')
      );
      const logsSnapshot = await getDocs(logsQuery);
      const logs = logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CollectionLog[];

      setCollectionLogs(logs);
    } catch (error) {
      console.error('Error fetching collection logs:', error);
    }
  };

  const calculatePendingAmounts = async () => {
    try {
      const checkinsSnapshot = await getDocs(collection(db, 'checkins'));
      let totalPendingCash = 0;
      let totalPendingGpay = 0;

      for (const checkinDoc of checkinsSnapshot.docs) {
        const checkinData = checkinDoc.data();
        const paymentsSnapshot = await getDocs(collection(db, 'checkins', checkinDoc.id, 'payments'));

        paymentsSnapshot.docs.forEach(payDoc => {
          const payment = payDoc.data();
          const amount = parseFloat(payment.amount) || 0;

          if (amount > 0 && payment.type !== 'collected') {
            if (payment.mode === 'cash') {
              totalPendingCash += amount;
            } else if (payment.mode === 'gpay') {
              totalPendingGpay += amount;
            }
          }
        });
      }

      setPendingCash(totalPendingCash);
      setPendingGpay(totalPendingGpay);
    } catch (error) {
      console.error('Error calculating pending amounts:', error);
    }
  };

  const handleCollect = async () => {
    if (pendingCash === 0 && pendingGpay === 0) {
      toast.info('No pending amounts to collect');
      return;
    }

    setIsCollecting(true);
    try {
      await addDoc(collection(db, 'collection_logs'), {
        cashAmount: pendingCash,
        gpayAmount: pendingGpay,
        totalAmount: pendingCash + pendingGpay,
        collectedAt: Timestamp.now()
      });

      toast.success('Collection recorded successfully');
      setPendingCash(0);
      setPendingGpay(0);
      fetchCollectionLogs();
    } catch (error) {
      console.error('Error recording collection:', error);
      toast.error('Failed to record collection');
    } finally {
      setIsCollecting(false);
    }
  };

  const getDailyPayments = (date: Date) => {
    return payments.filter(payment => {
      const paymentDate = payment.timestamp instanceof Date ?
        payment.timestamp :
        new Date(payment.timestamp);

      return (
        paymentDate.getDate() === date.getDate() &&
        paymentDate.getMonth() === date.getMonth() &&
        paymentDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getDailyCash = (date: Date) => {
    const dailyPayments = getDailyPayments(date);
    return dailyPayments
      .filter(p => (p.mode === 'cash' || p.paymentMode === 'cash') && p.amount > 0)
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  };

  const getDailyGpay = (date: Date) => {
    const dailyPayments = getDailyPayments(date);
    return dailyPayments
      .filter(p => (p.mode === 'gpay' || p.paymentMode === 'gpay') && p.amount > 0)
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();

    const days = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date, isCurrentMonth: false });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push({ date, isCurrentMonth: true });
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({ date, isCurrentMonth: false });
    }

    return days;
  };

  const isSelectedDate = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const calendarDays = generateCalendarDays();
  const dailyPayments = getDailyPayments(selectedDate);
  const dailyCash = getDailyCash(selectedDate);
  const dailyGpay = getDailyGpay(selectedDate);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Payments</h1>
        <p className="text-gray-600">Track and manage all payment transactions</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Pending Collections */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Payment Pending to Collect</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Wallet className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-sm text-green-700">Pending Cash</span>
                </div>
                <p className="text-2xl font-bold text-green-800">₹{pendingCash.toFixed(2)}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-sm text-blue-700">Pending GPay</span>
                </div>
                <p className="text-2xl font-bold text-blue-800">₹{pendingGpay.toFixed(2)}</p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center mb-2">
                    <DollarSign className="h-5 w-5 text-purple-600 mr-2" />
                    <span className="text-sm text-purple-700">Total Pending</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-800 mb-3">
                    ₹{(pendingCash + pendingGpay).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={handleCollect}
                  disabled={isCollecting || (pendingCash === 0 && pendingGpay === 0)}
                  className="w-full py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                >
                  {isCollecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Collecting...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Collect
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mini Calendar */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={goToPreviousMonth}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                >
                  Today
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="bg-gray-50 py-2 text-center text-sm font-medium text-gray-500"
                >
                  {day}
                </div>
              ))}

              {calendarDays.map((day, index) => {
                const cash = getDailyCash(day.date);
                const gpay = getDailyGpay(day.date);
                const hasPayments = cash > 0 || gpay > 0;

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day.date)}
                    className={`
                      relative h-24 p-1 bg-white hover:bg-gray-50 focus:z-10 focus:outline-none
                      ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
                      ${isSelectedDate(day.date) ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
                      ${isToday(day.date) && !isSelectedDate(day.date) ? 'border border-blue-500' : ''}
                    `}
                  >
                    <time
                      dateTime={day.date.toISOString().split('T')[0]}
                      className={`
                        ml-1 flex h-6 w-6 items-center justify-center rounded-full text-sm
                        ${isSelectedDate(day.date)
                          ? 'bg-blue-600 font-semibold text-white'
                          : isToday(day.date)
                            ? 'bg-blue-100 text-blue-700 font-semibold'
                            : 'text-gray-900'}
                      `}
                    >
                      {day.date.getDate()}
                    </time>

                    {hasPayments && (
                      <div className="mt-1 space-y-1 text-left">
                        {cash > 0 && (
                          <div className={`
                            text-xs px-1 py-0.5 rounded truncate
                            ${day.isCurrentMonth ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}
                          `}>
                            ₹{cash.toFixed(0)}
                          </div>
                        )}

                        {gpay > 0 && (
                          <div className={`
                            text-xs px-1 py-0.5 rounded truncate
                            ${day.isCurrentMonth ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}
                          `}>
                            ₹{gpay.toFixed(0)}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daily Transactions */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold mb-2">
                Transactions for {selectedDate.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </h2>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 font-medium">Cash: ₹{dailyCash.toFixed(2)}</span>
                <span className="text-blue-600 font-medium">GPay: ₹{dailyGpay.toFixed(2)}</span>
                <span className="text-purple-600 font-medium">Total: ₹{(dailyCash + dailyGpay).toFixed(2)}</span>
              </div>
            </div>

            {dailyPayments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Transactions</h3>
                <p className="text-gray-500">No payment records found for this date</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Guest Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Room No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dailyPayments
                      .sort((a, b) => {
                        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                        return timeB - timeA;
                      })
                      .map((payment) => {
                        const timestamp = payment.timestamp instanceof Date ?
                          payment.timestamp :
                          new Date(payment.timestamp);
                        const paymentMode = payment.mode || payment.paymentMode || 'n/a';

                        return (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {timestamp.toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {payment.customerName || 'Guest'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.roomNumber || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm font-medium ${payment.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                ₹{parseFloat(payment.amount.toString()).toFixed(2)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                paymentMode === 'cash' ? 'bg-green-100 text-green-800' :
                                paymentMode === 'gpay' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {paymentMode}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {payment.description}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Collection Logs */}
          {collectionLogs.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-gray-600" />
                  Collection Activity Logs
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cash Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        GPay Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Collected
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {collectionLogs.map((log) => {
                      const timestamp = log.collectedAt?.toDate() || new Date();

                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {timestamp.toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                            ₹{log.cashAmount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                            ₹{log.gpayAmount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 font-bold">
                            ₹{log.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NewPaymentsPage;
