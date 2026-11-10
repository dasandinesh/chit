import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Offcanvas } from "react-bootstrap";

const links = [
  ["/", "Home"], ["/coustomer", "Customers"], ["/chit", "Dues"],
  ["/add_chit", "Chit Groups"], ["/ChitMaster", "Chit Master"],
  ["/account", "Accounts"], ["/sms", "Messages"]
];
export default function Navbars({ auth }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  return <>
    <header className="sidebar-mobile-bar">
      <button type="button" onClick={() => setIsOpen(true)} aria-label="Toggle navigation" aria-expanded={isOpen} aria-controls="main-navigation">☰ Menu</button>
      <span>Chit Manager</span>
    </header>
    <Offcanvas id="main-navigation" show={isOpen} onHide={close} responsive="lg" placement="start" className="app-sidebar" aria-labelledby="sidebar-title">
      <Offcanvas.Header closeButton closeVariant="white"><Offcanvas.Title id="sidebar-title">Chit Manager</Offcanvas.Title></Offcanvas.Header>
      <Offcanvas.Body>
        <NavLink className="sidebar-brand" to="/" onClick={close}>Chit Manager</NavLink>
        <nav aria-label="Main navigation" className="sidebar-links">
          {links.map(([path, label]) => <NavLink key={path} to={path} end={path === '/'} onClick={close}>{label}</NavLink>)}
        </nav>
        {auth && <div className="sidebar-admin">
          <span>Signed in as {auth.username}</span>
          <button className="btn-secondary" disabled={auth.busy} onClick={() => { close(); auth.openPassword(); }}>Change Password</button>
          <button disabled={auth.busy} onClick={auth.logout}>Logout</button>
        </div>}
      </Offcanvas.Body>
    </Offcanvas>
  </>;
}
