import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { MainArea } from './components/MainArea'
import { SettingsModal } from './components/SettingsModal'
import { useStore } from './lib/store'
import { Toaster } from 'react-hot-toast'

function App() {
  const { init, isInitializing } = useStore();
  const [showSettings, setShowSettings] = useState(false);

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
    <div className="h-screen flex overflow-hidden">
      <Sidebar onOpenSettings={() => setShowSettings(true)} />
      <MainArea />
      
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <Toaster position="bottom-right" />
    </div>
  )
}

export default App
