import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Redirects to login if signed out, and to home if the role is not allowed. */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
