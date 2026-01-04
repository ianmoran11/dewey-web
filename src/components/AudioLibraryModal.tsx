import { useEffect, useMemo, useState } from 'react';
import { X, Trash2, ExternalLink, Headphones, Search, Edit2, Save, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AudioEpisode } from '../types';
import { deleteAudioEpisode, getAudioEpisodeAudio, getAudioEpisodes, updateAudioEpisodeTitle } from '../db/queries';
import { useStore } from '../lib/store';
import { exportAudioLibraryToZip, ExportProgress, ExportFormat } from '../utils/zip';

const formatDate = (ts: number) => {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
};

export const AudioLibraryModal = ({ onClose }: { onClose: () => void }) => {
  const selectTopic = useStore(s => s.selectTopic);
  const topics = useStore(s => s.topics);

  const [episodes, setEpisodes] = useState<AudioEpisode[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'topic' | 'block'>('all');

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('wav'); // Default to WAV for reliability

  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await getAudioEpisodes();
      setEpisodes(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    return () => {
      if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return episodes.filter(e => {
      if (filter !== 'all' && e.scope !== filter) return false;
      if (!q) return true;
      return (
        (e.title || '').toLowerCase().includes(q) ||
        (e.topic_title || '').toLowerCase().includes(q) ||
        (e.topic_code || '').toLowerCase().includes(q) ||
        (e.block_label || '').toLowerCase().includes(q)
      );
    });
  }, [episodes, search, filter]);

  const playEpisode = async (id: string) => {
    try {
      const blob = await getAudioEpisodeAudio(id);
      if (!blob) return toast.error('Audio not found');

      if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
      const url = URL.createObjectURL(blob);
      setActiveAudioUrl(url);
      setActiveEpisodeId(id);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load audio');
    }
  };

  const startEdit = (e: AudioEpisode) => {
    setEditingId(e.id);
    setDraftTitle(e.title);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const title = draftTitle.trim();
    if (!title) return toast.error('Title cannot be empty');

    try {
      await updateAudioEpisodeTitle(editingId, title);
      setEpisodes(prev => prev.map(e => (e.id === editingId ? { ...e, title } : e)));
      setEditingId(null);
      toast.success('Title updated');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update title');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this audio episode?')) return;
    try {
      await deleteAudioEpisode(id);
      setEpisodes(prev => prev.filter(e => e.id !== id));
      if (activeEpisodeId === id && activeAudioUrl) {
        URL.revokeObjectURL(activeAudioUrl);
        setActiveAudioUrl(null);
        setActiveEpisodeId(null);
      }
      toast.success('Deleted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete');
    }
  };

  const goTo = async (e: AudioEpisode) => {
    await selectTopic(e.topic_id);
    onClose();
    // Highlighting block is a follow-up improvement; for now the topic will load.
  };

  const handleExportZip = async () => {
    if (episodes.length === 0) return toast.error('No episodes to export');
    
    setIsExporting(true);
    setExportProgress({ current: 0, total: episodes.length, status: 'Preparing...' });

    try {
      const blob = await exportAudioLibraryToZip(episodes, topics, (p) => {
        setExportProgress(p);
      }, exportFormat);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dewey-audiobook-player-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Audio library exported successfully');
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Export failed: ${errorMessage}`, { duration: 6000 });
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Headphones size={18} className="text-purple-600" />
            <h2 className="text-xl font-bold text-gray-800">Audio Library</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search title / topic / section…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="topic">Topics</option>
            <option value="block">Sections</option>
          </select>
          <button
            onClick={refresh}
            className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Refresh
          </button>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value as ExportFormat)}
            disabled={isExporting}
            title="WAV is larger but more reliable. MP3 is smaller but may fail on some devices."
          >
            <option value="wav">WAV (Reliable)</option>
            <option value="mp3">MP3 (Smaller)</option>
          </select>
          <button
            onClick={handleExportZip}
            disabled={isExporting || episodes.length === 0}
            className="px-3 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isExporting ? 'Exporting...' : 'Export ZIP'}
          </button>
        </div>

        {/* Export Progress Overlay */}
        {isExporting && exportProgress && (
          <div className="px-6 py-2 bg-purple-50 border-b border-purple-100 flex items-center justify-between text-xs text-purple-700 animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <span className="font-bold">{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
              <span>{exportProgress.status}</span>
            </div>
            <div className="font-mono">{exportProgress.current} / {exportProgress.total}</div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-500">No audio episodes found.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map(e => (
                <div key={e.id} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm">
                  <div className="flex gap-3 items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${e.scope === 'topic' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {e.scope === 'topic' ? 'Topic' : 'Section'}
                        </span>
                        <span className="text-[11px] text-gray-400">{formatDate(e.created_at)}</span>
                      </div>

                      <div className="mt-2">
                        {editingId === e.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                              value={draftTitle}
                              onChange={ev => setDraftTitle(ev.target.value)}
                            />
                            <button
                              onClick={saveEdit}
                              className="p-2 bg-green-50 border border-green-200 rounded-lg text-green-700 hover:bg-green-100"
                              title="Save"
                            >
                              <Save size={16} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-gray-900 truncate">{e.title}</div>
                            <button
                              onClick={() => startEdit(e)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded"
                              title="Rename"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-1 text-sm text-gray-600 truncate">
                        <span className="font-medium">{e.topic_code ? `${e.topic_code} ` : ''}{e.topic_title}</span>
                        {e.block_label ? <span className="text-gray-400"> — {e.block_label}</span> : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => playEpisode(e.id)}
                          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                          Play
                        </button>
                        <button
                          onClick={() => goTo(e)}
                          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                          title="Go to topic"
                        >
                          <ExternalLink size={14} /> Go to
                        </button>
                        <button
                          onClick={() => remove(e.id)}
                          className="px-3 py-1.5 text-sm bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1"
                          title="Delete"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>

                      {activeEpisodeId === e.id && activeAudioUrl && (
                        <div className="mt-3">
                          <audio controls src={activeAudioUrl} className="w-full h-8" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
