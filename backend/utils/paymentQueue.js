// Serialize receipt writes and installment edits/deletions in this local API process.
// Customer version checks still protect competing receipt writes at database level.
let pending = Promise.resolve();
module.exports = function exclusive(operation) {
  const result = pending.then(operation);
  pending = result.catch(() => {});
  return result;
};
