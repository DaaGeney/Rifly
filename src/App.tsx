import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import PublicBoard from './pages/PublicBoard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminPage />} />
        <Route path="/tablero" element={<PublicBoard />} />
      </Routes>
    </BrowserRouter>
  )
}
