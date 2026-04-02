import { Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import { type RootState } from '../store';
import { ShieldAlert, LayoutDashboard, Activity, LogOut, User as UserIcon } from 'lucide-react';
import './Layout.css';

const Layout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <div className="siem-layout">
      <aside className="siem-sidebar">
        <div className="sidebar-brand">
          <ShieldAlert className="text-sky-500" size={28} />
          <span>SIEMENDS</span>
        </div>
        <nav className="sidebar-links">
          <button className="nav-link active"><LayoutDashboard size={20}/> Dashboard</button>
          <button className="nav-link"><Activity size={20}/> Alerts</button>
        </nav>
        <button onClick={() => { dispatch(logout()); navigate('/login'); }} className="nav-link logout-btn">
          <LogOut size={20}/> Logout
        </button>
      </aside>

      <main className="siem-main">
        <header className="siem-header">
          <span className="breadcrumb">Security Operations Center</span>
          <div className="header-user">
            <span className="username">{user?.username}</span>
            <UserIcon size={20} className="user-icon" />
          </div>
        </header>
        <div className="content-scroll">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
export default Layout;