import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomeScreen from "./pages/HomeScreen";
import LoginScreen from "./pages/LoginScreen";
import CreateAccountScreen from "./pages/CreateAccountScreen";
import Chat from "./pages/chat";
import ApiDocs from './components/ApiDocs';
import AboutScreen from './pages/AboutScreen';
import Features from './pages/features';
import ContactPage from './pages/ContactPage';
import { AuthProvider } from "./contexts/authContext";


function App() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        <Route path="/api" element={<ApiDocs />} />
        <Route path="/" element={<HomeScreen />} />
        <Route path="/LoginScreen" element={<LoginScreen />} />
        <Route path="/create-account" element={<CreateAccountScreen />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/about" element={<AboutScreen />} />
        <Route path="/features" element={<Features />} />
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;