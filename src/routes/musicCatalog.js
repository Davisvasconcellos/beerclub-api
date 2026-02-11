const express = require('express');
const router = express.Router();
const { EventJamMusicCatalog } = require('../models');
const { Op } = require('sequelize');
const { authenticateToken } = require('../middlewares/auth');
const discogsService = require('../services/discogsService');

/**
 * GET /api/v1/music-catalog/search
 * Busca músicas no catálogo local e no Discogs (com cache automático)
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    console.log(`[MusicCatalog] Buscando por: "${q}"`);

    // 1. Busca Local
    const localResults = await EventJamMusicCatalog.findAll({
      where: {
        [Op.or]: [
          { title: { [Op.like]: `%${q}%` } },
          { artist: { [Op.like]: `%${q}%` } }
        ]
      },
      limit: 20,
      order: [['usage_count', 'DESC']] // Prioriza as mais usadas
    });

    console.log(`[MusicCatalog] Encontrados ${localResults.length} resultados locais.`);

    // 2. Se tivermos poucos resultados locais, buscamos no Discogs
    // (Por enquanto, vamos simular que buscamos sempre para testar o fluxo de inserção, 
    // mas na prática podemos limitar para economizar API)
    let externalResults = [];
    try {
        externalResults = await discogsService.search(q);
    } catch (err) {
        console.error('[MusicCatalog] Erro ao buscar no Discogs:', err.message);
        // Não falha a requisição, apenas segue com o que tem local
    }

    // 3. Processamento dos Resultados Externos (Bulk Insert)
    if (externalResults.length > 0) {
      const newEntries = [];
      
      // Verifica quais já existem no banco (pelo discogs_id)
      const existingDiscogsIds = await EventJamMusicCatalog.findAll({
        where: {
          discogs_id: externalResults.map(r => r.id)
        },
        attributes: ['discogs_id']
      }).then(rows => rows.map(r => r.discogs_id));

      for (const result of externalResults) {
        if (!existingDiscogsIds.includes(result.id)) {
          newEntries.push({
            discogs_id: result.id,
            title: result.title,
            artist: result.artist, // Discogs retorna "Artist - Title" as vezes, precisa tratar
            cover_image: result.cover_image,
            thumb_image: result.thumb,
            year: result.year,
            genre: result.genre ? result.genre[0] : null,
            extra_data: result, // Guarda o payload bruto
            usage_count: 0 // Começa com 0 até alguém escolher
          });
        }
      }

      if (newEntries.length > 0) {
        console.log(`[MusicCatalog] Inserindo ${newEntries.length} novas músicas do Discogs no catálogo local.`);
        await EventJamMusicCatalog.bulkCreate(newEntries);
        
        // Opcional: Buscar novamente para retornar a lista completa e ordenada/padronizada do banco
        // Isso garante que o frontend sempre receba objetos com a mesma estrutura (do nosso Model)
        return res.json(await EventJamMusicCatalog.findAll({
            where: {
                [Op.or]: [
                  { title: { [Op.like]: `%${q}%` } },
                  { artist: { [Op.like]: `%${q}%` } }
                ]
            },
            limit: 50,
            order: [['usage_count', 'DESC'], ['title', 'ASC']]
        }));
      }
    }

    // Se não teve novidades externas, retorna o local
    return res.json(localResults);

  } catch (error) {
    console.error('Erro ao buscar no catálogo:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

module.exports = router;
