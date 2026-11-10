import ResponsiveTable from "./ResponsiveTable";
import PaginatedList from "./PaginatedList";
import axios from "axios";
import { Modal } from "react-bootstrap";
import { useForm, useFieldArray } from "react-hook-form";
import { chit_get_url, chit_add_url, customer_get_url } from "./url/url";
import { useEffect, useState } from "react";

const emptyChit = () => ({
  chit_det: { chit_name: "", Tolal_amount: "", Due_amount: "", time_preiod: "", frequency: "none", first_due_date: "" },
  member_list: [{ name: "", member_id: "", share_id: "" }],
});

const Add_chit = () => {
  const { register, control, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm({
    defaultValues: emptyChit(),
  });
  const scheduled = watch('chit_det.frequency') !== 'none';

  const { fields, append, remove } = useFieldArray({
    control,
    name: "member_list",
  });

  const [customerList, setCustomerList] = useState([]);
  const [chitList, setChitList] = useState([]);
  const [editChitId, setEditChitId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const closeDelete = () => { if (!deleting) { setDeleteTarget(null); setDeleteError(''); } };
  const deleteChit = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setDeleteError('');
    try {
      await axios.delete(`${chit_add_url}/${deleteTarget._id}`);
      setChitList(previous => previous.filter(chit => chit._id !== deleteTarget._id));
      setNotice('Chit group deleted.'); setDeleteTarget(null);
    } catch (error) { setDeleteError(error.response?.data?.message || 'Unable to delete chit group. Please retry.'); }
    finally { setDeleting(false); }
  };

  useEffect(() => {
    fetchCustomerList();
    fetchChitList();
  }, []);

  const fetchCustomerList = async () => {
    try {
      const res = await axios.get(customer_get_url);
      setCustomerList(res.data);
    } catch (error) {
      console.error("Error fetching customer list:", error);
    }
  };

  const fetchChitList = async () => {
    try {
      const res = await axios.get(chit_get_url);
      setChitList(res.data);
    } catch (error) {
      console.error("Error fetching chit list:", error);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (editChitId !== null) {
        const response = await axios.put(`${chit_add_url}/${editChitId}`, data); // Assuming you have a proper endpoint for updating chits
        console.log("Chit updated:", response.data);

      } else {
        const response = await axios.post(chit_add_url, data);
        console.log("Chit added:", response.data);
      }
      setShowForm(false);
      setEditChitId(null);
      reset(emptyChit());
      await fetchChitList();
    } catch (error) {
      console.error("Error while submitting data:", error);
      window.alert(error.response?.data?.message || "Unable to save chit");
    }
  };

  const onEditChit = (chitToEdit) => {
    setEditChitId(chitToEdit._id);
    setShowForm(true);
    reset({
      chit_det: {
        chit_name: chitToEdit.chit_det.chit_name,
        Tolal_amount: chitToEdit.chit_det.Tolal_amount,
        Due_amount: chitToEdit.chit_det.Due_amount,
        time_preiod: chitToEdit.chit_det.time_preiod,
        frequency: chitToEdit.chit_det.frequency || 'none',
        first_due_date: chitToEdit.chit_det.first_due_date || '',
      },
      member_list: chitToEdit.member_list,
    });
  };

  const openAddForm = () => {
    setEditChitId(null);
    reset(emptyChit());
    setShowForm(true);
  };

  const closeForm = () => {
    if (isSubmitting) return;
    setShowForm(false);
    setEditChitId(null);
    reset(emptyChit());
  };

  const customerListId = (index) => `customer-list-${index}`;
  // const chitListId = (index) => `chit-list-${index}`;

  const onAddProduct = () => {
    append({ name: "", member_id: "" }); // Add member_id as well
  };

  // Function to get member_id based on name from customerList
  const getMemberId = (name) => {
    const customer = customerList.find((customer) => customer.name === name);
    return customer ? customer._id : "";
  };

  return (
    <div>
      <div className="page-toolbar compact-toolbar">
        <div>
          <h2>Chit Groups</h2>
          <p>Create groups and manage customer shares.</p>
        </div>
        <button type="button" onClick={openAddForm}>+ Add Chit</button>
      </div>
      <Modal show={showForm} onHide={closeForm} centered size="lg" className="chit-form-modal" aria-labelledby="chit-form-title" keyboard={!isSubmitting} backdrop={isSubmitting ? "static" : true}>
        <Modal.Header closeButton={!isSubmitting}>
          <Modal.Title as="h2" id="chit-form-title">{editChitId ? "Edit Chit" : "Add Chit"}</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Body>
        <p className="form-hint">Add each customer share as a separate member row.</p>
        <div className="row">
          <div className="col-6">
            <div>
              <label htmlFor="chit-name">Chit Name:</label>
              <input
                id="chit-name"
                {...register("chit_det.chit_name")}
                placeholder="Chit Name"
              />
            </div>
            <div>
              <label htmlFor="chit-total">Chit Amount:</label>
              <input
                id="chit-total"
                {...register("chit_det.Tolal_amount")}
                placeholder="Total Amount"
              />
            </div>
            <div>
              <label htmlFor="chit-due">Due Amount:</label>
              <input
                id="chit-due"
                {...register("chit_det.Due_amount")}
                placeholder="Due Amount"
              />
            </div>
            <div>
              <label htmlFor="chit-period">Total Installments:</label>
              <input
                id="chit-period"
                type="number" min="1" max={scheduled ? 1200 : undefined} step="1" required
                {...register("chit_det.time_preiod")}
                placeholder="Time Period"
              />
            </div>
            <div>
              <label htmlFor="chit-frequency">Schedule</label>
              <select id="chit-frequency" {...register('chit_det.frequency')}>
                <option value="none">Manual / No reminder</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {scheduled && <div>
              <label htmlFor="chit-first-due">First Due Date</label>
              <input id="chit-first-due" type="date" required {...register('chit_det.first_due_date')} />
              <p className="form-hint">Home reminders start one day before each installment. Create installments manually in Chit Master. Monthly dates use the last day when needed.</p>
            </div>}
          </div>

          <div className="col-6">
            <PaginatedList items={fields} label="Member entry rows">
            {(pageFields, start) => (
            <table className="member-entry-table">
              <tbody>
                {pageFields.map((item, pageIndex) => {
                  const index = start + pageIndex;
                  return (
                  <tr key={item.id}>
                    <td>
                      <input
                        {...register(`member_list.${index}.name`)}
                        placeholder="Member Name"
                        list={customerListId(index)}
                        onChange={(e) => {
                          setValue(`member_list.${index}.name`, e.target.value);
                          const memberId = getMemberId(e.target.value);
                          setValue(`member_list.${index}.member_id`, memberId);
                        }}
                      />
                      <datalist id={customerListId(index)}>
                        {customerList.map((option, optionIndex) => (
                          <option key={optionIndex} value={option.name}>
                            {option.name}
                          </option>
                        ))}
                      </datalist>
                      {/* Hidden input field for member_id */}
                      <input
                        type="hidden"
                        {...register(`member_list.${index}.member_id`)}
                      />
                      <input type="hidden" {...register(`member_list.${index}.share_id`)} />
                      <span> Share {index + 1}</span>
                    </td>
                    <td>
                      <button type="button" onClick={() => remove(index)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
            )}
            </PaginatedList>
            <button type="button" onClick={onAddProduct}>
              Add Member
            </button>
          </div>
        </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn-secondary" onClick={closeForm} disabled={isSubmitting}>Cancel</button>
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Submit"}</button>
        </Modal.Footer>
        </form>
      </Modal>

      {notice && <p role="status" className="success-notice">{notice}</p>}
      <Modal show={!!deleteTarget} onHide={closeDelete} centered className="chit-form-modal" aria-labelledby="delete-chit-title" backdrop={deleting ? 'static' : true} keyboard={!deleting}>
        <Modal.Header closeButton={!deleting}><Modal.Title as="h2" id="delete-chit-title">Delete Chit Group</Modal.Title></Modal.Header>
        <Modal.Body>
          {deleteError && <p role="alert" className="form-error">{deleteError}</p>}
          <p>Delete <strong>{deleteTarget?.chit_det.chit_name}</strong> and its {deleteTarget?.member_list.length} share memberships?</p>
          <p className="form-hint">This removes the group from Chit List and stops its schedule reminders. Customers, deleted installments and payment history are kept. Only active Chit Master records prevent deletion. Restoring an installment brings its group back.</p>
        </Modal.Body>
        <Modal.Footer><button className="btn-secondary" disabled={deleting} onClick={closeDelete}>Cancel</button><button className="btn-danger-soft" disabled={deleting} onClick={deleteChit}>{deleting ? 'Deleting...' : 'Delete Group'}</button></Modal.Footer>
      </Modal>
      {/* Display Chit List */}
      <div>
        <h2 className="compact-section-title">Chit List</h2>
        <PaginatedList footerPagination items={chitList} label="Chit groups">
        {pageChits => (
        <ResponsiveTable mobileCards={false} className="compact-list-table">
          <thead>
            <tr>
              <th>Chit Name</th>
              <th>Total Amount</th>
              <th>Due Amount</th>
              <th>Time Period</th>
              <th>Members</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageChits.map((chit) => (
              <tr key={chit._id}>
                <td>{chit.chit_det.chit_name}</td>
                <td>{chit.chit_det.Tolal_amount}</td>
                <td>{chit.chit_det.Due_amount}</td>
                <td>{chit.chit_det.time_preiod}</td>
                <td>
                  <details><summary>{chit.member_list.length} shares</summary>
                  <PaginatedList items={chit.member_list} label={`${chit.chit_det.chit_name} shares`}>
                  {(pageMembers, start) => (
                  <ul>
                    {pageMembers.map((member, memIndex) => (
                      <li key={member.share_id || memIndex}>{member.name} — Share {start + memIndex + 1}</li>
                    ))}
                  </ul>
                  )}
                  </PaginatedList>
                  </details>
                </td>
                <td>
                  <div className="table-actions"><button onClick={() => onEditChit(chit)}>Edit</button><button className="btn-danger-soft" onClick={() => { setDeleteError(''); setNotice(''); setDeleteTarget(chit); }}>Delete</button></div>
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
        )}
        </PaginatedList>
      </div>
    </div>
  );
};

export default Add_chit;
