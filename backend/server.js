require('dotenv').config({ path: require('path').join(__dirname, 'config/config.env') });
const app = require('./app');
require('./config/database')().then(() => {
  return require('./bootstrapAdmin')();
}).then(() => {
  app.listen(process.env.PORT || 5001, process.env.HOST || '127.0.0.1', () => console.log('Chit API listening on port ' + (process.env.PORT || 5001)));
}).catch(error => { console.error('Startup failed:', error.message); process.exitCode = 1; });
