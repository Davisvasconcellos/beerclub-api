const { sequelize } = require('../config/database');
const { User, Plan } = require('../models');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    // Sincronizar modelos com o banco
    await sequelize.sync({ force: true });
    console.log('✅ Database synchronized');

    // Criar planos
    const plans = await Plan.bulkCreate([
      {
        name: 'Free',
        description: 'Plano gratuito com funcionalidades básicas',
        price: 0,
        features: JSON.stringify(['pedidos_básicos', '1_loja'])
      },
      {
        name: 'Premium',
        description: 'Plano premium com funcionalidades avançadas',
        price: 99.90,
        features: JSON.stringify(['pedidos_ilimitados', 'múltiplas_lojas', 'relatórios', 'suporte_prioritário'])
      }
    ]);
    console.log('✅ Plans created');

    // Criar usuários de teste
    const users = await User.bulkCreate([
      {
        name: 'Master Admin',
        email: 'master@meufood.com',
        password_hash: await bcrypt.hash('123456', 12),
        role: 'admin'
      },
      {
        name: 'Admin',
        email: 'admin@meufood.com',
        password_hash: await bcrypt.hash('123456', 12),
        role: 'admin'
      },
      {
        name: 'Gerente',
        email: 'gerente@meufood.com',
        password_hash: await bcrypt.hash('123456', 12),
        role: 'manager'
      },
      {
        name: 'Garçom',
        email: 'garcom@meufood.com',
        password_hash: await bcrypt.hash('123456', 12),
        role: 'waiter'
      },
      {
        name: 'Cliente',
        email: 'cliente@meufood.com',
        password_hash: await bcrypt.hash('123456', 12),
        role: 'customer'
      }
    ]);
    console.log('✅ Users created');

    console.log('🎉 Database initialized successfully!');
    console.log('\nTest users:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.role})`);
    });

  } catch (error) {
    console.error('❌ Error initializing database:', error);
  } finally {
    await sequelize.close();
  }
}

initDatabase(); 