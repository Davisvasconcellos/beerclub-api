require('dotenv').config();
const bcrypt = require('bcryptjs');
const { 
  sequelize, 
  Plan, 
  Store, 
  User, 
  StoreUser, 
  Product 
} = require('../models');

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Sync database
    await sequelize.sync({ force: false });
    console.log('✅ Database synchronized');

    // Create Plans
    console.log('📋 Creating plans...');
    const plans = await Plan.bulkCreate([
      {
        name: 'Basic',
        description: 'Plano básico com desconto de 5%',
        price: 29.90
      },
      {
        name: 'Premium',
        description: 'Plano premium com desconto de 10%',
        price: 49.90
      },
      {
        name: 'Gold',
        description: 'Plano gold com desconto de 15%',
        price: 79.90
      }
    ], { ignoreDuplicates: true });
    console.log(`✅ Created ${plans.length} plans`);

    // Create Stores
    console.log('🏪 Creating stores...');
    const stores = await Store.bulkCreate([
      {
        name: 'Bar do João',
        legal_responsible: 'João Silva',
        email: 'joao@bardojoao.com',
        cnpj: '12.345.678/0001-90',
        logo_url: 'https://example.com/logo1.jpg',
        instagram_handle: '@bardojoao',
        facebook_handle: 'bardojoao'
      },
      {
        name: 'Cervejaria Artesanal',
        legal_responsible: 'Maria Santos',
        email: 'maria@cervejaria.com',
        cnpj: '98.765.432/0001-10',
        logo_url: 'https://example.com/logo2.jpg',
        instagram_handle: '@cervejariaartesanal',
        facebook_handle: 'cervejariaartesanal'
      },
      {
        name: 'Pub Irlandês',
        legal_responsible: 'Pedro O\'Connor',
        email: 'pedro@pubirlandes.com',
        cnpj: '11.222.333/0001-44',
        logo_url: 'https://example.com/logo3.jpg',
        instagram_handle: '@pubirlandes',
        facebook_handle: 'pubirlandes'
      }
    ], { ignoreDuplicates: true });
    console.log(`✅ Created ${stores.length} stores`);

    // Hash password
    const hashedPassword = await bcrypt.hash('123456', 12);

    // Create Users
    console.log('👥 Creating users...');
    const users = await User.bulkCreate([
      {
        name: 'Admin Master',
        email: 'admin@beerclub.com',
        phone: '(11) 99999-9999',
        password_hash: hashedPassword,
        role: 'admin',
        plan_id: 3,
        plan_start: '2024-01-01',
        plan_end: '2024-12-31'
      },
      {
        name: 'João Silva',
        email: 'joao@bardojoao.com',
        phone: '(11) 88888-8888',
        password_hash: hashedPassword,
        role: 'manager',
        plan_id: 2,
        plan_start: '2024-01-01',
        plan_end: '2024-12-31'
      },
      {
        name: 'Maria Santos',
        email: 'maria@cervejaria.com',
        phone: '(11) 77777-7777',
        password_hash: hashedPassword,
        role: 'manager',
        plan_id: 2,
        plan_start: '2024-01-01',
        plan_end: '2024-12-31'
      },
      {
        name: 'Pedro O\'Connor',
        email: 'pedro@pubirlandes.com',
        phone: '(11) 66666-6666',
        password_hash: hashedPassword,
        role: 'manager',
        plan_id: 1,
        plan_start: '2024-01-01',
        plan_end: '2024-12-31'
      },
      {
        name: 'Garçom 1',
        email: 'garcom1@bardojoao.com',
        phone: '(11) 55555-5555',
        password_hash: hashedPassword,
        role: 'waiter'
      },
      {
        name: 'Garçom 2',
        email: 'garcom2@cervejaria.com',
        phone: '(11) 44444-4444',
        password_hash: hashedPassword,
        role: 'waiter'
      },
      {
        name: 'Cliente 1',
        email: 'cliente1@email.com',
        phone: '(11) 33333-3333',
        password_hash: hashedPassword,
        role: 'customer',
        plan_id: 2,
        plan_start: '2024-01-01',
        plan_end: '2024-12-31'
      },
      {
        name: 'Cliente 2',
        email: 'cliente2@email.com',
        phone: '(11) 22222-2222',
        password_hash: hashedPassword,
        role: 'customer',
        plan_id: 1,
        plan_start: '2024-01-01',
        plan_end: '2024-12-31'
      }
    ], { ignoreDuplicates: true });
    console.log(`✅ Created ${users.length} users`);

    // Create Store Users relationships
    console.log('🔗 Creating store users relationships...');
    const storeUsers = await StoreUser.bulkCreate([
      { user_id: 2, store_id: 1, role: 'admin' },    // João é admin do Bar do João
      { user_id: 3, store_id: 2, role: 'admin' },    // Maria é admin da Cervejaria
      { user_id: 4, store_id: 3, role: 'admin' },    // Pedro é admin do Pub Irlandês
      { user_id: 5, store_id: 1, role: 'waiter' },   // Garçom 1 trabalha no Bar do João
      { user_id: 6, store_id: 2, role: 'waiter' }    // Garçom 2 trabalha na Cervejaria
    ], { ignoreDuplicates: true });
    console.log(`✅ Created ${storeUsers.length} store users relationships`);

    // Create Products
    console.log('🍺 Creating products...');
    const products = await Product.bulkCreate([
      // Bar do João
      {
        store_id: 1,
        name: 'Chopp Brahma',
        description: 'Chopp Brahma 300ml',
        image_url: 'https://example.com/chopp-brahma.jpg',
        normal_price: 8.00,
        price_plan_1: 7.60,
        price_plan_2: 7.20,
        price_plan_3: 6.80,
        stock: 50
      },
      {
        store_id: 1,
        name: 'Chopp Heineken',
        description: 'Chopp Heineken 300ml',
        image_url: 'https://example.com/chopp-heineken.jpg',
        normal_price: 12.00,
        price_plan_1: 11.40,
        price_plan_2: 10.80,
        price_plan_3: 10.20,
        stock: 30
      },
      {
        store_id: 1,
        name: 'Porção de Fritas',
        description: 'Porção de batatas fritas',
        image_url: 'https://example.com/fritas.jpg',
        normal_price: 22.00,
        price_plan_1: 20.90,
        price_plan_2: 19.80,
        price_plan_3: 18.70,
        stock: 20
      },
      {
        store_id: 1,
        name: 'Porção de Calabresa',
        description: 'Porção de calabresa acebolada',
        image_url: 'https://example.com/calabresa.jpg',
        normal_price: 28.00,
        price_plan_1: 26.60,
        price_plan_2: 25.20,
        price_plan_3: 23.80,
        stock: 15
      },

      // Cervejaria Artesanal
      {
        store_id: 2,
        name: 'IPA Artesanal',
        description: 'India Pale Ale artesanal',
        image_url: 'https://example.com/ipa.jpg',
        normal_price: 18.00,
        price_plan_1: 17.10,
        price_plan_2: 16.20,
        price_plan_3: 15.30,
        stock: 25
      },
      {
        store_id: 2,
        name: 'Stout Artesanal',
        description: 'Stout artesanal',
        image_url: 'https://example.com/stout.jpg',
        normal_price: 20.00,
        price_plan_1: 19.00,
        price_plan_2: 18.00,
        price_plan_3: 17.00,
        stock: 20
      },
      {
        store_id: 2,
        name: 'Pilsen Artesanal',
        description: 'Pilsen artesanal',
        image_url: 'https://example.com/pilsen.jpg',
        normal_price: 16.00,
        price_plan_1: 15.20,
        price_plan_2: 14.40,
        price_plan_3: 13.60,
        stock: 30
      },
      {
        store_id: 2,
        name: 'Combo Petisco',
        description: 'Combo com porção + cerveja',
        image_url: 'https://example.com/combo.jpg',
        normal_price: 35.00,
        price_plan_1: 33.25,
        price_plan_2: 31.50,
        price_plan_3: 29.75,
        stock: 10
      },

      // Pub Irlandês
      {
        store_id: 3,
        name: 'Guinness',
        description: 'Guinness 500ml',
        image_url: 'https://example.com/guinness.jpg',
        normal_price: 25.00,
        price_plan_1: 23.75,
        price_plan_2: 22.50,
        price_plan_3: 21.25,
        stock: 20
      },
      {
        store_id: 3,
        name: 'Whisky Jameson',
        description: 'Jameson Irish Whisky',
        image_url: 'https://example.com/jameson.jpg',
        normal_price: 35.00,
        price_plan_1: 33.25,
        price_plan_2: 31.50,
        price_plan_3: 29.75,
        stock: 15
      },
      {
        store_id: 3,
        name: 'Fish & Chips',
        description: 'Fish & Chips tradicional',
        image_url: 'https://example.com/fish-chips.jpg',
        normal_price: 45.00,
        price_plan_1: 42.75,
        price_plan_2: 40.50,
        price_plan_3: 38.25,
        stock: 8
      },
      {
        store_id: 3,
        name: 'Shepherd\'s Pie',
        description: 'Shepherd\'s Pie caseiro',
        image_url: 'https://example.com/shepherds-pie.jpg',
        normal_price: 38.00,
        price_plan_1: 36.10,
        price_plan_2: 34.20,
        price_plan_3: 32.30,
        stock: 12
      }
    ], { ignoreDuplicates: true });
    console.log(`✅ Created ${products.length} products`);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- ${plans.length} plans created`);
    console.log(`- ${stores.length} stores created`);
    console.log(`- ${users.length} users created`);
    console.log(`- ${storeUsers.length} store users relationships created`);
    console.log(`- ${products.length} products created`);

    console.log('\n🔐 Test Credentials:');
    console.log('Admin: admin@beerclub.com / 123456');
    console.log('Manager: joao@bardojoao.com / 123456');
    console.log('Customer: cliente1@email.com / 123456');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase(); 