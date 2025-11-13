import React from 'react';
import { View } from '../types';
import { HomeIcon, PillIcon, ChartBarIcon, CogIcon } from './icons';

interface BottomNavProps {
  currentView: View;
  setView: (view: View) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView }) => {
  const navItems = [
    { view: View.Dashboard, label: 'Dashboard', icon: HomeIcon },
    { view: View.Meds, label: 'My Meds', icon: PillIcon },
    { view: View.Reports, label: 'Reports', icon: ChartBarIcon },
    { view: View.Settings, label: 'Settings', icon: CogIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white/70 backdrop-blur-sm border-t border-gray-200 shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.1)] z-10">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
              currentView === view ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-500'
            }`}
          >
            <Icon className="h-6 w-6 mb-1" />
            <span className={`text-xs font-semibold ${currentView === view ? 'font-bold' : 'font-medium'}`}>{label}</span>
             {currentView === view && (
                <div className="absolute bottom-1 w-8 h-1 bg-indigo-600 rounded-full"></div>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;