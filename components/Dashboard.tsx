import React, { useState } from 'react';
import { Medication, DoseStatus } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, AlertTriangleIcon, PillIcon, SkipIcon } from './icons';

interface DashboardProps {
  medications: Medication[];
  updateDoseStatus: (id: string, date: string, time: string, status: DoseStatus | null) => void;
  logRefill: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ medications, updateDoseStatus, logRefill }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to the start of the day
  const todayString = today.toISOString().split('T')[0];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };
  
  const getDosesForDate = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      return medications.flatMap(med => med.times.map(time => ({ ...med, date: dateStr, time })));
  };

  const upcomingMedications = getDosesForDate(today);
  const lowStockMeds = medications.filter(m => m.quantity !== undefined && m.refillThreshold !== undefined && m.quantity <= m.refillThreshold);


  const changeMonth = (offset: number) => {
    setViewDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };
  
  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthName = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
      <div className="bg-white p-4 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Previous month">
            <ChevronLeftIcon className="w-6 h-6 text-gray-600" />
          </button>
          <h3 className="font-bold text-lg text-gray-800">{monthName}</h3>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Next month">
            <ChevronRightIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-y-2 text-center text-sm">
          {weekDays.map(day => <div key={day} className="font-semibold text-gray-400 text-xs">{day}</div>)}
          {blanks.map(blank => <div key={`blank-${blank}`}></div>)}
          {days.map(day => {
            const dayDate = new Date(year, month, day);
            dayDate.setHours(0,0,0,0);
            const dateStr = dayDate.toISOString().split('T')[0];
            const isToday = dayDate.getTime() === today.getTime();
            const isSelected = selectedDate && dayDate.getTime() === selectedDate.getTime();

            const dosesForDay = getDosesForDate(dayDate);
            const totalDoses = dosesForDay.length;
            const takenDoses = dosesForDay.filter(dose => dose.doseStatus?.[`${dateStr}T${dose.time}`] === 'taken').length;
            
            let adherenceRing = null;
            if (totalDoses > 0 && (dayDate <= today)) {
              const adherenceRatio = takenDoses / totalDoses;
              if (adherenceRatio === 1) {
                adherenceRing = 'ring-green-500';
              } else if (adherenceRatio > 0) {
                adherenceRing = 'ring-yellow-500';
              } else if (dayDate < today) {
                adherenceRing = 'ring-red-500';
              }
            }

            return (
              <div key={day} className="flex flex-col items-center cursor-pointer" onClick={() => setSelectedDate(dayDate)}>
                <span className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 ${isToday ? 'brand-gradient text-white font-bold shadow-md' : isSelected ? 'bg-gray-200 text-gray-800' : 'text-gray-700 hover:bg-gray-100'} ${adherenceRing ? `ring-2 ring-offset-2 ${adherenceRing}` : ''}`}>
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const renderSelectedDateDetails = () => {
      if (!selectedDate) return null;
      
      const dosesForDay = getDosesForDate(selectedDate);
      if (dosesForDay.length === 0) return null;

      const dateStr = selectedDate.toISOString().split('T')[0];
      const dateString = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

      return (
          <div className="bg-white p-4 rounded-xl shadow-lg space-y-3 mt-4 animate-fade-in">
              <h3 className="font-bold text-lg text-gray-800">History for {dateString}</h3>
              {dosesForDay.map((dose, index) => {
                  const status = dose.doseStatus?.[`${dateStr}T${dose.time}`];
                  const statusConfig = {
                      taken: { color: 'bg-green-500', label: 'Taken', badge: 'bg-green-100 text-green-800' },
                      skipped: { color: 'bg-gray-400', label: 'Skipped', badge: 'bg-gray-100 text-gray-800' },
                      missed: { color: 'bg-red-500', label: 'Missed', badge: 'bg-red-100 text-red-800' },
                  };
                  const currentStatus = status ? statusConfig[status] : statusConfig.missed;
                  
                  return (
                    <div key={`${dose.id}-${dose.time}-${index}`} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                        <div className="flex items-center space-x-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${currentStatus.color}`}></div>
                            <div>
                                <p className="font-semibold text-gray-800">{dose.name} <span className="text-sm text-gray-500 font-normal">{dose.dosage}</span></p>
                                <p className="text-sm text-gray-500">{dose.time}</p>
                            </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${currentStatus.badge}`}>
                            {currentStatus.label}
                        </span>
                    </div>
                  );
              })}
          </div>
      )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-800">{getGreeting()}</h2>
        <p className="text-gray-500">{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {renderCalendar()}
      {renderSelectedDateDetails()}

      {lowStockMeds.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-r-lg shadow-lg" role="alert">
              <div className="flex">
                  <div className="py-1"><AlertTriangleIcon className="h-6 w-6 text-yellow-500 mr-4"/></div>
                  <div className="flex-1">
                      <p className="font-bold">Refill Reminder</p>
                       <div className="space-y-2 mt-2">
                        {lowStockMeds.map(med => (
                           <div key={med.id} className="flex items-center justify-between">
                             <p className="text-sm">{med.name} is running low ({med.quantity} left).</p>
                             <button 
                                onClick={() => logRefill(med.id)} 
                                className="px-3 py-1 text-xs font-semibold bg-yellow-200 text-yellow-800 rounded-full hover:bg-yellow-300 transition-colors"
                              >
                                Log Refill
                              </button>
                           </div>
                        ))}
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      {upcomingMedications.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-bold text-xl text-gray-800 pt-2">Today's Medications</h3>
          {upcomingMedications.sort((a,b) => a.time.localeCompare(b.time)).map((dose, index) => {
            const status = dose.doseStatus?.[`${todayString}T${dose.time}`];
            const pillDetails = [dose.color, dose.shape, dose.imprint && `Imprint: ${dose.imprint}`].filter(Boolean).join(' • ');

            return (
              <div key={`${dose.id}-${dose.time}-${index}`} className="bg-white p-4 rounded-xl shadow-lg flex items-center justify-between transition-shadow hover:shadow-xl">
                <div className="flex items-center space-x-4">
                   <div className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-200">
                      {dose.image ? 
                        <img src={dose.image} alt={dose.name} className="w-14 h-14 object-cover rounded-full shadow-inner" /> :
                        <PillIcon className="w-7 h-7 text-indigo-500" />
                      }
                   </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-lg">{dose.name}</p>
                    <p className="text-sm text-gray-500">{dose.dosage} at {dose.time}</p>
                    {pillDetails && <p className="text-xs text-gray-400 mt-1">{pillDetails}</p>}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                    {status !== 'taken' && (
                        <button
                          onClick={() => {
                            const newStatus = status === 'skipped' ? null : 'skipped';
                            updateDoseStatus(dose.id, todayString, dose.time, newStatus);
                          }}
                          className={`p-2 rounded-full transition-colors ${
                            status === 'skipped' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          aria-label="Skip dose"
                        >
                          <SkipIcon className="h-5 w-5" />
                        </button>
                    )}
                    <button
                      onClick={() => {
                        const newStatus = status === 'taken' ? null : 'taken';
                        updateDoseStatus(dose.id, todayString, dose.time, newStatus);
                      }}
                      className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 w-32 text-center ${
                        status === 'taken'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'brand-gradient text-white hover:opacity-90 shadow-md'
                      }`}
                    >
                      {status === 'taken' ? 'Taken' : 'Mark as Taken'}
                    </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10 px-4 bg-white rounded-xl shadow-lg">
          <PillIcon className="mx-auto h-12 w-12 text-gray-300"/>
          <p className="text-gray-600 font-medium mt-4">No medications scheduled for today.</p>
          <p className="text-gray-500 text-sm mt-1">Add a new medication to get started!</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;