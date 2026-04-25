import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const Room = lazy(() => import('./pages/Room'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-[#202529] text-[#cbdce6] flex items-center justify-center font-mono text-xs tracking-widest">LOADING_SESSION</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:id" element={<Room />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
