import React, { useState } from "react";
import {
  Collapse,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
  NavItem,
  NavLink,
} from "reactstrap";

const Navbars = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen(!isOpen);

  return (
    <Navbar color="light" light expand="md">
      <div className="container">
        <NavbarToggler onClick={toggle} />
        <Collapse isOpen={isOpen} navbar>
          <Nav className="mr-auto" navbar>
            <NavItem>
              <NavLink href="#home">Home</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="/coustomer">Customer</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="/chit">Chit</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="/add_chit">Add Chit</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="/ChitMaster">Chit Master</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="/account">account</NavLink>
            </NavItem>
            <NavItem>
              <NavLink href="/account">Super Depit note</NavLink>
            </NavItem>
          </Nav>
        </Collapse>
      </div>
    </Navbar>
  );
};

export default Navbars;
