require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const {
    DB_HOST = 'localhost',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'beerclub'
  } = process.env;

  let conn;
  try {
    conn = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      multipleStatements: true
    });

    await conn.beginTransaction();

    const [cols] = await conn.query('SHOW COLUMNS FROM `users` LIKE "google_uid"');
    if (cols.length === 0) {
      await conn.query('ALTER TABLE `users` ADD COLUMN `google_uid` VARCHAR(255) UNIQUE');
      console.log('✅ Coluna google_uid adicionada');
    } else {
      console.log('ℹ️ Coluna google_uid já existe');
    }

    await conn.query('UPDATE `users` SET `google_uid` = `google_id` WHERE `google_uid` IS NULL AND `google_id` IS NOT NULL');
    console.log('✅ Backfill de google_id -> google_uid realizado');

    await conn.query('CREATE TABLE IF NOT EXISTS `SequelizeMeta` (`name` VARCHAR(255) NOT NULL, PRIMARY KEY (`name`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    const migrationName = '20251105093000-add-google-uid-to-users.js';
    const [exists] = await conn.query('SELECT `name` FROM `SequelizeMeta` WHERE `name` = ?', [migrationName]);
    if (exists.length === 0) {
      await conn.query('INSERT INTO `SequelizeMeta` (`name`) VALUES (?)', [migrationName]);
      console.log('✅ Migration registrada em SequelizeMeta');
    } else {
      console.log('ℹ️ Migration já registrada em SequelizeMeta');
    }

    await conn.commit();
    console.log('🎉 Plano B concluído com sucesso.');
    process.exit(0);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('❌ Falha no Plano B:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();