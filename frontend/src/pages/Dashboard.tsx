import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAlerts } from '../store/alertsSlice'; 
import { type RootState, type AppDispatch } from '../store';
import { fetchAllUsers } from '../store/usersSlice';
import { 
  Activity, ShieldAlert, AlertTriangle, ShieldCheck, 
  Zap, Search, Calendar, Loader2, FilterX, UserCheck, 
  Unlock, Users, Clock, ShieldX, ArrowRight
} from 'lucide-react';
import AlertDetail from '../components/AlertDetail/AlertDetail';
import './Dashboard.css';

const Dashboard = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, stats } = useSelector((state: RootState) => state.alerts);
  const { list: users } = useSelector((state: RootState) => state.users);

  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const [filters, setFilters] = useState({
    severity: null as string | null,
    start_time: "",
    end_time: "",
    search_query: "",
    status: "",
    assigned_to: "" as string,
    mine_only: false,
  });

  const triggerSearch = useCallback((newFilters: typeof filters) => {
    dispatch(fetchAlerts({ page: 1, size: 50, ...newFilters }));
    dispatch(fetchAllUsers());
  }, [dispatch]);

  useEffect(() => {
    if (items.length === 0) triggerSearch(filters);
  }, [triggerSearch]);

  const updateFilter = (updates: Partial<typeof filters>) => {
    const nextFilters = { ...filters, ...updates };
    setFilters(nextFilters);
    triggerSearch(nextFilters);
  };

  const handleAssignmentToggle = (type: 'mine' | 'unassigned') => {
    const next = { ...filters };
    if (type === 'mine') {
      next.mine_only = !filters.mine_only;
      if (next.mine_only) next.assigned_to = ""; 
    } else {
      next.assigned_to = filters.assigned_to === "0" ? "" : "0";
      if (next.assigned_to === "0") next.mine_only = false;
    }
    updateFilter(next);
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="filter-glass-panel">
        <div className="search-row">
          <div className="cyber-search-container">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              placeholder="Query IP, Type, or Analysis..." 
              value={filters.search_query}
              onChange={(e) => updateFilter({ search_query: e.target.value })}
            />
          </div>
          <div className="assignment-pills">
            <button className={`pill ${filters.mine_only ? 'active' : ''}`} onClick={() => handleAssignmentToggle('mine')}>
              <UserCheck size={14} /> Assigned to Me
            </button>
            <button className={`pill ${filters.assigned_to === "0" ? 'active' : ''}`} onClick={() => handleAssignmentToggle('unassigned')}>
              <Unlock size={14} /> Unassigned
            </button>
            <button onClick={() => updateFilter({ severity: null, start_time: "", end_time: "", search_query: "", status: "", assigned_to: "", mine_only: false })} className="reset-btn">
              <FilterX size={16}/>
            </button>
          </div>
        </div>
        <div className="filter-row-bottom">
          <div className="time-range-group">
            <div className="time-input"><Calendar size={12} /><input type="datetime-local" value={filters.start_time} onChange={(e) => updateFilter({ start_time: e.target.value })} /></div>
            <span className="time-arrow">➔</span>
            <div className="time-input"><Calendar size={12} /><input type="datetime-local" value={filters.end_time} onChange={(e) => updateFilter({ end_time: e.target.value })} /></div>
          </div>
          <div className="dropdown-group">
            <select className="cyber-select" value={filters.assigned_to} onChange={(e) => updateFilter({ assigned_to: e.target.value, mine_only: false })}>
              <option value="">Specific User...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <select className="cyber-select" value={filters.status} onChange={(e) => updateFilter({ status: e.target.value })}>
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="FALSE POSITIVE">False Positive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {['TOTAL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
          <div key={sev} className={`stat-card ${sev === 'CRITICAL' ? 'crit' : ''} ${filters.severity === (sev === 'TOTAL' ? null : sev) ? 'active' : ''}`} onClick={() => updateFilter({ severity: sev === 'TOTAL' ? null : sev })}>
            <div className="stat-info"><p>{sev}</p><h3>{stats[sev] || 0}</h3></div>
            {sev === 'TOTAL' ? <Activity className="text-sky-400" /> : sev === 'CRITICAL' ? <ShieldAlert className="text-red-500" /> : sev === 'HIGH' ? <AlertTriangle className="text-orange-500" /> : sev === 'MEDIUM' ? <Zap className="text-yellow-500" /> : <ShieldCheck className="text-blue-500" />}
          </div>
        ))}
      </div>

      <div className="main-split-view">
<aside className="alerts-list-column">
  {items.map((alert) => (
    <div 
      key={alert.id} 
      className={`alert-job-card ${selectedAlert?.id === alert.id ? 'active' : ''} severity-${alert.severity.toLowerCase()}`} 
      onClick={() => setSelectedAlert(alert)}
    >
      <div className="card-header">
        <span className={`badge badge-${alert.severity.toLowerCase()}`}>{alert.severity}</span>
        <span className="card-time"><Clock size={10} /> {new Date(alert.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
      
      <h4 className="card-title">{alert.alert_type}</h4>
      
      <div className="card-meta">
        <div className="mini-ip-pathway">
          <span className="mono src text-slate-200">{alert.source_ip}</span>
          <ArrowRight size={10} className="path-arrow text-slate-700" />
          <span className="mono dst text-slate-500">{alert.victim_ip || 'Internal'}</span>
        </div>
        
        <div className="user-tag-mini">
          <Users size={10}/> {users.find(u => u.id === alert.assigned_to)?.username || "Unassigned"}
        </div>
      </div>
      
      <div className={`status-pill ${alert.status}`}>
        <span className={`status-dot ${alert.status}`}></span> {alert.status}
      </div>
    </div>
  ))}
  {loading && <div className="p-10 text-center"><Loader2 className="animate-spin text-sky-500 mx-auto" /></div>}
</aside>

        <main className="alert-detail-pane">
          {selectedAlert ? (
            <AlertDetail alert={selectedAlert} onToast={showToast} />
          ) : (
            <div className="empty-detail">
              <ShieldAlert size={64} className="opacity-10 mb-4" />
              <p>Select an alert to begin investigation</p>
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className={`toast-box ${toast.type}`}>
          {toast.type === 'error' ? <ShieldX size={18}/> : <ShieldCheck size={18}/>}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;