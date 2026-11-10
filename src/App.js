import React from "react";
import "./App.css";
import "./responsive.css";
import './sidebar.css';
import Home from "./components/home";
import Coustomer from "./components/coustomer";
import Navbars from "./components/Navbars";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Chit from "./components/chit";
import ChitMaster from "./components/chit_master";
import SendMessage from "./components/sms/SendMessage";
import Accountdata from "./components/account/account";
import AddChit from "./components/add_chit";
import Footer from "./components/Footer";
import AdminLogin from './components/AdminLogin';

function App() {
  return (
    <AdminLogin>{auth => <div className="app-shell authenticated-shell">
      {/* <Add_cus /> */}
      <BrowserRouter>
        <Navbars auth={auth} />
        <main className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/coustomer" element={<Coustomer />} />
          <Route path="/add_chit" element={<AddChit />} />
          <Route path="/chit" element={<Chit />} />
          <Route path="/ChitMaster" element={<ChitMaster />} />
          <Route path="/sms" element={<SendMessage />} />
          <Route path="/account" element={<Accountdata />} />
        </Routes>
        </main>
      </BrowserRouter>
      <div id="pagination-footer" className="pagination-footer" />
      <Footer />
    </div>}</AdminLogin>
  );
}

export default App;
