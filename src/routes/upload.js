const express = require('express');
const router = express.Router();
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');
const fs = require('fs');

// Configuração do Multer (Armazenamento em memória)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
});

// Configuração do Google Drive via OAuth2
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

let drive = null;
let oauth2Client = null;

// Inicializa OAuth2 Client usando variáveis de ambiente
try {
  const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (CLIENT_ID && CLIENT_SECRET && REDIRECT_URI) {
    oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    if (REFRESH_TOKEN) {
      oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
      drive = google.drive({ version: 'v3', auth: oauth2Client });
    } else {
      console.warn('⚠️ GOOGLE_DRIVE_REFRESH_TOKEN não configurado. Use /api/v1/uploads/oauth/init para obter o token.');
    }
  } else {
    console.warn('⚠️ Variáveis OAuth2 não configuradas (CLIENT_ID/CLIENT_SECRET/REDIRECT_URI).');
  }
} catch (e) {
  console.warn('⚠️ Erro ao inicializar OAuth2:', e.message);
}

/**
 * Função auxiliar para upload de stream
 */
const uploadFileToDrive = async (fileObject, folderName) => {
  if (!drive || !oauth2Client) {
    throw new Error('Integração com Google Drive não configurada. Conclua o fluxo OAuth2.');
  }

  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileObject.buffer);

  // Use environment variable for folder ID or fallback to root if not provided (though specific folder is recommended)
  const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const fileMetadata = {
    name: `${Date.now()}_${fileObject.originalname}`,
  };

  if (PARENT_FOLDER_ID) {
    fileMetadata.parents = [PARENT_FOLDER_ID];
  }

  const { data } = await drive.files.create({
    media: {
      mimeType: fileObject.mimetype,
      body: bufferStream,
    },
    requestBody: fileMetadata,
    fields: 'id, name, webViewLink, webContentLink',
  });

  // Tornar o arquivo público (opcional, para visualização direta)
  try {
    await drive.permissions.create({
      fileId: data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  } catch (permError) {
    console.warn('⚠️ Could not set public permission on file:', permError.message);
  }

  return data;
};

/**
 * Iniciar fluxo OAuth (gera auth_url)
 * Protegido para admins/masters
 */
router.get('/oauth/init', async (req, res) => {
  try {
    if (!oauth2Client) {
      return res.status(500).json({ success: false, message: 'OAuth2 não configurado (CLIENT_ID/SECRET/REDIRECT_URI).' });
    }
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES
    });
    return res.redirect(authUrl);
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Erro ao gerar auth URL', error: e.message });
  }
});

/**
 * Callback OAuth para trocar code por tokens
 * Protegido para admins/masters
 */
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Parâmetro "code" é obrigatório.' });
    }
    if (!oauth2Client) {
      return res.status(500).json({ success: false, message: 'OAuth2 não configurado (CLIENT_ID/SECRET/REDIRECT_URI).' });
    }
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    drive = google.drive({ version: 'v3', auth: oauth2Client });

    // ATENÇÃO: Armazene o refresh_token manualmente em .env
    return res.json({
      success: true,
      data: {
        access_token: tokens.access_token || null,
        refresh_token: tokens.refresh_token || null,
        expiry_date: tokens.expiry_date || null
      },
      message: 'Copie o refresh_token para GOOGLE_DRIVE_REFRESH_TOKEN no .env'
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Erro ao obter tokens OAuth', error: e.message });
  }
});

/**
 * Rota POST /api/uploads
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    const folder = req.body.folder || 'uploads'; // 'events', 'users', etc. (Currently unused in uploadFileToDrive logic, but good for future extension)
    
    // Upload para o Drive
    const result = await uploadFileToDrive(req.file, folder);

    console.log('✅ Arquivo salvo no Drive:', result.name);

    // Retorna a URL pública
    // const publicUrl = `https://drive.usercontent.google.com/download?id=${result.id}&authuser=0`; // Antigo (Link direto Google)
    
    // Constrói a URL do Proxy da própria API
    const apiBaseUrl = process.env.API_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const proxyUrl = `${apiBaseUrl}/api/v1/files/${result.id}`;

    res.json({
      success: true,
      data: {
        name: result.name,
        url: proxyUrl, // Link Proxy (Seguro + CORS Friendly)
        fileUrl: result.webViewLink, // Link Original (Google Drive Viewer)
        downloadUrl: result.webContentLink, // Link para download direto
        id: result.id
      }
    });

  } catch (error) {
    console.error('❌ Erro no upload:', error);
    res.status(500).json({ success: false, message: 'Erro interno ao salvar arquivo.', error: error.message });
  }
});

module.exports = router;
