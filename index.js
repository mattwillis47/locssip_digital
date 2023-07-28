const app = require('./src/app');
const sequelize = require('./src/config/database');
const path = require('path');

sequelize.sync({ force: true });

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.listen(3000, () => console.log('app is running!!'));

app.get('/', (req, res) => {
  res.render('index', { title: 'Express' });
});
