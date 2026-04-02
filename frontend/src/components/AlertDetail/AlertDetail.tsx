import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateAlertStatus, assignAlert } from '../../store/alertsSlice';
import { type RootState, type AppDispatch } from '../../store';
import { Clock, ArrowRight, Terminal } from 'lucide-react';
import Tabs from './Tabs';
import './AlertDetail.css';

interface Props {
  alert: any;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const AlertDetail = ({ alert, onToast }: Props) => {
  const dispatch = useDispatch<AppDispatch>();
  const users = useSelector((state: RootState) => state.users.list);

  const handleUpdate = async (type: 'status' | 'assigned_to', value: any) => {
    try {
      if (type === 'status') {
        await dispatch(updateAlertStatus({ id: alert.id, status: value })).unwrap();
      } else {
        await dispatch(assignAlert({ id: alert.id, userId: parseInt(value) })).unwrap();
      }
      onToast("Update successful", 'success');
    } catch (err: any) {
      if (err.status === 403) onToast("Forbidden: Insufficient permissions", 'error');
      else onToast("Action failed", 'error');
    }
  };

  return (
    <div className="alert-detail-inner">
      <header className="detail-header-top">
        <div className="header-flex">
          <h2>{alert.alert_type}</h2>
          <div className={`dev-notify ${alert.notified_dev ? 'yes' : 'no'}`}>
            {alert.notified_dev ? "✓ Notified to Devs" : "○ Not Notified"}
          </div>
        </div>

        <div className="ip-info-bar">
          <div className="ip-block">
            <label>Source IP</label>
            <span className="mono text-red-400">{alert.source_ip}</span>
          </div>
          <span className="ip-divider"><ArrowRight size={18} /></span>
          <div className="ip-block">
            <label>Affected IP (Victim)</label>
            <span className="mono text-sky-400">{alert.victim_ip || 'N/A'}</span>
          </div>
        </div>

        <p className="detail-subtitle">
          <Clock size={12} className="inline mr-1"/> Logged: {new Date(alert.time).toLocaleString()}
        </p>
      </header>

      <div className="detail-actions">
        <div className="action-item">
          <label>Status</label>
          <select className="status-select-action" value={alert.status} onChange={(e) => handleUpdate('status', e.target.value)}>
            <option value="PENDING">Pending</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="FALSE POSITIVE">False Positive</option>
          </select>
        </div>
        <div className="action-item">
          <label>Assign To</label>
          <select className="status-select-action" value={alert.assigned_to || ""} onChange={(e) => handleUpdate('assigned_to', e.target.value)}>
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
        </div>
      </div>

      <div className="raw-details-section">
        <h3 className="section-title"><Terminal size={14}/> Raw Alert Data</h3>
        <div className="json-container">
          <pre>{JSON.stringify(alert.details || {}, null, 2)}</pre>
        </div>
      </div>

      <Tabs alert={alert} />
    </div>
  );
};

export default AlertDetail;