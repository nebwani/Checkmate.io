import { useEffect, useState } from 'react';   
import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Landing } from './screens/Landing';
import Login from './screens/Login';
import { Game } from './screens/Game';
import {RecoilRoot, useRecoilValue, useSetRecoilState} from 'recoil'
// import Loader from './components/Loader'
import { userAtom } from './store/src/atoms/user';
import Profile from './screens/Profile';

function App() {
  return (
    <div className='h-screen bg-slate-950'>
    <RecoilRoot>
      <AuthApp/>
    </RecoilRoot>
    </div>
  )
}

// function App() {
//   return (
//     <RecoilRoot>
//       <AuthApp />
//     </RecoilRoot>
//   );
// }


// function AuthApp() {
//   const user = useUser();
//   return <BrowserRouter>
//       <Routes>
//         <Route path='/' element={<Landing />} />
//         <Route path="/login" element={user ? <Game /> : <Login />} />
//         <Route path="/game/:gameId" element={user ? <Game /> : <Login />} />
//       </Routes>
//     </BrowserRouter>
// }

function AuthApp() {
  const setUser = useSetRecoilState(userAtom);
  const user = useRecoilValue(userAtom);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/refresh`, {
      method: "GET",
      credentials: "include",
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setUser(data);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setUser]);

  if (loading) {
    return <div className="text-white">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={user ? <Game /> : <Login />} />
        <Route path="/game/:gameId" element={user ? <Game /> : <Login />} />
        <Route path="/user/:userId" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
