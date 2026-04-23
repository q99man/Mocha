import { Navigate } from 'react-router-dom';

export function AdminModelAssetsPage() {
  return <Navigate to="/admin?tab=models" replace />;
}
