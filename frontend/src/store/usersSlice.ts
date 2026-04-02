import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api/axiosConfig';

export interface User {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
}

interface UsersState {
  list: User[];
  loading: boolean;
  error: string | null;
}

const initialState: UsersState = {
  list: [],
  loading: false,
  error: null,
};

export const fetchAllUsers = createAsyncThunk('users/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const response = await api.get('/api/users/list'); 
    return response.data; 
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.detail || 'Failed to fetch users');
  }
});

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload; 
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export default usersSlice.reducer;