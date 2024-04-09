import React, { useEffect, useState } from "react";
import axios from "axios";
import { chitdue_amount_update_url, dueamountunwind_url } from "./url/url";
import ReactPaginate from "react-paginate";

const Chit = () => {
  const [PaidAmount, SetPaidAmount] = useState("");
  const [oldPaidAmount, SetoldPaidAmount] = useState("");
  const [chitduememberlist, setChitduememberlist] = useState([]);
  const [totallpaid, settotallpaid] = useState("");
  const [selectedOption, setSelectedOption] = useState("paid");
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
  const [pageNumber, setPageNumber] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(500);
  const [todaydate, settodaydate] = useState("");
  const [selecttodaydate, setselecttodaydate] = useState("");
  const [totalPaidAmount, setTotalPaidAmount] = useState(0); // Total paid amount state
  const [totalPendingAmount, setTotalPendingAmount] = useState(0); // Total pending amount state

  useEffect(() => {
    getchitduememberlist();
    const today = new Date().toISOString().split("T")[0];
    settodaydate(today);
    setselecttodaydate(today);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [chitduememberlist, filters]);

  useEffect(() => {
    // Calculate total paid amount and total pending amount
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

  const applyFilters = () => {
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
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleUpdate = async () => {
    const totallpaid = parseFloat(oldPaidAmount) + parseFloat(PaidAmount);
    settotallpaid(totallpaid);
    console.log(totallpaid);
    try {
      const payload = {
        id: selectedMember._id,
        paidamount: totallpaid,
        amount: pendingAmount,
        memberId: selectedMember.member.member_id,
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
    }
  };

  const openModal = (member) => {
    setSelectedMember(member);
    SetoldpendingAmount(member.member.pending_amount);
    SetoldPaidAmount(member.member.paid_amount);
    setShowModal(true);
  };

  const indexOfLastItem = (pageNumber + 1) * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredChitduememberlist.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  const handlePageChange = ({ selected }) => {
    setPageNumber(selected);
  };

  const pageCount = Math.ceil(filteredChitduememberlist.length / itemsPerPage);

  const pendingcal = (e) => {
    SetPaidAmount(e);
    const pending = oldpendingAmount - e;
    SetpendingAmount(pending);
  };

  return (
    <div>
      <h5>Due List</h5>
      <div>
        <input
          type="text"
          name="name"
          placeholder="Filter by Name"
          value={filters.name}
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="chitName"
          placeholder="Filter by Chit Name"
          value={filters.chitName}
          onChange={handleFilterChange}
        />
        <input
          type="date"
          name="date"
          placeholder="Filter by Date"
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="chitList"
          placeholder="Filter by Chit List"
          value={filters.chitList}
          onChange={handleFilterChange}
        />
        <select
          name="paidStatus"
          onChange={handleFilterChange}
          value={filters.paidStatus}
        >
          <option value="">All</option>
          <option value="paid">Paid</option>
          <option value="not paid">Not paid</option>
        </select>
      </div>

      <table className="table-wrapper">
        <tr>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td>{totalPaidAmount}</td>
          <td>{totalPendingAmount}</td>
          <td></td>
        </tr>
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
          {currentItems
            .slice()
            .reverse()
            .map((member, index) => {
              console.log(
                member.member.name,
                ">>>",
                member?.member?.paid_amount
              );

              return (
                <tr key={index}>
                  <td>{member.member.name}</td>
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
      </table>

      {/* Pagination */}
      <ReactPaginate
        previousLabel={"Previous"}
        nextLabel={"Next"}
        breakLabel={"..."}
        breakClassName={"break-me"}
        pageCount={pageCount}
        marginPagesDisplayed={2}
        pageRangeDisplayed={5}
        onPageChange={handlePageChange}
        containerClassName={"pagination"}
        subContainerClassName={"pages pagination"}
        activeClassName={"active"}
      />

      {/* Modal */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Pay Amount</h2>
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
                value={todaydate}
                onChange={(e) => setselecttodaydate(e.target.value)}
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
      <div>
        <p>Total Paid Amount: {totalPaidAmount}</p>
        <p>Total Pending Amount: {totalPendingAmount}</p>
      </div>
    </div>
  );
};
export default Chit;
