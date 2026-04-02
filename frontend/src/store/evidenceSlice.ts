import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axiosConfig';

interface EvidenceState {
  packets: any[];
  loading: boolean;
  error: string | null;
}

const initialState: EvidenceState = {
  packets: [],
  loading: false,
  error: null,
};

export const fetchAlertEvidence = createAsyncThunk(
  'evidence/fetch',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/alerts/${id}/evidence`, {
        window_minutes: 5,
        page: 1,
        size: 200
      });
      return response.data.packets;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to fetch packets');
    }
  }
);

const evidenceSlice = createSlice({
  name: 'evidence',
  initialState,
  reducers: {
    clearEvidence: (state) => {
      state.packets = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlertEvidence.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAlertEvidence.fulfilled, (state, action) => {
        state.loading = false;
        state.packets = action.payload;
      })
      .addCase(fetchAlertEvidence.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearEvidence } = evidenceSlice.actions;
export default evidenceSlice.reducer;