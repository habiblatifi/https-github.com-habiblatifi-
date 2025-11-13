import React, { useState, useEffect, useCallback } from 'react';
import { Medication, InteractionResult, View, DoseStatus } from './types';
import { checkInteractions } from './services/geminiService';
import Dashboard from './components/Dashboard';
import MedicationListScreen from './components/MedicationListScreen';
import AddMedicationModal from './components/AddMedicationModal';
import InteractionAlert from './components/InteractionAlert';
import { PlusIcon } from './components/icons';
import BottomNav from './components/BottomNav';
import ReportsScreen from './components/ReportsScreen';
import SettingsScreen from './components/SettingsScreen';
import ConfirmationModal from './components/ConfirmationModal';
import MissedDosesModal from './components/MissedDosesModal';

const App: React.FC = () => {
  const [medications, setMedications] = useState<Medication[]>(() => {
    try {
      const savedMeds = localStorage.getItem('medications');
      return savedMeds ? JSON.parse(savedMeds) : [];
    } catch (error) {
      console.error("Failed to parse medications from localStorage", error);
      return [];
    }
  });

  const [interactionResult, setInteractionResult] = useState<InteractionResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);
  const [isLoadingInteraction, setIsLoadingInteraction] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalProps, setConfirmModalProps] = useState<{
      title: string;
      message: string;
      onConfirm: () => void;
      confirmText?: string;
      actionStyle?: 'default' | 'danger';
  }>({
      title: '',
      message: '',
      onConfirm: () => {},
      actionStyle: 'danger',
  });
  const [missedDoses, setMissedDoses] = useState<{ med: Medication; date: string; time: string }[]>([]);
  const [isMissedDosesModalOpen, setIsMissedDosesModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('medications', JSON.stringify(medications));
    } catch (error) {
       console.error("Failed to save medications to localStorage", error);
       if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
            alert("Storage is full. Please remove some medications with large images or clear application data.");
       }
    }
  }, [medications]);
  
  // Handle Dose and Refill Notifications
  useEffect(() => {
    if ('Notification' in window && window.Notification.permission !== 'granted') {
      window.Notification.requestPermission();
    }

    const interval = setInterval(() => {
      if (window.Notification && window.Notification.permission === 'granted') {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const todayStr = now.toISOString().split('T')[0];

        medications.forEach(med => {
          // Dose reminders
          if (med.times.includes(currentTime)) {
            const dateTimeKey = `${todayStr}T${currentTime}`;
            if (!med.doseStatus?.[dateTimeKey]) {
              new window.Notification(`Time for your ${med.name}`, {
                body: `It's time to take your ${med.dosage} dose.`,
                icon: '/favicon.ico' 
              });
            }
          }

          // Refill reminders (check once daily around 9 AM)
          if (currentTime === '09:00') {
            if (
                med.quantity !== undefined &&
                med.refillThreshold !== undefined &&
                med.quantity <= med.refillThreshold &&
                !med.refillNotified
            ) {
                new window.Notification(`Refill ${med.name}`, {
                    body: `You have ${med.quantity} pills left. Time to get a refill.`,
                    icon: '/favicon.ico'
                });
                setMedications(prev => prev.map(m => m.id === med.id ? {...m, refillNotified: true} : m));
            }
            // Reset notification status if they refill
            if (
                med.quantity !== undefined &&
                med.refillThreshold !== undefined &&
                med.quantity > med.refillThreshold &&
                med.refillNotified
            ) {
                setMedications(prev => prev.map(m => m.id === med.id ? {...m, refillNotified: false} : m));
            }
          }
        });
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [medications]);

  // Check for missed doses once per session
  useEffect(() => {
    const lastCheckStr = sessionStorage.getItem('lastMissedDoseCheck');
    if (lastCheckStr) {
      return; // Already checked in this session
    }

    const checkMissedDoses = () => {
      const now = new Date();
      const foundMissedDoses: { med: Medication; date: string; time: string }[] = [];

      medications.forEach(med => {
        // Check today and yesterday
        for (let i = 0; i < 2; i++) {
          const dateToCheck = new Date();
          dateToCheck.setDate(now.getDate() - i);
          const dateStr = dateToCheck.toISOString().split('T')[0];

          med.times.forEach(time => {
            const doseDateTime = new Date(`${dateStr}T${time}`);
            // If the scheduled time is in the past
            if (doseDateTime < now) {
              const dateTimeKey = `${dateStr}T${time}`;
              const status = med.doseStatus?.[dateTimeKey];
              if (!status) { // Undefined status means neither taken nor skipped
                foundMissedDoses.push({ med, date: dateStr, time });
              }
            }
          });
        }
      });

      if (foundMissedDoses.length > 0) {
        // Sort with the most recent missed dose first
        foundMissedDoses.sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.time}`);
          const dateB = new Date(`${b.date}T${b.time}`);
          return dateB.getTime() - dateA.getTime();
        });

        setMissedDoses(foundMissedDoses);
        setIsMissedDosesModalOpen(true);
      }
      
      sessionStorage.setItem('lastMissedDoseCheck', 'true');
    };

    const timerId = setTimeout(checkMissedDoses, 2000);

    return () => clearTimeout(timerId);
  }, [medications]);


  const handleInteractionCheck = useCallback(async () => {
    if (medications.length > 1) {
      setIsLoadingInteraction(true);
      try {
        const medNames = medications.map(m => `${m.name} ${m.dosage}`);
        const result = await checkInteractions(medNames);
        setInteractionResult(result);
      } catch (error) {
        console.error("Error checking interactions:", error);
        setInteractionResult(null);
      } finally {
        setIsLoadingInteraction(false);
      }
    } else {
      setInteractionResult(null);
    }
  }, [medications]);

  useEffect(() => {
    handleInteractionCheck();
  }, [medications, handleInteractionCheck]);

  const addMedication = (med: Omit<Medication, 'id'>) => {
    const newMed: Medication = { ...med, id: Date.now().toString() };
    setMedications(prev => [...prev, newMed]);
  };
  
  const updateMedication = (updatedMed: Medication) => {
    setMedications(prev => prev.map(med => med.id === updatedMed.id ? updatedMed : med));
  };

  const deleteMedication = (id: string) => {
    setMedications(prev => prev.filter(med => med.id !== id));
  };
  
  const handleEdit = (med: Medication) => {
    setEditingMedication(med);
    setIsModalOpen(true);
  };

  const handleDeleteRequest = (med: Medication) => {
    setConfirmModalProps({
        title: 'Confirm Deletion',
        message: `Are you sure you want to delete ${med.name}? This action cannot be undone.`,
        onConfirm: () => deleteMedication(med.id),
        actionStyle: 'danger',
        confirmText: 'Delete',
    });
    setIsConfirmModalOpen(true);
  };

  const requestConfirmation = (props: Omit<typeof confirmModalProps, 'onConfirm' | 'message' | 'title'> & { onConfirm: () => void, message: string, title: string }) => {
    setConfirmModalProps({
        ...props,
        actionStyle: props.actionStyle || 'default',
    });
    setIsConfirmModalOpen(true);
  };


  const handleConfirmAction = () => {
      confirmModalProps.onConfirm();
      setIsConfirmModalOpen(false);
  };
  
  const handleCancelConfirmation = () => {
      setIsConfirmModalOpen(false);
  };
  
  const openAddModal = () => {
    setEditingMedication(null);
    setIsModalOpen(true);
  }

  const updateDoseStatus = (id: string, date: string, time: string, status: DoseStatus | null) => {
    const dateTimeKey = `${date}T${time}`;
    setMedications(prev =>
      prev.map(med => {
        if (med.id === id) {
          const oldStatus = med.doseStatus?.[dateTimeKey];
          const newDoseStatus = { ...(med.doseStatus || {}) };

          if (status === null) { // This means un-marking the dose
            delete newDoseStatus[dateTimeKey];
          } else {
            newDoseStatus[dateTimeKey] = status;
          }

          let newQuantity = med.quantity;
          if (typeof newQuantity === 'number') {
              if (status === 'taken' && oldStatus !== 'taken') {
                  newQuantity -= 1;
              } else if (oldStatus === 'taken' && status !== 'taken') {
                  newQuantity += 1;
              }
          }
          
          return { ...med, doseStatus: newDoseStatus, quantity: newQuantity };
        }
        return med;
      })
    );
  };

  const saveMissedDoseReasons = (reasonsToSave: { [medId: string]: { [dateTimeKey: string]: string } }) => {
    setMedications(prevMeds =>
        prevMeds.map(med => {
            if (reasonsToSave[med.id]) {
                const newReasons = { ...(med.missedDoseReasons || {}) };
                Object.assign(newReasons, reasonsToSave[med.id]);
                return { ...med, missedDoseReasons: newReasons };
            }
            return med;
        })
    );
  };

  const logRefill = (id: string) => {
    const medToRefill = medications.find(m => m.id === id);
    if (!medToRefill) return;

    const newQuantityStr = window.prompt(`Enter the new quantity for ${medToRefill.name}:`, medToRefill.quantity?.toString() || '30');
    if (newQuantityStr === null) return; // User cancelled

    const newQuantity = parseInt(newQuantityStr, 10);
    if (isNaN(newQuantity) || newQuantity < 0) {
        alert("Please enter a valid number.");
        return;
    }

    setMedications(prev =>
      prev.map(med => {
        if (med.id === id) {
          const newHistory = [...(med.refillHistory || []), new Date().toISOString().split('T')[0]];
          return {
            ...med,
            refillHistory: newHistory,
            quantity: newQuantity,
            refillNotified: false
          };
        }
        return med;
      })
    );
  };

  const exportData = () => {
    if (medications.length === 0) {
        alert("No data to export.");
        return;
    }

    // Helper to escape CSV fields
    const escapeCsv = (field: any) => `"${String(field ?? '').replace(/"/g, '""')}"`;

    // Export Medication List
    const medHeaders = ['Name', 'Dosage', 'Frequency', 'Food Instructions', 'Times', 'Quantity', 'Refill Threshold', 'Drug Class', 'Imprint', 'Shape', 'Color'];
    const medRows = medications.map(med => [
        escapeCsv(med.name),
        escapeCsv(med.dosage),
        escapeCsv(med.frequency),
        escapeCsv(med.food),
        escapeCsv(med.times.join(', ')),
        med.quantity ?? '',
        med.refillThreshold ?? '',
        escapeCsv(med.drugClass),
        escapeCsv(med.imprint),
        escapeCsv(med.shape),
        escapeCsv(med.color),
    ]);

    const medCsvContent = "data:text/csv;charset=utf-8," 
        + medHeaders.join(",") + "\n" 
        + medRows.map(e => e.join(",")).join("\n");

    const medEncodedUri = encodeURI(medCsvContent);
    const medLink = document.createElement("a");
    medLink.setAttribute("href", medEncodedUri);
    medLink.setAttribute("download", "pillpal_medications.csv");
    document.body.appendChild(medLink);
    medLink.click();
    document.body.removeChild(medLink);


    // Export Dose History
    const historyLog: {date: string; time: string; name: string; status: DoseStatus | 'missed'; reason?: string}[] = [];
    medications.forEach(med => {
        const allDateTimeKeys = new Set([
          ...Object.keys(med.doseStatus || {}),
          ...Object.keys(med.missedDoseReasons || {}),
        ]);

        allDateTimeKeys.forEach(dateTimeKey => {
            const [date, time] = dateTimeKey.split('T');
            const status = med.doseStatus?.[dateTimeKey];
            const reason = med.missedDoseReasons?.[dateTimeKey];
            
            historyLog.push({
                date,
                time,
                name: med.name,
                status: status || 'missed',
                reason: reason,
            });
        });
    });

    if (historyLog.length > 0) {
        const historyHeaders = ['Date', 'Time', 'Medication Name', 'Status', 'Reason'];
        const historyRows = historyLog
            .sort((a,b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime())
            .map(log => [
            log.date,
            log.time,
            escapeCsv(log.name),
            log.status,
            escapeCsv(log.reason)
        ]);
        const historyCsvContent = "data:text/csv;charset=utf-8," 
            + historyHeaders.join(",") + "\n" 
            + historyRows.map(e => e.join(",")).join("\n");
        
        const historyEncodedUri = encodeURI(historyCsvContent);
        const historyLink = document.createElement("a");
        historyLink.setAttribute("href", historyEncodedUri);
        historyLink.setAttribute("download", "pillpal_dose_history.csv");
        document.body.appendChild(historyLink);
        historyLink.click();
        document.body.removeChild(historyLink);
    }
  };


  const renderView = () => {
    switch (currentView) {
      case View.Dashboard:
        return <Dashboard medications={medications} updateDoseStatus={updateDoseStatus} logRefill={logRefill} />;
      case View.Meds:
        return <MedicationListScreen medications={medications} onEdit={handleEdit} onDeleteRequest={handleDeleteRequest} />;
      case View.Reports:
        return <ReportsScreen medications={medications} />;
      case View.Settings:
        return <SettingsScreen onExportData={exportData} />;
      default:
        return <Dashboard medications={medications} updateDoseStatus={updateDoseStatus} logRefill={logRefill}/>;
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <div className="container mx-auto max-w-lg h-screen flex flex-col shadow-2xl app-container">
        <header className="brand-gradient text-white p-4 text-center sticky top-0 z-10 shadow-lg">
          <h1 className="text-2xl font-bold tracking-wide">PillPal</h1>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
          <InteractionAlert result={interactionResult} onCheck={handleInteractionCheck} isLoading={isLoadingInteraction} />
          {renderView()}
        </main>

        {currentView !== View.Meds && (
          <div className="fixed bottom-20 right-1/2 translate-x-1/2 mb-4 z-20" style={{'left': 'calc(50% - 0px - (100vw - 32rem)/2)'}}>
             <button
              onClick={openAddModal}
              className="brand-gradient text-white rounded-full p-4 shadow-xl hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-transform hover:scale-110"
              aria-label="Add new medication"
            >
              <PlusIcon className="h-8 w-8" />
            </button>
          </div>
        )}

        <BottomNav currentView={currentView} setView={setCurrentView} />

        {isModalOpen && (
          <AddMedicationModal
            onClose={() => setIsModalOpen(false)}
            onAdd={addMedication}
            onUpdate={updateMedication}
            existingMedication={editingMedication}
            medications={medications}
            requestConfirmation={requestConfirmation}
          />
        )}

        {isConfirmModalOpen && (
          <ConfirmationModal
            isOpen={isConfirmModalOpen}
            title={confirmModalProps.title}
            message={confirmModalProps.message}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelConfirmation}
            confirmText={confirmModalProps.confirmText}
            actionStyle={confirmModalProps.actionStyle}
          />
        )}

        {isMissedDosesModalOpen && (
          <MissedDosesModal
            missedDoses={missedDoses}
            onClose={() => setIsMissedDosesModalOpen(false)}
            onSaveReasons={saveMissedDoseReasons}
          />
        )}
      </div>
    </div>
  );
};

export default App;