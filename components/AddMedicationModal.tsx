import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Medication } from '../types';
import { identifyMedication, findPillImage, identifyMedicationByName, getTimesFromFrequency, parseMedicationInfoFromText, checkInteractions, identifyMedicationByImprint } from '../services/geminiService';
import { CameraIcon, SearchIcon, PlusIcon, TrashIcon, MicrophoneIcon, XIcon, IdentificationIcon, InformationCircleIcon, SpinnerIcon, CheckCircleIcon, AlertTriangleIcon, PencilIcon } from './icons';

interface AddMedicationModalProps {
  onClose: () => void;
  onAdd: (med: Omit<Medication, 'id'>) => void;
  onUpdate: (med: Medication) => void;
  existingMedication: Medication | null;
  medications: Medication[];
  requestConfirmation: (props: {
      title: string;
      message: string;
      onConfirm: () => void;
      confirmText?: string;
      cancelText?: string;
      actionStyle?: 'default' | 'danger';
  }) => void;
}

interface BatchResult {
  id: string;
  fileName: string;
  base64Image: string;
  resizedImage: string;
  identifiedData: Partial<Medication> | null;
  status: 'identified' | 'failed' | 'added' | 'duplicate';
  error?: string;
}

const initialMedState: Omit<Medication, 'id' | 'doseStatus'> = {
    name: '',
    dosage: '',
    frequency: '',
    food: 'No specific instructions',
    image: '',
    quantity: undefined,
    refillThreshold: undefined,
    times: ['09:00'],
    drugClass: '',
    sideEffects: '',
    imprint: '',
    shape: '',
    color: '',
    refillHistory: [],
};


