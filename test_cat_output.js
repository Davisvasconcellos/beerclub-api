const { sequelize } = require('./src/config/database');
const FinCategory = require('./src/models/FinCategory');

async function test() {
  try {
    // Sync purely to ensure we can run queries (assumes migrations are done)
    // await sequelize.sync(); 

    const cat = await FinCategory.create({
      store_id: 'store-123',
      name: 'Test Cat',
      type: 'payable'
    });

    console.log('Created raw:', cat.toJSON());

    const fetched = await FinCategory.findAll({
      attributes: { exclude: ['id'] }
    });

    console.log('Fetched JSON:', JSON.parse(JSON.stringify(fetched)));

  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

test();
