import React, { useEffect, useState } from "react";
import axios from "axios";
import { getaccount_url, customer_get_url, postcredit_url } from "../url/url";
import { Row, Col } from "react-bootstrap";
import "../chit.css"; // Import CSS file for styling

const Accountdata = () => {
  const [chitData, setChitData] = useState([]);
  // const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [Cuslist, setCuslist] = useState([]);
  const [filteredChitData, setFilteredChitData] = useState([]);
  const [filters, setFilters] = useState({
    memberName: "",
    fromDate: "",
    toDate: "",
    minCredit: "",
    maxCredit: "",
    minDebit: "",
    maxDebit: "",
  });
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showDebitModal, setShowDebitModal] = useState(false);
  const [creditFormData, setCreditFormData] = useState({
    memberName: "",
    date: "",
    credit: "",
    description: "",
  });
  const [debitFormData, setDebitFormData] = useState({
    memberName: "",
    date: "",
    debit: "",
    description: "",
  });

  useEffect(() => {
    fetchData();
    cusGetList();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(getaccount_url);
      setChitData(response.data); // Assuming the data structure is an array
      setFilteredChitData(response.data); // Initially set filtered data to all data
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    const applyFilters = () => {
      const filteredData = chitData.filter((chit) => {
        return (
          (filters.memberName === "" ||
            chit.memberName
              .toLowerCase()
              .includes(filters.memberName.toLowerCase())) &&
          (filters.fromDate === "" ||
            new Date(chit.date) >= new Date(filters.fromDate)) &&
          (filters.toDate === "" ||
            new Date(chit.date) <= new Date(filters.toDate)) &&
          (filters.minCredit === "" ||
            parseFloat(chit.credit) >= parseFloat(filters.minCredit)) &&
          (filters.maxCredit === "" ||
            parseFloat(chit.credit) <= parseFloat(filters.maxCredit)) &&
          (filters.minDebit === "" ||
            parseFloat(chit.debit) >= parseFloat(filters.minDebit)) &&
          (filters.maxDebit === "" ||
            parseFloat(chit.debit) <= parseFloat(filters.maxDebit))
        );
      });
      setFilteredChitData(filteredData);
    };

    applyFilters();
  }, [chitData, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prevFilters) => ({
      ...prevFilters,
      [name]: value,
    }));
  };

  const handleCreditFormChange = (e) => {
    const { name, value } = e.target;
    setCreditFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleDebitFormChange = (e) => {
    const { name, value } = e.target;
    setDebitFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleCreditSubmit = async () => {
    const payload = {
      // memberId: ids,
      memberName: creditFormData.memberName,
      description: creditFormData.description,
      date: creditFormData.date,
      debitCredit: "credit",
      credit: creditFormData.credit,
      debit: "0",
    };
    await axios.post(postcredit_url, payload);
    setShowCreditModal(false);
  };

  const handleDebitSubmit = async () => {
    const payload = {
      // memberId: ids,
      memberName: debitFormData.memberName,
      description: debitFormData.description,
      date: debitFormData.date,
      debitCredit: "Debit",

      credit: "0",
      debit: debitFormData.debit,
    };
    await axios.post(postcredit_url, payload);
    setShowDebitModal(false);
  };

  const totalCredit = filteredChitData.reduce(
    (total, chit) => total + parseFloat(chit.credit),
    0
  );
  const totalDebit = filteredChitData.reduce(
    (total, chit) => total + parseFloat(chit.debit),
    0
  );

  const cusGetList = async () => {
    try {
      const res = await axios.get(customer_get_url);
      setCuslist(res.data);
    } catch (error) {
      console.error("Error fetching customer list:", error);
    }
  };

  return (
    <div className="container">
      <br />
      <Row>
        <Col>
          <input
            type="text"
            name="memberName"
            value={filters.memberName}
            onChange={handleFilterChange}
            className="form-control"
            placeholder="Member Name"
            style={{ width: "200px" }}
          />
        </Col>
        <Col>
          <input
            type="date"
            name="fromDate"
            value={filters.fromDate}
            onChange={handleFilterChange}
            className="form-control"
          />
        </Col>
        <Col>
          <input
            type="date"
            name="toDate"
            value={filters.toDate}
            onChange={handleFilterChange}
            className="form-control"
          />
        </Col>
        <Col>
          <input
            type="number"
            name="minCredit"
            value={filters.minCredit}
            onChange={handleFilterChange}
            className="form-control"
            placeholder="Min Credit"
          />
        </Col>
        <Col>
          <input
            type="number"
            name="maxCredit"
            value={filters.maxCredit}
            onChange={handleFilterChange}
            className="form-control"
            placeholder="Max Credit"
          />
        </Col>
        <Col>
          <input
            type="number"
            name="minDebit"
            value={filters.minDebit}
            onChange={handleFilterChange}
            className="form-control"
            placeholder="Min Debit"
          />
        </Col>
        <Col>
          <input
            type="number"
            name="maxDebit"
            value={filters.maxDebit}
            onChange={handleFilterChange}
            className="form-control"
            placeholder="Max Debit"
          />
        </Col>
      </Row>{" "}
      <br />
      <Row>
        <Col>
          <h4>Total Credit: {totalCredit}</h4>
        </Col>
        <Col>
          <h4>Total Debit: {totalDebit}</h4>
        </Col>
        <Col>
          <button onClick={() => setShowCreditModal(true)}>
            Add Credit note
          </button>
        </Col>
        <Col>
          <button onClick={() => setShowDebitModal(true)}>
            Add Debit note
          </button>
        </Col>
      </Row>
      <div className="total-section"></div>
      {/* Credit Modal */}
      {showCreditModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add Credit Note</h2>
            <button
              className="close-btn"
              onClick={() => setShowCreditModal(false)}
            >
              X
            </button>
            <form>
              <label>Member Name</label>
              <input
                type="text"
                placeholder="Enter member name"
                name="memberName"
                value={creditFormData.memberName}
                onChange={handleCreditFormChange}
              />
              <label>Date</label>
              <input
                type="date"
                name="date"
                value={creditFormData.date}
                onChange={handleCreditFormChange}
              />
              <label>Credit</label>
              <input
                type="number"
                placeholder="Enter credit amount"
                name="credit"
                value={creditFormData.credit}
                onChange={handleCreditFormChange}
              />
              <label>Description</label>
              <textarea
                rows="3"
                placeholder="Enter description"
                name="description"
                value={creditFormData.description}
                onChange={handleCreditFormChange}
              />
              <button type="button" onClick={handleCreditSubmit}>
                Submit
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Debit Modal */}
      {showDebitModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add Debit Note</h2>
            <button
              className="close-btn"
              onClick={() => setShowDebitModal(false)}
            >
              X
            </button>
            <form>
              <label>Member Name</label>
              <input
                type="text"
                placeholder="Enter member name"
                name="memberName"
                value={debitFormData.memberName}
                onChange={handleDebitFormChange}
                list="memberList"
              />
              <datalist id="memberList">
                {Cuslist.map((customer, index) => (
                  <option key={index} value={customer.name} />
                ))}
              </datalist>
              <label>Date</label>
              <input
                type="date"
                name="date"
                value={debitFormData.date}
                onChange={handleDebitFormChange}
              />
              <label>Debit</label>
              <input
                type="number"
                placeholder="Enter debit amount"
                name="debit"
                value={debitFormData.debit}
                onChange={handleDebitFormChange}
              />
              <select
                name="transactionType"
                value={debitFormData.transactionType}
                onChange={handleDebitFormChange}
              >
                <option value="personal">Personal Money</option>
                <option value="cash">Hand Cash</option>
              </select>
              <label>Description</label>
              <textarea
                rows="3"
                placeholder="Enter description"
                name="description"
                value={debitFormData.description}
                onChange={handleDebitFormChange}
              />
              <button type="button" onClick={handleDebitSubmit}>
                Submit
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Display filtered data */}
      <table className="table">
        <thead>
          <tr>
            <th>Member Name</th>
            <th>Date</th>
            <th>Credit</th>
            <th>Debit</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {filteredChitData.map((chit, index) => (
            <tr key={index}>
              <td>{chit.memberName}</td>
              <td>{chit.date}</td>
              <td>{chit.credit}</td>
              <td>{chit.debit}</td>
              <td>{chit.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Accountdata;
