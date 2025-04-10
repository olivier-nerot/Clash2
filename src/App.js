import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Regie from './pages/Regie';
import Show from './pages/Show';
import Public from './pages/Public';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/regie" element={<Regie />} />
          <Route path="/show" element={<Show />} />
          <Route path="/public" element={<Public />} />
          <Route path="/" element={<Navigate to="/regie" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 