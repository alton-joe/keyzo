import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/providers'
import type { Role } from './lib/types'
import { PageLoader } from './components/ui'
import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'
import Landing from './pages/public/Landing'
import Gateway from './pages/public/Gateway'

const Browse = lazy(() => import('./pages/public/Browse'))
const UnitDetail = lazy(() => import('./pages/public/UnitDetail'))
const About = lazy(() => import('./pages/public/About'))
const Tour = lazy(() => import('./pages/public/Tour'))
const Login = lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./pages/public/AuthPages').then((m) => ({ default: m.Register })))

const Dashboard = lazy(() => import('./pages/app/Dashboard'))
const Properties = lazy(() => import('./pages/app/Properties'))
const PropertyDetailPage = lazy(() => import('./pages/app/PropertyDetail'))
const Applications = lazy(() => import('./pages/app/Applications'))
const Leases = lazy(() => import('./pages/app/Leases'))
const LeaseDetailPage = lazy(() => import('./pages/app/LeaseDetail'))
const Tenants = lazy(() => import('./pages/app/Tenants'))
const Invoices = lazy(() => import('./pages/app/Invoices'))
const Deposits = lazy(() => import('./pages/app/Deposits'))
const Maintenance = lazy(() => import('./pages/app/Maintenance'))
const MaintenanceDetailPage = lazy(() => import('./pages/app/MaintenanceDetail'))
const Expenses = lazy(() => import('./pages/app/Expenses'))
const Reports = lazy(() => import('./pages/app/Reports'))
const UsersPage = lazy(() => import('./pages/app/Users'))
const Audit = lazy(() => import('./pages/app/Audit'))
const Notifications = lazy(() => import('./pages/app/Notifications'))
const Profile = lazy(() => import('./pages/app/Profile'))

function RequireAuth() {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return <AppLayout />
}

function Guard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { hasRole } = useAuth()
  return hasRole(...roles) ? <>{children}</> : <Navigate to="/app" replace />
}

const operator: Role[] = ['SuperAdmin', 'Owner', 'Manager']

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Gateway />} />
          <Route path="homes" element={<Landing />} />
          <Route path="about" element={<About />} />
          <Route path="units" element={<Browse />} />
          <Route path="units/:id" element={<UnitDetail />} />
        </Route>
        {/* full-screen house tour - outside the public layout so nothing sits on top of the rooms */}
        <Route path="units/:id/tour" element={<Tour />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route path="app" element={<RequireAuth />}>
          <Route index element={<Dashboard />} />
          <Route path="properties" element={<Guard roles={operator}><Properties /></Guard>} />
          <Route path="properties/:id" element={<Guard roles={operator}><PropertyDetailPage /></Guard>} />
          <Route path="tenants" element={<Guard roles={operator}><Tenants /></Guard>} />
          <Route path="applications" element={<Applications />} />
          <Route path="leases" element={<Leases />} />
          <Route path="leases/:id" element={<LeaseDetailPage />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="deposits" element={<Deposits />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="maintenance/:id" element={<MaintenanceDetailPage />} />
          <Route path="expenses" element={<Guard roles={operator}><Expenses /></Guard>} />
          <Route path="reports" element={<Guard roles={operator}><Reports /></Guard>} />
          <Route path="users" element={<Guard roles={['SuperAdmin', 'Owner']}><UsersPage /></Guard>} />
          <Route path="audit" element={<Guard roles={['SuperAdmin']}><Audit /></Guard>} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
