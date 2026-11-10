import ResponsiveTable from "./ResponsiveTable";
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { chitdue_amount_update_url, dueamountunwind_url } from "./url/url";
import PaginatedList from "./PaginatedList";
import { paymentReference } from "./PaymentHistory";
import "./chit.css"; // Import CSS file for styling

const Chit = () => {
  const [PaidAmount, SetPaidAmount] = useState("");
  const [reference, setReference] = useState("");
  const [oldPaidAmount, SetoldPaidAmount] = useState("");
  const [chitduememberlist, setChitduememberlist] = useState([]);
  const [pendingAmount, SetpendingAmount] = useState("");
  const [oldpendingAmount, SetoldpendingAmount] = useState("");
  const [filteredChitduememberlist, setFilteredChitduememberlist] = useState(
    []
  );
  const [filters, setFilters] = useState({
    name: "",
    chitName: "",
    date: "",
    paidStatus: "",
    chitList: "",
  });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  const [selecttodaydate, setselecttodaydate] = useState("");
  const [totalPaidAmount, setTotalPaidAmount] = useState(0);
  const [totalPendingAmount, setTotalPendingAmount] = useState(0);
  const [selectedOption, setSelectedOption] = useState(""); // Define selectedOption state variable

  const applyFilters = useCallback(() => {
    let filteredList = chitduememberlist.filter((member) => {
      return (
        member.member.name.toLowerCase().includes(filters.name.toLowerCase()) &&
        member.chit_name
          .toLowerCase()
          .includes(filters.chitName.toLowerCase()) &&
        member.date.includes(filters.date) &&
        member.chit_list
          .toLowerCase()
          .includes(filters.chitList.toLowerCase()) &&
        (filters.paidStatus.length > 0
          ? filters.paidStatus === "paid"
            ? member.member.paidStatus === "paid"
            : member.member.paidStatus !== "paid"
          : true)
      );
    });
    setFilteredChitduememberlist(filteredList);
  }, [chitduememberlist, filters]);

  useEffect(() => {
    getchitduememberlist();
    const today = new Date().toISOString().split("T")[0];

    setselecttodaydate(today);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    let totalPaid = 0;
    let totalPending = 0;
    filteredChitduememberlist.forEach((member) => {
      totalPaid += parseFloat(member.member.paid_amount);
      totalPending += parseFloat(member.member.pending_amount);
    });
    setTotalPaidAmount(totalPaid);
    setTotalPendingAmount(totalPending);
  }, [filteredChitduememberlist]);

  const getchitduememberlist = async () => {
    try {
      const response = await axios.get(dueamountunwind_url);
      setChitduememberlist(response.data);
    } catch (error) {
      console.error("Error fetching chit master list:", error);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleUpdate = async () => {
    const totallpaid = parseFloat(oldPaidAmount) + parseFloat(PaidAmount);
    console.log(totallpaid);
    try {
      const payload = {
        id: selectedMember._id,
        reference,
        paidamount: totallpaid,
        amount: pendingAmount,
        memberId: selectedMember.member.member_id,
        share_id: selectedMember.member.share_id,
        paidStatus: selectedOption,
        amount_date: selecttodaydate,
        current_paid_amount: PaidAmount,
        date: selecttodaydate,
      };
      const response = await axios.post(chitdue_amount_update_url, payload);
      console.log(response.data);
      setShowModal(false);
      getchitduememberlist();
    } catch (error) {
      console.error("Error updating member:", error);
      window.alert(error.response?.data?.message || "Unable to record payment");
    }
  };

  const openModal = (member) => {
    setSelectedMember(member);
    setReference(paymentReference());
    SetPaidAmount("");
    SetpendingAmount(member.member.pending_amount);
    setSelectedOption(member.member.paidStatus);
    SetoldpendingAmount(member.member.pending_amount);
    SetoldPaidAmount(member.member.paid_amount);
    setShowModal(true);
  };

  const pendingcal = (e) => {
    SetPaidAmount(e);
    setReference(paymentReference());
    const pending = oldpendingAmount - e;
    SetpendingAmount(pending);
  };
  return (
    <div>
      <div className="page-toolbar compact-toolbar"><h2>Due List</h2></div>
      <div className="filter-grid compact-filter-row">
        {[{ name: "name", label: "Customer Name", type: "text" }, { name: "chitName", label: "Chit Name", type: "text" }, { name: "date", label: "Due Date", type: "date" }, { name: "chitList", label: "List / Installment", type: "text" }].map(field => <div key={field.name}>
          <label htmlFor={`due-filter-${field.name}`}>{field.label}</label>
          <input id={`due-filter-${field.name}`} type={field.type} name={field.name} value={filters[field.name]} onChange={handleFilterChange} placeholder={field.label} />
        </div>)}
        <div><label htmlFor="due-filter-status">Payment Status</label><select id="due-filter-status" name="paidStatus" onChange={handleFilterChange} value={filters.paidStatus}><option value="">All</option><option value="paid">Paid</option><option value="not paid">Not Paid</option></select></div>
      </div>

      <PaginatedList footerPagination items={[...filteredChitduememberlist].reverse()} label="Due list" resetKey={JSON.stringify(filters)}>
      {pageMembers => (
      <ResponsiveTable mobileCards={false} className="table-wrapper compact-list-table">
        <thead>
          <tr>
            <th>Member Name</th>
            <th>Chit Name</th>
            <th>Chit List</th>
            <th>Date</th>
            <th>Amount</th>
            <th>paid Amount</th>
            <th>pending amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {pageMembers.map((member, index) => {
              console.log(
                member.member.name,
                ">>>",
                member?.member?.paid_amount
              );

              return (
                <tr key={index}>
                  <td>{member.member.name} — Share {member.member.share_number}</td>
                  <td>{member.chit_name}</td>
                  <td>{member.chit_list}</td>
                  <td>{member.date}</td>
                  <td>{member.amount}</td>
                  <td>{member?.member?.paid_amount}</td>
                  <td>{member?.member?.pending_amount}</td>
                  <td>
                    {parseInt(member.member.paid_amount) !==
                    parseInt(member.amount) ? (
                      <button onClick={() => openModal(member)}>Pay</button>
                    ) : (
                      <span>No Payment Due</span>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </ResponsiveTable>

      )}
      </PaginatedList>

      {/* Modal */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Pay Amount</h2>
            <p>{selectedMember.member.name} — Share {selectedMember.member.share_number}</p>
            <input
              type="text"
              value={PaidAmount}
              onChange={(e) => pendingcal(e.target.value)}
            />
            <div style={{ width: "100%" }}>
              <input
                type="text"
                value={pendingAmount}
                onChange={(e) => SetpendingAmount(e.target.value)}
                readOnly
              />
              <input
                type="date"
                value={selecttodaydate}
                onChange={(e) => { setselecttodaydate(e.target.value); setReference(paymentReference()); }}
              />
            </div>
            <div>
              <p>
                paid Amount: {oldPaidAmount}, pending amount: {oldpendingAmount}
              </p>
            </div>

            <div>
              <label htmlFor="paymentSelect">Select Payment:</label>
              <select
                id="paymentSelect"
                value={selectedOption}
                onChange={(e) => {
                  setSelectedOption(e.target.value);
                }}
              >
                <option value="">Select...</option>
                <option value="paid">Paid</option>
                <option value="notPaid">Not Paid</option>
              </select>
              {selectedOption && (
                <p>
                  You selected:{" "}
                  {selectedOption === "paid" ? "Paid" : "Not Paid"}
                </p>
              )}
            </div>

            <button onClick={handleUpdate}>Update</button>
            <button onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Display Total Paid and Pending Amount */}
      <div className="due-totals">
        <p>Total Paid Amount: {totalPaidAmount}</p>
        <p>Total Pending Amount: {totalPendingAmount}</p>
      </div>
    </div>
  );
};

export default Chit;