const resizeImage = (base64Str: string, maxWidth = 128, maxHeight = 128): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${base64Str}`;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(`data:image/jpeg;base64,${base64Str}`); // return original if canvas fails
                return;
            }

            let { width, height } = img;
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8)); // get resized base64, with compression
        };
        img.onerror = () => {
             resolve(`data:image/jpeg;base64,${base64Str}`); // return original on error
        }
    });
};


const AddMedicationModal: React.FC<AddMedicationModalProps> = ({ onClose, onAdd, onUpdate, existingMedication, medications, requestConfirmation }) => {
  const [med, setMed] = useState<Omit<Medication, 'id' | 'doseStatus'>>(initialMedState);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingDetails, setIsSearchingDetails] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceTargetField, setVoiceTargetField] = useState<keyof Medication | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const dosageInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);
  const [isCheckingInteraction, setIsCheckingInteraction] = useState(false);
  const [imprintSearch, setImprintSearch] = useState('');
  const [isCameraAvailable, setIsCameraAvailable] = useState(false);
  
  const [modalView, setModalView] = useState<'form' | 'processing' | 'review'>('form');
  const [batchStatusText, setBatchStatusText] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [editingBatchItemId, setEditingBatchItemId] = useState<string | null>(null);


  useEffect(() => {
    setIsCameraAvailable(!!(window.aistudio && typeof window.aistudio.camera?.getPicture === 'function'));
  }, []);

  useEffect(() => {
    if (existingMedication) {
      setMed({
        name: existingMedication.name,
        dosage: existingMedication.dosage,
        frequency: existingMedication.frequency,
        food: existingMedication.food,
        image: existingMedication.image,
        quantity: existingMedication.quantity,
        refillThreshold: existingMedication.refillThreshold,
        times: existingMedication.times,
        drugClass: existingMedication.drugClass,
        sideEffects: existingMedication.sideEffects,
        imprint: existingMedication.imprint,
        shape: existingMedication.shape,
        color: existingMedication.color,
        refillHistory: existingMedication.refillHistory,
      });
    }
  }, [existingMedication]);

  // When frequency changes, automatically update reminder times
  useEffect(() => {
    if (isInitialMount.current || modalView !== 'form') {
        isInitialMount.current = false;
        return;
    }

    const fetchTimes = async () => {
        if (med.frequency) {
            setIsLoading(true);
            try {
                const newTimes = await getTimesFromFrequency(med.frequency);
                setMed(prev => ({ ...prev, times: newTimes }));
            } catch (e) {
                console.error("Failed to fetch reminder times:", e);
            } finally {
                setIsLoading(false);
            }
        } else {
            setMed(prev => ({...prev, times: [] }));
        }
    };
    
    const handler = setTimeout(() => {
        fetchTimes();
    }, 500);

    return () => {
        clearTimeout(handler);
    };
}, [med.frequency, modalView]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isNumber = type === 'number';
    setMed(prev => ({ ...prev, [name]: isNumber ? (value === '' ? undefined : Number(value)) : value }));
  };

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...med.times];
    newTimes[index] = value;
    setMed(prev => ({...prev, times: newTimes}));
  };

  const addTime = () => setMed(prev => ({...prev, times: [...prev.times, '21:00']}));
  const removeTime = (index: number) => setMed(prev => ({...prev, times: prev.times.filter((_, i) => i !== index)}));
  
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                resolve((reader.result as string).split(',')[1]);
            } else {
                reject('Failed to convert blob to base64');
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
  };
  
  const updateStateWithDetails = (details: Partial<Medication>, image?: string) => {
     setMed(prev => ({
        ...prev,
        ...details,
        image: image || details.image || prev.image,
     }));
  }

  const handleImageIdentification = async (base64Image: string) => {
    setIsLoading(true);
    setError('');
    try {
      const identifiedData = await identifyMedication(base64Image); 
      const resizedImage = await resizeImage(base64Image); 
      
      if(identifiedData.name) {
        updateStateWithDetails(identifiedData, resizedImage);
        if (!identifiedData.dosage) {
          setTimeout(() => dosageInputRef.current?.focus(), 100);
        }
      } else {
        setError("Could not identify the medication. Please enter details manually.");
        setMed(prev => ({ ...prev, image: resizedImage }));
      }
    } catch (e) {
      setError("An error occurred while identifying the medication.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!isCameraAvailable) {
        setError("Camera is not available in this environment. Try uploading an image instead.");
        return;
    }
    try {
        // Fix: Explicitly cast result to Blob to address type inference issues.
        const imageBlob = (await window.aistudio.camera.getPicture()) as Blob;
        const base64Image = await blobToBase64(imageBlob);
        await handleImageIdentification(base64Image);
    } catch (error) {
      console.error("Camera error:", error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
            setError("Camera permission denied. Please allow camera access in your browser settings.");
        } else {
            setError("Could not access the camera. It might be in use by another application.");
        }
      } else {
        setError("Could not access the camera. It might be in use by another application.");
      }
    }
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const fileInput = e.target;
    if (!files || files.length === 0) return;

    const filesToProcess = Array.from(files);
    fileInput.value = '';

    if (filesToProcess.length === 1) {
        const base64 = await blobToBase64(filesToProcess[0]);
        await handleImageIdentification(base64);
        return;
    }

    setModalView('processing');
    const results: BatchResult[] = [];
    const total = filesToProcess.length;

    for (let i = 0; i < total; i++) {
        const file = filesToProcess[i];
        setBatchStatusText(`Processing ${i + 1}/${total}: ${file.name}`);
        try {
            const base64Image = await blobToBase64(file);
            const identifiedData = await identifyMedication(base64Image);
            const resizedImage = await resizeImage(base64Image);
            const resultId = `${file.name}-${Date.now()}`;
            if (identifiedData.name && identifiedData.dosage) {
                results.push({
                    id: resultId,
                    fileName: file.name,
                    base64Image,
                    resizedImage,
                    identifiedData,
                    status: 'identified'
                });
            } else {
                results.push({ id: resultId, fileName: file.name, base64Image, resizedImage, identifiedData: null, status: 'failed' });
            }
        } catch (err) {
            console.error(`Failed to process image ${file.name}:`, err);
            const resizedImage = await resizeImage(await blobToBase64(file));
            results.push({ id: `${file.name}-${Date.now()}`, fileName: file.name, base64Image: '', resizedImage, identifiedData: null, status: 'failed' });
        }
    }
    setBatchResults(results);
    setModalView('review');
    setBatchStatusText(null);
  };
  
  const handleImprintSearch = async () => {
    if (!imprintSearch) return;
    setIsLoading(true);
    setError('');
    try {
      const identifiedData = await identifyMedicationByImprint(imprintSearch);
      if (identifiedData.name) {
        const image = await findPillImage(identifiedData.name, identifiedData.dosage || '');
        updateStateWithDetails(identifiedData, image ? `data:image/png;base64,${image}` : undefined);
      } else {
        setError("Could not identify the medication from this imprint. Please check the text and try again.");
      }
    } catch (e) {
      setError("An error occurred while identifying the medication.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePillDetailsSearch = useCallback(async (nameParam?: string, dosageParam?: string) => {
    const name = nameParam ?? med.name;
    const dosage = dosageParam ?? med.dosage;

    if (!name) return;
    setIsSearchingDetails(true);
    setError('');

    try {
        const [details, image] = await Promise.all([
            identifyMedicationByName(name, dosage),
            findPillImage(name, dosage)
        ]);
        updateStateWithDetails(details, image ? `data:image/png;base64,${image}`: undefined)
        if (!med.dosage && !details.dosage){
             setTimeout(() => dosageInputRef.current?.focus(), 100);
        }
    } catch (e) {
      setError("An error occurred while fetching pill details.");
      console.error(e);
    } finally {
      setIsSearchingDetails(false);
    }
  }, [med.name, med.dosage]);

  const handleDosageBlur = () => {
    if (med.name && med.dosage) {
        handlePillDetailsSearch();
    }
  };

  const handleVoiceInput = useCallback((field: keyof Medication) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice recognition is not supported in your browser.");
      return;
    }
  
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
  
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    setVoiceTargetField(field);
    setError('');
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
  
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
        setIsListening(false);
        setVoiceTargetField(null);
        recognitionRef.current = null;
    };
    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        let errorMessage = `Voice recognition error: ${event.error}`;
        if (event.error === 'no-speech') errorMessage = "No speech was detected. Please try again.";
        if (event.error === 'audio-capture') errorMessage = "Could not capture audio. Please ensure your microphone is working.";
        if (event.error === 'not-allowed') errorMessage = "Microphone access denied. Please allow microphone access.";
        setError(errorMessage);
      }
    };
    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.replace(/\.$/, '');
        (async () => {
          if (field === 'frequency') {
            setIsLoading(true);
            setError('');
            try {
              const parsedInfo = await parseMedicationInfoFromText(transcript);
              const newName = parsedInfo.name || med.name;
              const newDosage = parsedInfo.dosage || med.dosage;
              const newFood = (parsedInfo as any).food || med.food;

              setMed(prev => ({ ...prev, name: newName, dosage: newDosage, frequency: parsedInfo.frequency || transcript, food: newFood, }));
              if (newName && newDosage) await handlePillDetailsSearch(newName, newDosage);
            } catch (e) {
              setError("Could not parse medication from voice.");
            } finally {
              setIsLoading(false);
            }
          } else {
            setMed(prev => ({ ...prev, [field]: transcript }));
            const currentName = field === 'name' ? transcript : med.name;
            const currentDosage = field === 'dosage' ? transcript : med.dosage;
            if (currentName && currentDosage && field === 'dosage') handlePillDetailsSearch(currentName, currentDosage);
          }
        })();
      };
    recognition.start();
  }, [isListening, med.name, med.dosage, handlePillDetailsSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!med.name || !med.dosage) {
        setError('Medication name and dosage are required.');
        return;
    }

    const finalMedData = { ...med };

    // When editing a med from the main list, not the batch review
    if (existingMedication && !editingBatchItemId) {
      onUpdate({ ...existingMedication, ...finalMedData });
      onClose();
      return;
    }
    
    // Check for duplicates, ignoring the one being edited (if any)
    const isDuplicate = medications.some(
        existing => existing.id !== existingMedication?.id &&
                    existing.name.trim().toLowerCase() === finalMedData.name.trim().toLowerCase() &&
                    existing.dosage.trim().toLowerCase() === finalMedData.dosage.trim().toLowerCase()
    );

    if (isDuplicate) {
        setError('This medication with the same dosage already exists in your list.');
        return;
    }

    setIsCheckingInteraction(true);
    setError('');

    const addAction = () => {
        onAdd(finalMedData);
        if (editingBatchItemId) {
            setBatchResults(prev => prev.map(r => r.id === editingBatchItemId ? { ...r, status: 'added' } : r));
            setEditingBatchItemId(null);
            setMed(initialMedState);
            setModalView('review');
        } else {
            onClose();
        }
    };
    
    try {
        const medNames = [...medications.map(m => `${m.name} ${m.dosage}`), `${finalMedData.name} ${finalMedData.dosage}`];
        if (medNames.length > 1) {
            const interactionResult = await checkInteractions(medNames);
            if (interactionResult.hasInteractions) {
                setIsCheckingInteraction(false);
                requestConfirmation({
                    title: 'Interaction Warning',
                    message: `${interactionResult.summary}\n\nThis medication may interact with your existing prescriptions. Please consult your doctor.`,
                    confirmText: 'Add Anyway',
                    actionStyle: 'danger',
                    onConfirm: addAction
                });
                return; 
            }
        }
        addAction();
    } catch (error) {
        console.error("Interaction check failed during add:", error);
        setError("Could not check for interactions. Adding medication without checking.");
        addAction(); // Add anyway if check fails
    } finally {
        setIsCheckingInteraction(false);
    }
  };
  
  const handleAddAutomatically = async (resultId: string) => {
      setError('');
      const result = batchResults.find(r => r.id === resultId);
      if (!result || !result.identifiedData) return;
      
      const { identifiedData, resizedImage } = result;

      const isDuplicate = medications.some(
          existing => existing.name.trim().toLowerCase() === identifiedData.name?.trim().toLowerCase() &&
                      existing.dosage.trim().toLowerCase() === identifiedData.dosage?.trim().toLowerCase()
      );
  
      if (isDuplicate) {
          setBatchResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'duplicate', error: 'Already in your list.' } : r));
          return;
      }

      const times = await getTimesFromFrequency(identifiedData.frequency || '');
      const newMed: Omit<Medication, 'id'> = {
        name: identifiedData.name!,
        dosage: identifiedData.dosage!,
        frequency: identifiedData.frequency || '',
        food: identifiedData.food || 'No specific instructions',
        times: times.length > 0 ? times : [],
        ...identifiedData,
        image: resizedImage,
      };
      onAdd(newMed);
      setBatchResults(prev => prev.map(r => r.id === resultId ? { ...r, status: 'added' } : r));
  };
  
  const handleEditAndAdd = (resultId: string) => {
    const result = batchResults.find(r => r.id === resultId);
    if (!result) return;

    if (!result.identifiedData) { // Case for failed identification
      setMed({
        ...initialMedState,
        image: result.resizedImage,
      });
    } else {
      updateStateWithDetails(result.identifiedData, result.resizedImage);
    }

    setEditingBatchItemId(resultId);
    setError('');
    setModalView('form');
  };

  const handleRemoveBatchItem = (resultId: string) => {
    setBatchResults(prev => prev.filter(r => r.id !== resultId));
  };
  
  const handleReturnToReview = () => {
    setModalView('review');
    setEditingBatchItemId(null);
    setMed(initialMedState);
    setError('');
  };


  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && modalView !== 'processing') {
        onClose();
    }
  };

  const renderHeader = () => {
    let title = existingMedication ? 'Edit Medication' : 'Add New Medication';
    if (modalView === 'review') title = `Review ${batchResults.filter(r => r.status !== 'added').length} Images`;
    if (modalView === 'processing') title = 'Processing Images';
    if (modalView === 'form' && editingBatchItemId) title = 'Review & Add Medication';


    return (
        <header className="p-5 border-b shrink-0 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            </div>
            <button type="button" onClick={onClose} disabled={modalView === 'processing'} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50" aria-label="Close modal">
                <XIcon className="h-6 w-6" />
            </button>
        </header>
    );
  };

  const renderForm = () => (
    <>
      {editingBatchItemId && (
         <div className="bg-indigo-50 p-3 rounded-lg -mt-1 mb-4 text-center">
            <button 
                type="button" 
                onClick={handleReturnToReview}
                className="text-sm text-indigo-700 font-semibold hover:underline"
            >
                &larr; Back to Review List
            </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
          <button 
              type="button" 
              onClick={handleTakePhoto} 
              disabled={isLoading || !isCameraAvailable} 
              className="flex items-center justify-center gap-2 w-full brand-gradient text-white font-semibold py-2.5 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all shadow-md"
              title={!isCameraAvailable ? "Camera is not available in this environment" : "Take photo"}
          >
              <CameraIcon className="w-5 h-5"/>
              Take Photo
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="flex items-center justify-center gap-2 w-full bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors">
            <SearchIcon className="w-5 h-5"/>
            Upload Image
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" multiple />
      </div>

       <div className="bg-gray-50 p-4 rounded-lg my-4">
          <label htmlFor="imprint-search" className="block text-sm font-medium text-gray-700 text-center">Or identify by pill imprint</label>
          <div className="mt-2 flex rounded-md shadow-sm">
              <input type="text" name="imprint-search" id="imprint-search" value={imprintSearch} onChange={(e) => setImprintSearch(e.target.value)} placeholder="e.g., LUPIN 10" className="flex-1 block w-full border-gray-300 rounded-none rounded-l-md focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2"/>
              <button type="button" onClick={handleImprintSearch} disabled={!imprintSearch || isLoading} className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors">
                  <IdentificationIcon className="h-5 w-5" />
              </button>
          </div>
      </div>
      
      {isLoading && <div className="flex justify-center items-center gap-2 text-indigo-600"><SpinnerIcon className="w-5 h-5" /> Identifying medication...</div>}
      
      {med.image && (
          <div className="flex justify-center">
            <img src={med.image} alt="Medication" className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 p-1" />
          </div>
      )}
      {/* ... The rest of the form fields ... */}
        {med.imprint && (
          <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-100 p-2 rounded-lg"><p className="text-xs font-medium text-gray-500">Imprint</p><p className="text-sm font-semibold text-gray-800 truncate">{med.imprint}</p></div>
              <div className="bg-gray-100 p-2 rounded-lg"><p className="text-xs font-medium text-gray-500">Shape</p><p className="text-sm font-semibold text-gray-800">{med.shape}</p></div>
              <div className="bg-gray-100 p-2 rounded-lg"><p className="text-xs font-medium text-gray-500">Color</p><p className="text-sm font-semibold text-gray-800">{med.color}</p></div>
          </div>
        )}
        {med.drugClass && <div className="bg-indigo-50 p-3 rounded-lg"><div className="flex items-center gap-2"><p className="text-sm font-medium text-indigo-800">Drug Class</p><div className="group relative"><InformationCircleIcon className="h-5 w-5 text-indigo-500 cursor-help" /><span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">Auto-filled by AI</span></div></div><p className="text-sm text-indigo-700 mt-1">{med.drugClass}</p></div>}
        {med.sideEffects && <div className="bg-yellow-50 p-3 rounded-lg"><div className="flex items-center gap-2"><p className="text-sm font-medium text-yellow-800">Common Side Effects</p><div className="group relative"><InformationCircleIcon className="h-5 w-5 text-yellow-500 cursor-help" /><span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">Auto-filled by AI</span></div></div><p className="text-sm text-yellow-700 mt-1">{med.sideEffects}</p></div>}

        <div className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                <div className="mt-1 flex rounded-md shadow-sm"><input type="text" name="name" id="name" value={med.name} onChange={handleChange} required className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 px-3 py-2 bg-white"/><button type="button" onClick={() => handleVoiceInput('name')} className={`relative inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${isListening && voiceTargetField === 'name' ? 'bg-red-100 hover:bg-red-200' : ''}`} aria-label={`Use voice input for Name`}><MicrophoneIcon className={`h-5 w-5 ${isListening && voiceTargetField === 'name' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} /></button></div>
                {isListening && voiceTargetField === 'name' && <p className="text-sm text-indigo-500 mt-1 animate-pulse">Listening...</p>}
            </div>
            <div>
                <label htmlFor="dosage" className="block text-sm font-medium text-gray-700">Dosage</label>
                <div className="mt-1 flex rounded-md shadow-sm"><input ref={dosageInputRef} type="text" name="dosage" id="dosage" value={med.dosage} onChange={handleChange} onBlur={handleDosageBlur} placeholder="e.g., 500mg" required className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 px-3 py-2 bg-white"/><button type="button" onClick={() => handleVoiceInput('dosage')} className={`relative inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${isListening && voiceTargetField === 'dosage' ? 'bg-red-100 hover:bg-red-200' : ''}`} aria-label={`Use voice input for Dosage`}><MicrophoneIcon className={`h-5 w-5 ${isListening && voiceTargetField === 'dosage' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} /></button></div>
                {isListening && voiceTargetField === 'dosage' && <p className="text-sm text-indigo-500 mt-1 animate-pulse">Listening...</p>}
            </div>
            <button type="button" onClick={() => handlePillDetailsSearch()} disabled={!med.name || isSearchingDetails} className="flex items-center justify-center gap-2 w-full bg-gray-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors shadow-md">{isSearchingDetails ? <SpinnerIcon className="w-5 h-5"/> : <SearchIcon className="w-5 h-5"/>}{isSearchingDetails ? 'Auto-filling...' : 'Auto-fill by Name'}</button>
        </div>
        <div>
            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700">Description / Frequency</label>
            <div className="mt-1 flex rounded-md shadow-sm"><input type="text" name="frequency" id="frequency" value={med.frequency} onChange={handleChange} placeholder="e.g., Twice a day for pain" className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 px-3 py-2 bg-white"/><button type="button" onClick={() => handleVoiceInput('frequency')} className={`relative inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${isListening && voiceTargetField === 'frequency' ? 'bg-red-100 hover:bg-red-200' : ''}`} aria-label={`Use voice input for Frequency`}><MicrophoneIcon className={`h-5 w-5 ${isListening && voiceTargetField === 'frequency' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} /></button></div>
            <p className="text-xs text-gray-500 mt-1">Tip: Use the mic to say everything at once, like "Lisinopril 10mg once daily".</p>
            {isListening && voiceTargetField === 'frequency' && <p className="text-sm text-indigo-500 mt-1 animate-pulse">Listening...</p>}
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700">Reminder Times</label>
            {med.times.length > 0 ? med.times.map((time, index) => (
                <div key={index} className="flex items-center gap-2 mt-1"><input type="time" value={time} onChange={(e) => handleTimeChange(index, e.target.value)} className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/><button type="button" onClick={() => removeTime(index)} className="p-2 text-gray-500 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors" aria-label="Remove time"><TrashIcon className="h-5 w-5"/></button></div>
            )) : <p className="text-sm text-gray-500 mt-2 p-3 bg-gray-50 rounded-md italic">No specific times needed based on frequency.</p>}
            {med.times.length < 8 && <button type="button" onClick={addTime} className="mt-2 flex items-center gap-1 text-sm text-indigo-600 font-semibold hover:underline"><PlusIcon className="w-4 h-4" /> Add Time</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Pills in Bottle (Optional)</label><input type="number" name="quantity" id="quantity" value={med.quantity ?? ''} onChange={handleChange} placeholder="e.g., 30" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/></div>
            <div><label htmlFor="refillThreshold" className="block text-sm font-medium text-gray-700">Refill Reminder (Pills)</label><input type="number" name="refillThreshold" id="refillThreshold" value={med.refillThreshold ?? ''} onChange={handleChange} placeholder="e.g., 5" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/></div>
        </div>
        <div>
            <label htmlFor="food" className="block text-sm font-medium text-gray-700">Food Instructions</label>
            <select name="food" id="food" value={med.food} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"><option>With food</option><option>Without food</option><option>No specific instructions</option></select>
        </div>
    </>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center h-full text-center">
        <SpinnerIcon className="w-8 h-8 text-indigo-600" />
        <p className="text-lg font-semibold text-gray-700 mt-4 break-all">{batchStatusText}</p>
        <p className="text-sm text-gray-500 mt-1">Please keep this window open.</p>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-3">
        {batchResults.length === 0 && <p className="text-center text-gray-500 py-8">All images have been processed.</p>}
        {batchResults.map((result) => {
            const statusStyles = {
                added: 'border-green-500',
                duplicate: 'border-yellow-500',
                failed: 'border-red-500',
                identified: 'border-gray-200',
            };
            return (
                <div key={result.id} className={`bg-white p-3 rounded-lg border-2 ${statusStyles[result.status]}`}>
                    <div className="flex items-start gap-4">
                        <img src={result.resizedImage} alt={result.fileName} className="w-16 h-16 rounded-md object-cover bg-gray-100" />
                        <div className="flex-1 min-w-0">
                            {result.status === 'failed' ? (
                                <>
                                <p className="font-semibold text-red-700">Identification Failed</p>
                                <p className="text-xs text-gray-500 truncate">{result.fileName}</p>
                                </>
                            ) : result.status === 'added' ? (
                                 <>
                                <p className="font-semibold text-green-700 flex items-center gap-2"><CheckCircleIcon className="w-5 h-5"/> Added</p>
                                <p className="text-sm text-gray-800 font-medium">{result.identifiedData?.name}</p>
                                <p className="text-xs text-gray-500 truncate">{result.fileName}</p>
                                </>
                            ) : result.status === 'duplicate' ? (
                                <>
                                <p className="font-semibold text-yellow-700 flex items-center gap-2"><AlertTriangleIcon className="w-5 h-5"/> Duplicate</p>
                                <p className="text-sm text-gray-800 font-medium">{result.identifiedData?.name}</p>
                                <p className="text-xs text-red-600">{result.error}</p>
                                </>
                            ) : (
                                <>
                                <p className="font-semibold text-gray-800">{result.identifiedData?.name}</p>
                                <p className="text-sm text-gray-600">{result.identifiedData?.dosage}</p>
                                <p className="text-xs text-gray-400 truncate">{result.fileName}</p>
                                </>
                            )}
                        </div>
                    </div>
                     <div className="mt-3 flex justify-end gap-2">
                        {result.status === 'identified' && (
                            <>
                            <button type="button" onClick={() => handleEditAndAdd(result.id)} className="px-3 py-1.5 text-sm font-semibold bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">Edit & Add</button>
                            <button type="button" onClick={() => handleAddAutomatically(result.id)} className="px-3 py-1.5 text-sm font-semibold brand-gradient text-white rounded-md hover:opacity-90 transition-opacity">Add Automatically</button>
                            </>
                        )}
                        {(result.status === 'failed' || result.status === 'duplicate') && (
                           <>
                             {result.status === 'failed' && <button type="button" onClick={() => handleEditAndAdd(result.id)} className="px-3 py-1.5 text-sm font-semibold bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"><PencilIcon className="w-4 h-4"/> Add Manually</button>}
                             <button type="button" onClick={() => handleRemoveBatchItem(result.id)} className="px-3 py-1.5 text-sm font-semibold text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors">Remove</button>
                           </>
                        )}
                    </div>
                </div>
            )
        })}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in" aria-modal="true" role="dialog" onClick={handleBackdropClick}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {renderHeader()}
            <main className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50">
              {modalView === 'processing' && renderProcessing()}
              {modalView === 'review' && renderReview()}
              {modalView === 'form' && renderForm()}
              {modalView === 'form' && error && <p className="text-center text-red-600 text-sm mt-2">{error}</p>}
            </main>
            {modalView !== 'processing' && (
                <footer className="p-4 bg-gray-100 border-t flex justify-end space-x-3 shrink-0">
                    {modalView === 'review' ? (
                       <button type="button" onClick={onClose} className="px-5 py-2.5 brand-gradient text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md">Done</button>
                    ) : (
                      <>
                        <button type="button" onClick={editingBatchItemId ? handleReturnToReview : onClose} className="px-5 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors">
                            {editingBatchItemId ? 'Back to Review' : 'Cancel'}
                        </button>
                        <button type="submit" disabled={isCheckingInteraction || isLoading} className="px-5 py-2.5 brand-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-semibold transition-opacity shadow-md flex items-center justify-center gap-2">
                            {isCheckingInteraction && <SpinnerIcon className="w-5 h-5"/>}
                            {isCheckingInteraction ? 'Checking...' : (existingMedication || editingBatchItemId ? 'Save Changes' : 'Add Medication')}
                        </button>
                      </>
                    )}
                </footer>
            )}
        </form>
      </div>
    </div>
  );
};
export default AddMedicationModal;