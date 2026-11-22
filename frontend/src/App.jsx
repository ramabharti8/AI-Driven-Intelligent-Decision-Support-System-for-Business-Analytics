// App.jsx — Root app with routing

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import AppLayout from './components/layout/AppLayout'

// Pages
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Dashboard    from './pages/Dashboard'
import DatasetsPage from './pages/DatasetsPage'
import PreprocessPage from './pages/PreprocessPage'
import MLModelsPage from './pages/MLModelsPage'
import PredictionsPage from './pages/PredictionsPage'
import CustomersPage from './pages/CustomersPage'
import InsightsPage from './pages/InsightsPage'
import ReportsPage  from './pages/ReportsPage'
import AdminPage    from './pages/AdminPage'
import ProfilePage  from './pages/ProfilePage'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

            {/* Protected */}
            <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"   element={<Dashboard />} />
              <Route path="datasets"    element={<DatasetsPage />} />
              <Route path="preprocess"  element={<PreprocessPage />} />
              <Route path="ml-models"   element={<MLModelsPage />} />
              <Route path="predictions" element={<PredictionsPage />} />
              <Route path="customers"   element={<CustomersPage />} />
              <Route path="insights"    element={<InsightsPage />} />
              <Route path="reports"     element={<ReportsPage />} />
              <Route path="profile"     element={<ProfilePage />} />

              {/* Admin only */}
              <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
