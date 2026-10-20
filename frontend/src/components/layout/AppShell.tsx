'use client';

import React, { useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { SolarProvider } from '@/context/SolarContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SolarProvider>
      <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col">
        {/* Sidebar */}
        <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
          <AppHeader onOpenSidebar={() => setSidebarOpen(true)} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/80 px-4 sm:px-8 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#090d16]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>SolarAI Platform v1.0 • College IoT Capstone Project</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span>Hardware: ESP32 + Multi-Sensor Bus</span>
              <span>•</span>
              <span className="text-amber-400/90 font-medium">Phase 1: Frontend Prototype</span>
            </div>
          </footer>
        </div>
      </div>
    </SolarProvider>
  );
}
