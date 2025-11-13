import React, { useMemo } from 'react';
import { Medication } from '../types';

interface ReportsScreenProps {
  medications: Medication[];
}

const MedicationHistoryLog: React.FC<{medications: Medication[]}> = ({ medications }) => {
    const history = useMemo(() => {
        const log: {date: Date; med: Medication, time: string, status: 'taken' | 'skipped' | 'missed', reason?: string}[] = [];
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        medications.forEach(med => {
            for (let i = 0; i < 30; i++) { // Look back 30 days
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                
                if (date > new Date()) continue; // Don't log future doses

                const dateStr = date.toISOString().split('T')[0];
                med.times.forEach(time => {
                    const dateTime = new Date(`${dateStr}T${time}`);
                    if (dateTime > new Date()) return; // Don't log future times on the current day

                    const dateTimeKey = `${dateStr}T${time}`;
                    const status = med.doseStatus?.[dateTimeKey];

                    if (status) {
                        log.push({ date: dateTime, med, time, status });
                    } else {
                        const reason = med.missedDoseReasons?.[dateTimeKey];
                        log.push({ date: dateTime, med, time, status: 'missed', reason });
                    }
                });
            }
        });
        
        return log.sort((a, b) => b.date.getTime() - a.date.getTime());

    }, [medications]);

    if (history.length === 0) {
        return <p className="text-center text-gray-500 py-8">No medication history available.</p>;
    }

    return (
        <div className="space-y-3">
            {history.map((entry, index) => {
                const statusConfig = {
                    taken: { color: 'border-green-500', label: 'Taken', text: 'text-green-800' },
                    skipped: { color: 'border-gray-400', label: 'Skipped', text: 'text-gray-800' },
                    missed: { color: 'border-red-500', label: 'Missed', text: 'text-red-800' },
                };
                const config = statusConfig[entry.status];

                return (
                    <div key={index} className={`p-3 rounded-lg bg-gray-50 border-l-4 ${config.color}`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-gray-800">{entry.med.name} <span className="font-normal text-sm text-gray-600">{entry.med.dosage}</span></p>
                                <p className="text-sm text-gray-500">{entry.date.toLocaleDateString()} at {entry.time}</p>
                            </div>
                            <span className={`font-semibold text-sm flex-shrink-0 ml-2 ${config.text}`}>{config.label}</span>
                        </div>
                         {entry.reason && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-xs text-gray-600">
                                    <span className="font-semibold">Reason:</span> {entry.reason}
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const RefillHistoryLog: React.FC<{medications: Medication[]}> = ({ medications }) => {
    const history = useMemo(() => {
      const log: {date: string; medName: string}[] = [];
      medications.forEach(med => {
        if (med.refillHistory) {
          med.refillHistory.forEach(dateStr => {
            log.push({ date: dateStr, medName: med.name });
          });
        }
      });
      return log.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [medications]);
  
    if (history.length === 0) {
      return <p className="text-center text-gray-500 py-4">No refill history recorded.</p>;
    }
  
    return (
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {history.map((entry, index) => (
          <div key={index} className="p-2 rounded-lg bg-gray-50 flex justify-between items-center">
            <p className="font-semibold text-sm">{entry.medName}</p>
            <p className="text-sm text-gray-500">{new Date(entry.date).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    );
};

const AdherenceByMedication: React.FC<{medications: Medication[]}> = ({ medications }) => {
    const adherenceData = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return medications.map(med => {
            let scheduled = 0;
            let taken = 0;
            for (let i = 0; i < 30; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];

                med.times.forEach(time => {
                    const dateTime = new Date(`${dateStr}T${time}`);
                    if (dateTime < new Date()) {
                        scheduled++;
                        if (med.doseStatus?.[`${dateStr}T${time}`] === 'taken') {
                            taken++;
                        }
                    }
                });
            }
            const percentage = scheduled > 0 ? Math.round((taken / scheduled) * 100) : 0;
            return { id: med.id, name: med.name, percentage };
        }).sort((a,b) => a.name.localeCompare(b.name));
    }, [medications]);

    if (adherenceData.length === 0) {
        return <p className="text-center text-gray-500 py-4">No data for this report.</p>;
    }

    return (
        <div className="space-y-4">
            {adherenceData.map(data => (
                <div key={data.id}>
                    <div className="flex justify-between items-center mb-1">
                        <p className="font-semibold text-sm text-gray-700">{data.name}</p>
                        <p className="font-bold text-sm text-gray-800">{data.percentage}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                            className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all duration-500" 
                            style={{ width: `${data.percentage}%` }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ReportsScreen: React.FC<ReportsScreenProps> = ({ medications }) => {

  const adherenceData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const report = {
      weekly: { taken: 0, scheduled: 0 },
      monthly: { taken: 0, scheduled: 0 },
      last7Days: [] as { day: string; adherence: number }[],
    };

    // Last 30 days for monthly
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      let dailyScheduled = 0;
      let dailyTaken = 0;

      medications.forEach(med => {
        med.times.forEach(time => {
            const dateTime = new Date(`${dateStr}T${time}`);
            if (dateTime < new Date()){
                 dailyScheduled++;
                 if (med.doseStatus?.[`${dateStr}T${time}`] === 'taken') {
                    dailyTaken++;
                 }
            }
        });
      });

      if (i < 7) {
        report.weekly.scheduled += dailyScheduled;
        report.weekly.taken += dailyTaken;
        report.last7Days.unshift({ 
            day: date.toLocaleDateString('en-US', { weekday: 'short' }), 
            adherence: dailyScheduled > 0 ? (dailyTaken / dailyScheduled) * 100 : 0
        });
      }

      report.monthly.scheduled += dailyScheduled;
      report.monthly.taken += dailyTaken;
    }

    return report;
  }, [medications]);

  const weeklyAdherence = adherenceData.weekly.scheduled > 0 
    ? Math.round((adherenceData.weekly.taken / adherenceData.weekly.scheduled) * 100) 
    : 0;
    
  const monthlyAdherence = adherenceData.monthly.scheduled > 0 
    ? Math.round((adherenceData.monthly.taken / adherenceData.monthly.scheduled) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">My Progress</h2>
      
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="bg-gradient-to-br from-indigo-500 to-blue-500 text-white p-4 rounded-xl shadow-lg">
          <p className="text-4xl font-bold">{weeklyAdherence}<span className="text-2xl opacity-80">%</span></p>
          <p className="text-sm font-semibold mt-1">Weekly Adherence</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-green-500 text-white p-4 rounded-xl shadow-lg">
          <p className="text-4xl font-bold">{monthlyAdherence}<span className="text-2xl opacity-80">%</span></p>
          <p className="text-sm font-semibold mt-1">Monthly Adherence</p>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-xl shadow-lg">
        <h3 className="font-bold text-lg text-gray-700 mb-4">Last 7 Days</h3>
        {medications.length > 0 ? (
          <div className="flex justify-around items-end h-40 space-x-2">
            {adherenceData.last7Days.map(({ day, adherence }, index) => (
              <div key={index} className="flex flex-col items-center flex-1 group">
                <div className="w-full h-full flex items-end">
                  <div 
                    className="w-full bg-gradient-to-b from-indigo-400 to-blue-500 rounded-t-md group-hover:opacity-80 transition-all"
                    style={{ height: `${adherence}%` }}
                    title={`${Math.round(adherence)}%`}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 mt-2">{day}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No medication data to generate a report.</p>
        )}
      </div>
      
      <div className="bg-white p-4 rounded-xl shadow-lg">
        <h3 className="font-bold text-lg text-gray-700 mb-4">Adherence by Medication (Last 30 Days)</h3>
        <AdherenceByMedication medications={medications} />
      </div>

       <div className="bg-white p-4 rounded-xl shadow-lg">
        <h3 className="font-bold text-lg text-gray-700 mb-4">Medication History Log</h3>
        <MedicationHistoryLog medications={medications} />
      </div>

       <div className="bg-white p-4 rounded-xl shadow-lg">
        <h3 className="font-bold text-lg text-gray-700 mb-4">Refill History</h3>
        <RefillHistoryLog medications={medications} />
      </div>

    </div>
  );
};

export default ReportsScreen;