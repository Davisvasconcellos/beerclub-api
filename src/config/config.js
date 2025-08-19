const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
module.exports = {
development: {
username: process.env.DB_USER || 'root',
password: process.env.DB_PASSWORD || '',
database: process.env.DB_NAME || 'beerclub',
host: process.env.DB_HOST || 'localhost',
port: process.env.DB_PORT || 3306,
dialect: 'mysql',
logging: process.env.NODE_ENV === 'development' ? console.log : false,
dialectOptions: {
charset: 'utf8mb4'
}
},
test: {
username: process.env.DB_USER || 'root',
password: process.env.DB_PASSWORD || '',
database: process.env.DB_NAME || 'beerclub_test',
host: process.env.DB_HOST || 'localhost',
port: process.env.DB_PORT || 3306,
dialect: 'mysql',
logging: false,
dialectOptions: {
charset: 'utf8mb4'
}
},
production: {
username: process.env.DB_USER,
password: process.env.DB_PASSWORD,
database: process.env.DB_NAME,
host: process.env.DB_HOST,
port: process.env.DB_PORT || 3306,
dialect: 'mysql',
logging: false,
dialectOptions: {
charset: 'utf8mb4'
}
}
};