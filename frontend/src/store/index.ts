import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import alertsReducer from './alertsSlice';
import userReducer from './usersSlice';
import evidenceReducer from './evidenceSlice';
import commentsReducer from './commentsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    alerts: alertsReducer,
    users: userReducer,
    evidence: evidenceReducer,
    comments: commentsReducer,
  },
});


export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;