import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Loading } from './components/ui';

import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import TaskDetail from './pages/TaskDetail';
import NotFound from './pages/NotFound';

import TaskerDashboard from './pages/tasker/Dashboard';
import NewTask from './pages/tasker/NewTask';

import BrowseTasks from './pages/worker/BrowseTasks';
import MyWork from './pages/worker/MyWork';
import Earnings from './pages/worker/Earnings';

import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminTasks from './pages/admin/Tasks';
import AdminPayouts from './pages/admin/Payouts';

// "/" shows a different home screen depending on the signed-in role.
function Home() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'worker') return <BrowseTasks />;
  return <TaskerDashboard />;
}

const only = (roles, el) => <ProtectedRoute roles={roles}>{el}</ProtectedRoute>;

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />

        <Route path="/new" element={only(['tasker'], <NewTask />)} />

        <Route path="/work" element={only(['worker'], <MyWork />)} />
        <Route path="/earnings" element={only(['worker'], <Earnings />)} />

        <Route path="/admin/tasks" element={only(['admin'], <AdminTasks />)} />
        <Route path="/admin/users" element={only(['admin'], <AdminUsers />)} />
        <Route path="/admin/payouts" element={only(['admin'], <AdminPayouts />)} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
