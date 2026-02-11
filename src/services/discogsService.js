
const axios = require('axios');

// Placeholder for Discogs integration
// In the future, this should use the user's Discogs API Key/Secret from environment variables
// e.g., process.env.DISCOGS_CONSUMER_KEY, process.env.DISCOGS_CONSUMER_SECRET

class DiscogsService {
  constructor() {
    this.baseUrl = 'https://api.discogs.com';
    this.userAgent = 'BeerClubApp/1.0';
    // Use mock mode if keys are not present in environment
    this.mockMode = !process.env.DISCOGS_CONSUMER_KEY || !process.env.DISCOGS_CONSUMER_SECRET;
    if (process.env.NODE_ENV === 'test' || process.env.MOCK_DISCOGS === 'true') {
        this.mockMode = true;
    }
  }

  async search(query) {
    if (this.mockMode) {
      console.log(`[DiscogsService] Searching (Mock): ${query}`);
      // Return dummy results to verify the Bulk Insert flow
      return [
        {
          id: Math.floor(Math.random() * 100000) + 1, // Simulate random Discogs ID
          title: `${query} (Mock Song)`,
          artist: 'Mock Artist',
          album: 'Mock Album',
          year: '2024',
          genre: 'Rock',
          cover_image: 'https://placehold.co/600x600?text=Cover',
          thumb: 'https://placehold.co/150x150?text=Thumb',
          resource_url: 'http://mock-api.discogs.com/release/123'
        },
        {
          id: Math.floor(Math.random() * 100000) + 1,
          title: `Another ${query}`,
          artist: 'Mock Band',
          album: 'Greatest Hits',
          year: '2023',
          genre: 'Pop',
          cover_image: 'https://placehold.co/600x600?text=Cover2',
          thumb: 'https://placehold.co/150x150?text=Thumb2',
          resource_url: 'http://mock-api.discogs.com/release/456'
        }
      ];
    }

    // Real implementation (to be enabled when keys are provided)
    try {
      const response = await axios.get(`${this.baseUrl}/database/search`, {
        params: {
          q: query,
          type: 'release', // or 'master'
          key: process.env.DISCOGS_CONSUMER_KEY,
          secret: process.env.DISCOGS_CONSUMER_SECRET,
          per_page: 10
        },
        headers: {
          'User-Agent': this.userAgent
        }
      });

      return response.data.results.map(item => ({
        id: item.id,
        title: item.title, // Discogs returns "Artist - Title" often, needs parsing if strictly separated
        artist: item.title.split(' - ')[0] || 'Unknown',
        album: item.title.split(' - ')[1] || item.title,
        year: item.year,
        genre: item.genre ? item.genre[0] : null,
        cover_image: item.cover_image,
        thumb: item.thumb,
        resource_url: item.resource_url
      }));

    } catch (error) {
      console.error('[DiscogsService] Error:', error.message);
      return [];
    }
  }
}

module.exports = new DiscogsService();
