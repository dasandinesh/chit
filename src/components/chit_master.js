import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  chit_get_url,
  chitdue_get_url,
  chitdue_add_url,
  chitdue_amount_update_url,
} from "./url/url";

const ChitMaster = () => {
  const [chitMasterList, setChitMasterList] = useState([]);
  const [chitList, setChitList] = useState([]);
  const [selectedChit, setSelectedChit] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [list, SetList] = useState("");
  const [updatedRows, setUpdatedRows] = useState([]);

  const [PaidAmount, SetPaidAmount] = useState("");

  useEffect(() => {
    fetchChitMasterList();
    fetchChitList();
  }, []);

  const fetchChitMasterList = async () => {
    try {
      const response = await axios.get(chitdue_get_url);
      setChitMasterList(response.data);
    } catch (error) {
      console.error("Error fetching chit master list:", error);
    }
  };

  const fetchChitList = async () => {
    try {
      const response = await axios.get(chit_get_url);
      setChitList(response.data);
    } catch (error) {
      console.error("Error fetching chit list:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dueLists = [];

      const chitDet = {
        chit_name: selectedChit,
        chit_list: list,
        date: date,
        amount: amount,
        member: dueLists,
      };

      chitList.forEach((chit) => {
        if (chit.chit_det && chit.chit_det.chit_name === selectedChit) {
          chit.member_list.forEach((member) => {
            const dueList = {
              name: member.name,
              member_id: member.member_id,
              date: date,
              amount: amount,
              paid_amount: "0",
              pending_amount: amount,
              paidStatus: "not paid",
            };
            dueLists.push(dueList);
          });
        }
      });

      await updateChitDue(chitDet);
    } catch (error) {
      console.error("Error fetching chit master list:", error);
    }
  };

  const updateChitDue = async (dueLists) => {
    try {
      await axios.post(chitdue_add_url, dueLists);
      console.log("Chit dues updated successfully!");
      // Assuming successful update, clear PaidAmount
      SetPaidAmount("");
      // Update updatedRows state to mark the row as updated
      setUpdatedRows((prevRows) => [...prevRows, dueLists._id]); // Create new array
      // Force re-render by fetching the chit master list again
      fetchChitMasterList();
    } catch (error) {
      console.error("Error updating chit dues:", error);
    }
  };

  const handleViewMembers = (members, index) => {
    setChitMasterList(
      chitMasterList.map((chitDue, i) => {
        if (i === index) {
          return { ...chitDue, showDetails: !chitDue.showDetails };
        }
        return chitDue;
      })
    );
  };
  const handleUpdate = async (memberId, updatedAmount, chitId) => {
    try {
      const payload = {
        id: chitId,
        amount: updatedAmount,
        memberId: memberId,
      };
      const response = await axios.post(chitdue_amount_update_url, payload);

      console.log(response.data); // Log the response from the serverless function
      // You can also update your state or perform any other actions based on the response
    } catch (error) {
      console.error("Error updating member:", error);
      // Handle error
    }
  };
  return (
    <div className="container">
      <form
        onSubmit={handleSubmit}
        className="d-flex flex-column flex-md-row align-items-center justify-content-between"
      >
        <select
          value={selectedChit}
          onChange={(e) => setSelectedChit(e.target.value)}
          className="form-select mb-2 mb-md-0 mr-md-2"
        >
          <option value="">Select a Chit</option>
          {chitList.map((chit) => (
            <option key={chit._id} value={chit.chit_det.chit_name}>
              {chit.chit_det.chit_name}
            </option>
          ))}
        </select>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="form-control mb-2 mb-md-0 mr-md-2"
          style={{ width: "150px" }}
        />
        <input
          type="text"
          required
          value={list}
          onChange={(e) => SetList(e.target.value)}
          className="form-control mb-2 mb-md-0 mr-md-2"
          style={{ width: "150px" }}
          placeholder="list"
        />
        <input
          type="text"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="form-control mb-2 mb-md-0 mr-md-2"
          placeholder="Amount"
        />
        <button type="submit" className="btn btn-primary">
          Create
        </button>
      </form>
      <table className="table">
        <thead>
          <tr>
            <th>Chit Name</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {chitMasterList.map((chitDue, index) => (
            <React.Fragment key={index}>
              <tr
                style={{
                  backgroundColor: updatedRows.includes(chitDue._id)
                    ? "yellow"
                    : "inherit",
                }}
              >
                <td>{chitDue.chit_name}</td>
                <td>{chitDue.date}</td>
                <td>{chitDue.amount}</td>
                <td>
                  <button
                    onClick={() => handleViewMembers(chitDue.member, index)}
                    className="btn btn-secondary"
                  >
                    View
                  </button>
                </td>
              </tr>
              {chitDue.showDetails && (
                <tr key={`details_${index}`}>
                  <td colSpan="4">
                    <div>
                      <h6>Member Details</h6>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Paid Option</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chitDue.member.map((member, i) => (
                            <tr
                              key={i}
                              style={{
                                backgroundColor: member.paid_amount
                                  ? "green"
                                  : "inherit",
                              }}
                            >
                              <td>{member.name}</td>
                              <td>{member.date}</td>
                              <td>{member.amount}</td>
                              <td>
                                <input
                                  type="text"
                                  value={PaidAmount}
                                  onChange={(e) =>
                                    SetPaidAmount(e.target.value)
                                  }
                                  className="form-control"
                                  style={{
                                    width: "150px",
                                    backgroundColor: member.paid_amount
                                      ? "lightgreen"
                                      : "inherit",
                                    pointerEvents: member.paid_amount
                                      ? "none"
                                      : "auto",
                                  }}
                                  readOnly={member.paid_amount ? true : false}
                                  placeholder={member.paid_amount}
                                />
                              </td>
                              <td>{member.paidStatus}</td>
                              <td>
                                <button
                                  onClick={() =>
                                    handleUpdate(
                                      member.member_id,
                                      PaidAmount,
                                      chitDue._id
                                    )
                                  }
                                  className="btn btn-primary"
                                >
                                  Update
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ChitMaster;
