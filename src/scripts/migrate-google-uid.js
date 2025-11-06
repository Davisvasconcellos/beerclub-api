require('dotenv').config();
const { sequelize } = require('../config/database');

async function migrateGoogleUid() {
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query('ALTER TABLE users ADD COLUMN google_uid VARCHAR(255) UNIQUE', { transaction });
    await sequelize.query('UPDATE users SET google_uid = google_id WHERE google_uid IS NULL AND google_id IS NOT NULL', { transaction });

    // Marca a migration como executada na tabela SequelizeMeta para manter o histórico
    await sequelize.query(
      `INSERT INTO SequelizeMeta (name) VALUES ('20251105093000-add-google-uid-to-users.js')`,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ Migration google_uid aplicada com sucesso e registrada em SequelizeMeta');
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Falha ao aplicar migration google_uid:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrateGoogleUid();