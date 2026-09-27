import { createRoot } from 'react-dom/client';
import './staff.css';
import App from './App.jsx';
import { supabase } from './supabase.js';

// Installable app + offline shell; push is switched on separately (usePush).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/staff/sw.js', { scope: '/staff/' }).catch(() => {});

const root = createRoot(document.getElementById('root'));
root.render(supabase ? <App /> : <div className="login"><div className="card"><h1>Belum disambung</h1><p className="muted">Tetapkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.</p></div></div>);
