import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Home from './pages/Home'
import SensorData from './pages/SensorData'
import MapPage from './pages/MapPage'
import MrvPage from './pages/mrv/MrvPage'
import AlertPage from './pages/AlertPage'
import ValidationPage from './pages/ValidationPage'
import ComingSoon from './components/common/ComingSoon'
import { FieldContext } from './fieldContext'
import { Field } from './types'
import useIsMobile from './useIsMobile'

const navItems = [
  { label: 'Map', path: '/map' },
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Sensor Data', path: '/sensor' },
  { label: 'Alerts', path: '/alerts' },
  { label: 'MRV', path: '/mrv' },
  { label: 'Validation', path: '/validations' },
]

function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  const menuFontFamily = "'Noto Sans KR', 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"

  return (
    <nav style={{
      borderBottom: '0.5px solid #e0e0e0',
      background: 'white',
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        width: '100%',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <NavLink to="/map" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '20px', fontWeight: 800, color: '#1D9E75', letterSpacing: '-0.5px' }}>Nonstop</span>
        </NavLink>

        {isMobile ? (
          <>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: '#555', padding: '4px 8px', fontFamily: menuFontFamily, fontWeight: 700 }}
            >
              {menuOpen ? 'Close' : 'Menu'}
            </button>
            {menuOpen && (
              <div style={{
                position: 'fixed', top: '48px', left: 0, right: 0,
                background: 'white', borderBottom: '0.5px solid #e0e0e0',
                zIndex: 200, padding: '8px 0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}>
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMenuOpen(false)}
                    style={({ isActive }) => ({
                      display: 'block',
                      padding: '12px 20px',
                      fontSize: '14px',
                      fontFamily: menuFontFamily,
                      fontWeight: isActive ? 800 : 600,
                      color: isActive || item.path === '/dashboard' ? '#1D9E75' : '#555',
                      textDecoration: 'none',
                      background: isActive ? '#f0faf6' : 'white',
                      borderLeft: isActive ? '3px solid #1D9E75' : '3px solid transparent',
                    })}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', gap: '4px' }}>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  fontSize: '13px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: menuFontFamily,
                  background: isActive ? '#f0f0f0' : 'transparent',
                  fontWeight: isActive ? 800 : 600,
                  color: item.path === '/dashboard' ? '#1D9E75' : isActive ? '#222' : '#888',
                  textDecoration: 'none',
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

export default function App() {
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null)

  const selectField = (fieldId: number | null, fields: Field[]) => {
    setSelectedFieldId(fieldId)
    const field = fields.find((f) => f.id === fieldId)
    if (field?.location_desc) setSelectedRegion(field.location_desc)
  }

  return (
    <FieldContext.Provider value={{ selectedRegion, selectedFieldId, setSelectedRegion, setSelectedFieldId, selectField }}>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', background: '#fafafa' }}>
          <NavBar />
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/dashboard" element={<Home />} />
            <Route path="/sensor" element={<SensorData />} />
            <Route path="/alerts" element={<AlertPage />} />
            <Route path="/mrv" element={<MrvPage />} />
            <Route path="/validation" element={<Navigate to="/validations" replace />} />
            <Route path="/validations" element={<ComingSoon size="lg" placement="top"><ValidationPage /></ComingSoon>} />
          </Routes>
        </div>
      </BrowserRouter>
    </FieldContext.Provider>
  )
}
