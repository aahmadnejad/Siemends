import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axiosConfig';

interface CommentsState {
  items: any[];
  loading: boolean;
  submitting: boolean;
}

const initialState: CommentsState = {
  items: [],
  loading: false,
  submitting: false,
};

export const fetchAlertComments = createAsyncThunk(
  'comments/fetchAll',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await api.get(`/api/alerts/${id}/comment`);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const postAlertComment = createAsyncThunk(
  'comments/post',
  async ({ id, text }: { id: number; text: string }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/api/alerts/${id}/comment`, { comment_text: text });
      return response.data; 
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const commentsSlice = createSlice({
  name: 'comments',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlertComments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAlertComments.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(postAlertComment.pending, (state) => {
        state.submitting = true;
      })
      .addCase(postAlertComment.fulfilled, (state) => {
        state.submitting = false;
      })
      .addCase(postAlertComment.rejected, (state) => {
        state.submitting = false;
      });
  }
});

export default commentsSlice.reducer;