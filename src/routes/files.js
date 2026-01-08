const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

// Configuração do Google Drive via OAuth2 (Replicada de upload.js)
let drive = null;

try {
  const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (CLIENT_ID && CLIENT_SECRET && REDIRECT_URI && REFRESH_TOKEN) {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    drive = google.drive({ version: 'v3', auth: oauth2Client });
  } else {
    console.warn('⚠️ [Files Route] OAuth2 não configurado completamente.');
  }
} catch (e) {
  console.warn('⚠️ [Files Route] Erro ao inicializar OAuth2:', e.message);
}

/**
 * Rota GET /api/v1/files/:id
 * Endpoint genérico para visualização de arquivos (Imagens, PDF, etc)
 * Atua como Proxy Reverso evitando CORS e expondo apenas o stream
 */
router.get('/:id', async (req, res) => {
  console.log('🚀 [Files Proxy] Rota acessada para ID:', req.params.id); // LOG INICIAL
  try {
    const fileId = req.params.id;

    if (!drive) {
      console.error('❌ [Files Proxy] Drive não configurado');
      return res.status(500).json({ success: false, message: 'Serviço de arquivos indisponível (Drive não configurado).' });
    }

    // 1. Primeiro busca os metadados para saber o MIME Type correto e Nome
    const metadata = await drive.files.get({
      fileId,
      fields: 'name, mimeType, size'
    });

    let mimeType = metadata.data.mimeType;
    const fileName = metadata.data.name;

    console.log(`📂 [Files Proxy] Arquivo: ${fileName}, MIME Original: ${mimeType}`);

    // Correção: Se o Google retornar octet-stream, tentamos deduzir pela extensão
    if (mimeType === 'application/octet-stream' || !mimeType) {
      const ext = fileName.split('.').pop().toLowerCase();
      const mimeMap = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'txt': 'text/plain'
      };
      if (mimeMap[ext]) {
        mimeType = mimeMap[ext];
        console.log(`✨ [Files Proxy] MIME Corrigido para: ${mimeType}`);
      }
    }

    // 2. Obtém o stream do conteúdo
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Configura Headers para Exibição Inline (Browser)
    res.setHeader('Content-Type', mimeType);
    
    // Simplificando Content-Disposition para forçar inline sem ambiguidade de nome
    res.setHeader('Content-Disposition', 'inline');
    
    // Headers de Segurança para permitir carregamento Cross-Origin (CRUCIAL PARA O ERRO)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // DESATIVAR CACHE TEMPORARIAMENTE PARA DEBUG
    // O erro persiste porque o navegador guardou a versão antiga (com bloqueio) no cache por 1 ano.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    console.log(`✅ [Files Proxy] Enviando headers: Content-Type=${mimeType}, Content-Disposition=inline`);

    // Pipe do stream do Google direto para a resposta da API
    response.data
      .on('end', () => {
        // Stream finalizado
      })
      .on('error', (err) => {
        console.error(`Erro no stream do arquivo ${fileId}:`, err.message);
        if (!res.headersSent) {
          res.status(500).send('Erro ao processar arquivo.');
        }
      })
      .pipe(res);

  } catch (error) {
    console.error(`Erro ao buscar arquivo ${req.params.id}:`, error.message);
    if (!res.headersSent) {
      // 404 para não encontrado ou 403 para sem permissão
      res.status(404).json({ success: false, message: 'Arquivo não encontrado ou inacessível.' });
    }
  }
});

module.exports = router;
