module.exports = (error, req, res, next) => {
  const status = error.status || (error.code === 11000 ? 409 : ['ValidationError', 'CastError'].includes(error.name) ? 400 : 500);
  res.status(status).json({ message: error.code === 11000 ? 'This due list already exists. Check Active and Deleted Records. Restore it, or permanently delete an unpaid deleted record before recreating it.' : status === 500 ? 'Internal server error' : error.message });
  if (status === 500) console.error(error);
};
