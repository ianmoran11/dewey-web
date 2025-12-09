import { useEffect, useState, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { MainArea } from './components/MainArea'
import { SettingsModal } from './components/SettingsModal'
import { useStore } from './lib/store'
import { Toaster } from 'react-hot-toast'
import { Menu } from 'lucide-react'

function App() {
  const { init, isInitializing } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth > 200 && newWidth < 800) {
          setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    init();
  }, []);

  if (isInitializing) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
             <div className="w-8 h-8 rounded-lg bg-blue-600 animate-pulse"></div>
             <p className="text-gray-500 font-medium">Initializing Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
      <Sidebar 
        onOpenSettings={() => setShowSettings(true)} 
        width={sidebarWidth}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onResizeStart={startResizing}
      />

      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-6 left-6 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-md text-gray-600 hover:text-blue-600 hover:bg-gray-50 transition-all"
          title="Open Sidebar"
        >
          <Menu size={20} />
        </button>
      )}
      
      <MainArea />
      
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <Toaster position="bottom-right" />
    </div>
  )
}

export default App
