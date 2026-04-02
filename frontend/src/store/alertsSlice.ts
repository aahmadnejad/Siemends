import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axiosConfig';

export interface Alert {
  id: number;
  alert_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  source_ip: string;
  victim_ip?: string;
  time: string; 
  status: string;
  assigned_to: string | number | null;
  notified_dev?: boolean;
  details?: any;
  ai_analysis?: any;
}

interface AlertsState {
  items: Alert[];
  stats: Record<string, number>; 
  loading: boolean;
  error: string | null;
  page: number;
  hasMore: boolean;
  totalCount: number;
}

const initialState: AlertsState = {
  items: [],
  stats: {},
  loading: false,
  error: null,
  page: 1,
  hasMore: true,
  totalCount: 0,
};

export const fetchAlerts = createAsyncThunk(
  'alerts/fetchAlerts',
  async (params: any, { rejectWithValue }) => {
    try {
      const cleanedParams = Object.entries(params).reduce((acc, [key, value]) => {
        acc[key] = value === "" ? null : value;
        return acc;
      }, {} as any);

      const response = await api.post('/api/alerts', cleanedParams);
      return {
        alerts: response.data.alerts,
        stats: response.data.stats, 
        total_count: response.data.total_count,
        has_more: response.data.has_more,
        requestedPage: params.page
      };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to sync with SOC');
    }
  }
);

export const updateAlertStatus = createAsyncThunk(
  'alerts/updateStatus',
  async ({ id, status }: { id: number; status: string }, { rejectWithValue }) => {
    try {
      await api.patch(`/api/alerts/${id}/status`, { new_status: status });
      return { id, status: status.toUpperCase() }; 
    } catch (err: any) {
      return rejectWithValue({ status: err.response?.status, message: err.response?.data });
    }
  }
);

export const assignAlert = createAsyncThunk(
  'alerts/assign',
  async ({ id, userId }: { id: number; userId: number }, { rejectWithValue }) => {
    try {
      await api.patch(`/api/alerts/${id}/assign`, { user_id: userId });
      return { id, assigned_to: userId };
    } catch (err: any) {
      return rejectWithValue({ status: err.response?.status, message: err.response?.data });
    }
  }
);

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    clearAlerts: (state) => {
      state.items = [];
      state.page = 1;
      state.stats = {};
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.loading = false;
        const { alerts, stats, total_count, has_more, requestedPage } = action.payload;
        if (requestedPage === 1) {
          state.items = alerts;
          state.page = 2; 
        } else {
          state.items = [...state.items, ...alerts];
          state.page += 1;
        }
        state.stats = stats || {};
        state.totalCount = total_count;
        state.hasMore = has_more;
      })
      .addCase(updateAlertStatus.fulfilled, (state, action) => {
        const alert = state.items.find(i => i.id === action.payload.id);
        if (alert) alert.status = action.payload.status;
      })
      .addCase(assignAlert.fulfilled, (state, action) => {
        const alert = state.items.find(i => i.id === action.payload.id);
        if (alert) {
          alert.assigned_to = action.payload.assigned_to;
          alert.status = 'INVESTIGATING'; 
        }
      });
  },
});

export const { clearAlerts } = alertsSlice.actions;
export default alertsSlice.reducer;