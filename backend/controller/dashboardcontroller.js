const { Customer, Chit, Due } = require('../model/models');
const dashboard = require('../utils/dashboard');

exports.getDashboard = async (req, res) => {
  const [customers, chits, dues] = await Promise.all([Customer.find().lean(), Chit.find({ deletedAt: null }).lean(), Due.find().lean()]);
  res.json(dashboard({ customers, chits, dues }));
};
