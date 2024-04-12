import axios from "axios";
import React, { useEffect, useState } from "react";
import { customer_get_url, customer_add_url } from "./url/url";
import "./coustomer.css";

const Coustomer = () => {
  const [cuslist, setCuslist] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending_flag, setPending_flag] = useState("");
  const [showModal, setShowModal] = useState(false); // State to control modal visibility

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addCusPost();
    setCuslist([]); // Clear existing customer list to force re-fetch
    setShowModal(false); // Close the modal after adding a customer
  };

  const addCusPost = async () => {
    const data = {
      name: name,
      phone: phone,
      pending_flag: pending_flag,
    };
    // Make API call to add customer
    try {
      await axios.post(customer_add_url, data);
    } catch (error) {
      console.error("Error adding customer:", error);
    }
    cusGetList();
  };

  const cusGetList = async () => {
    try {
      const res = await axios.get(customer_get_url);
      setCuslist(res.data);
    } catch (error) {
      console.error("Error fetching customer list:", error);
    }
    // const data = {
    //   name: "",
    //   phone: "",
    //   pending_flag: "",
    // };
  };

  useEffect(() => {
    cusGetList();
  }, []);

  return (
    <div>
      <button onClick={() => setShowModal(true)}>Add Customer</button>
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setShowModal(false)}>
              &times;
            </span>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="name"
              />
              <input
                type="phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="phone"
              />
              <label>
                Pending Flag:
                <input
                  type="checkbox"
                  onChange={(e) => setPending_flag(e.target.checked)}
                />
              </label>
              <button type="submit">Add</button>
            </form>
          </div>
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Pending Flag</th>
            <th>Views</th>
          </tr>
        </thead>
        <tbody>
          {cuslist.map((customer, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{customer.name}</td>
              <td>{customer.phone}</td>
              <td>{customer.pending_flag ? "Yes" : "No"}</td>
              <td>
                <a href={`/views/${customer._id}`}>Views</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Coustomer;
