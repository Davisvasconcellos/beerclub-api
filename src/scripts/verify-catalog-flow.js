
const express = require('express');
const { sequelize } = require('../config/database');
const request = require('supertest');

// Mock middleware
const mockAuth = {
  authenticateToken: (req, res, next) => {
    req.user = { userId: 1, role: 'admin' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
  requireModule: () => (req, res, next) => next()
};

// Override require cache for auth middleware
require.cache[require.resolve('../middlewares/auth')] = {
  exports: mockAuth
};

// Now require the route (it will use the mocked middleware)
const musicCatalogRoutes = require('../routes/musicCatalog');
const { EventJamMusicCatalog } = require('../models');

const app = express();
app.use(express.json());
app.use('/api/v1/music-catalog', musicCatalogRoutes);

async function verifyCatalogFlow() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Clear existing catalog entries for test
    console.log('Clearing catalog for test...');
    await EventJamMusicCatalog.destroy({ where: { title: { [require('sequelize').Op.like]: '%Mock%' } } });

    // 2. Search for "Beatles" (should trigger mock Discogs service)
    console.log('Searching for "Beatles"...');
    const response = await request(app).get('/api/v1/music-catalog/search?q=Beatles');

    if (response.status !== 200) {
      console.error('Error:', response.body);
      throw new Error(`Status code ${response.status}`);
    }

    console.log(`Received ${response.body.length} results.`);
    
    // 3. Verify results contain mock data
    const mockResult = response.body.find(r => r.title.includes('(Mock Song)'));
    if (mockResult) {
      console.log('SUCCESS: Found mock result in response:', mockResult.title);
    } else {
      console.error('FAILURE: Mock result not found in response.');
    }

    // 4. Verify DB has new entries
    const dbCount = await EventJamMusicCatalog.count({
      where: { title: { [require('sequelize').Op.like]: '%Beatles%' } }
    });
    console.log(`Database now has ${dbCount} entries for "Beatles".`);

    if (dbCount > 0) {
      console.log('SUCCESS: Bulk insert worked.');
    } else {
      console.error('FAILURE: No entries found in DB.');
    }

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await sequelize.close();
  }
}

verifyCatalogFlow();
