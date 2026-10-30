import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import AdminPage from './pages/AdminPage'
import AlertsPage from './pages/AlertsPage'
import ControlPage from './pages/ControlPage'
import FieldDetailPage, { FieldIndexRedirect } from './pages/FieldDetailPage'
import ValidationPage from './pages/ValidationPage'
import MrvPage from './pages/mrv/MrvPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ControlPage />} />
            <Route path="fields" element={<FieldIndexRedirect />} />
            <Route path="fields/:fieldId" element={<FieldDetailPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="mrv" element={<MrvPage />} />
            <Route path="validation" element={<ValidationPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
