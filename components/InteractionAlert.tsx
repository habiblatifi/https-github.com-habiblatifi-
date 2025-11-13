import React, { useState } from 'react';
import { InteractionResult } from '../types';
import { AlertTriangleIcon, CheckCircleIcon } from './icons';

interface InteractionAlertProps {
  result: InteractionResult | null;
  onCheck: () => void;
  isLoading: boolean;
}

const InteractionAlert: React.FC<InteractionAlertProps> = ({ result, onCheck, isLoading }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!result) return null;

  const hasInteractions = result.hasInteractions;

  const severityStyles: { [key: string]: string } = {
    Severe: 'bg-red-600 text-white',
    Moderate: 'bg-orange-500 text-white',
    Mild: 'bg-yellow-400 text-gray-800',
    Unknown: 'bg-gray-400 text-white',
  };

  return (
    <div className={`p-4 rounded-xl flex items-start space-x-4 shadow-lg ${hasInteractions ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border`}>
      <div className={`flex-shrink-0 ${hasInteractions ? 'text-red-500' : 'text-green-500'}`}>
        {hasInteractions ? <AlertTriangleIcon className="h-6 w-6" /> : <CheckCircleIcon className="h-6 w-6" />}
      </div>
      <div className="flex-1">
        <h3 className={`text-lg font-semibold ${hasInteractions ? 'text-red-800' : 'text-green-800'}`}>
          {hasInteractions ? "Interaction Alert" : "No Interactions Found"}
        </h3>
        <p className={`text-sm mt-1 ${hasInteractions ? 'text-red-700' : 'text-green-700'}`}>
          {result.summary}
        </p>
        
        {isExpanded && result.details && result.details.length > 0 && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {result.details.map((detail, index) => (
              <div key={index} className="border-t border-red-200 pt-3">
                <div className="flex items-start justify-between">
                   <div>
                      <p className="font-semibold text-red-800">
                        {detail.interactingDrugs && detail.interactingDrugs.length > 0
                            ? detail.interactingDrugs.join(' + ')
                            : 'Potential Interaction'}
                      </p>
                  </div>
                  <span className={`flex-shrink-0 ml-2 px-2.5 py-0.5 text-xs font-bold rounded-full ${severityStyles[detail.severity] || severityStyles.Unknown}`}>
                    {detail.severity}
                  </span>
                </div>
                <p className="text-sm text-red-700 mt-1">{detail.description}</p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold text-red-800">Management: </span>
                  <span className="text-red-700">{detail.management}</span>
                </p>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex items-center space-x-4 mt-4">
            {hasInteractions && result.details && result.details.length > 0 && (
                 <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-sm font-semibold text-indigo-600 hover:underline"
                 >
                    {isExpanded ? 'Hide Details' : 'View Details'}
                 </button>
            )}
            <button
              onClick={onCheck}
              disabled={isLoading}
              className="text-sm font-semibold text-indigo-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Checking...' : 'Re-check Interactions'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default InteractionAlert;