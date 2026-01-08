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

// Cache simples para evitar chamadas excessivas ao Drive API
const folderCache = new Map();

/**
 * Encontra ou cria uma pasta dentro de um pai específico
 */
const findOrCreateFolder = async (folderName, parentId) => {
  const cacheKey = `${parentId || 'root'}/${folderName}`;
  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey);
  }

  // 1. Tentar encontrar a pasta
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  try {
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (res.data.files.length > 0) {
      const folderId = res.data.files[0].id;
      folderCache.set(cacheKey, folderId);
      return folderId;
    }

    // 2. Se não existir, criar
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      fileMetadata.parents = [parentId];
    }

    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });

    const newFolderId = folder.data.id;
    folderCache.set(cacheKey, newFolderId);
    console.log(`📂 Pasta criada: ${folderName} (ID: ${newFolderId})`);
    return newFolderId;
  } catch (error) {
    console.error(`Erro ao resolver pasta ${folderName}:`, error.message);
    throw error;
  }
};

/**
 * Resolve um caminho de pastas recursivamente (ex: 'eventos/2024/fotos')
 * Retorna o ID da última pasta.
 */
const resolveFolderPath = async (pathString) => {
  console.log(`🔍 [ResolvePath] Iniciando resolução para: "${pathString}"`);
  
  // Remove aspas que podem vir do form-data mal formatado e espaços
  const cleanPath = pathString.replace(/['"]/g, '').trim();
  
  // Se não foi passado folder ou é 'uploads' genérico, usa a raiz configurada
  if (!cleanPath || cleanPath === 'uploads') {
    console.log(`🔍 [ResolvePath] Usando raiz padrão (path vazio ou 'uploads')`);
    return process.env.GOOGLE_DRIVE_FOLDER_ID;
  }

  const parts = cleanPath.split('/').filter(p => p.trim().length > 0);
  let currentParentId = process.env.GOOGLE_DRIVE_FOLDER_ID; // Começa da raiz do projeto

  console.log(`🔍 [ResolvePath] Parts:`, parts);

  for (const part of parts) {
    console.log(`🔍 [ResolvePath] Buscando/Criando parte: "${part}" em pai: "${currentParentId}"`);
    currentParentId = await findOrCreateFolder(part, currentParentId);
    console.log(`🔍 [ResolvePath] Resultado para "${part}": ${currentParentId}`);
  }

  return currentParentId;
};

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
 * Registra logs de debug em um arquivo CSV no Google Drive (Pasta LOG)
 */
async function logDebugToDrive(logData) {
  console.log('📝 [LogRemoto] Tentando registrar log...', logData.status);
  if (!drive) {
    console.warn('⚠️ [LogRemoto] Drive não inicializado. Ignorando log.');
    return;
  }

  try {
    const LOG_FOLDER_NAME = 'LOG';
    const LOG_FILE_NAME = 'upload_debug.csv';
    
    // 1. Achar ou criar pasta LOG na raiz configurada
    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📝 [LogRemoto] Buscando pasta '${LOG_FOLDER_NAME}' dentro de: ${rootId || 'RAIZ (My Drive)'}`);
    
    // Tenta usar a pasta fornecida manualmente pelo usuário se definida, senão busca/cria
    let logFolderId = null;
    const MANUAL_LOG_ID = '1Fpt7CqX7tJbFJ_CasvLLLAXrJY_BSXZT'; // ID fixo fornecido pelo usuário

    // Tenta verificar se temos acesso à pasta manual
    try {
        await drive.files.get({ fileId: MANUAL_LOG_ID, fields: 'id' });
        console.log(`📝 [LogRemoto] Pasta LOG manual (${MANUAL_LOG_ID}) acessível. Usando ela.`);
        logFolderId = MANUAL_LOG_ID;
    } catch (e) {
        console.warn(`⚠️ [LogRemoto] Não foi possível acessar a pasta manual (${MANUAL_LOG_ID}). Motivo: ${e.message}`);
        console.log('📝 [LogRemoto] Tentando encontrar ou criar pasta LOG via findOrCreateFolder...');
        logFolderId = await findOrCreateFolder(LOG_FOLDER_NAME, rootId);
    }

    console.log(`📝 [LogRemoto] ID final da pasta LOG: ${logFolderId}`);

    // 2. Achar arquivo de log
    const query = `name = '${LOG_FILE_NAME}' and '${logFolderId}' in parents and trashed = false`;
    const res = await drive.files.list({
      q: query,
      fields: 'files(id)',
    });

    let fileId = null;
    let currentContent = 'Timestamp,RequestFolder,CleanPath,ResolvedParentId,FileName,Status,Message\n';

    if (res.data.files.length > 0) {
      fileId = res.data.files[0].id;
      console.log(`📝 [LogRemoto] Arquivo de log encontrado: ${fileId}. Baixando conteúdo...`);
      // Baixar conteúdo atual
      try {
        const file = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        
        // Ler stream para string
        const chunks = [];
        for await (const chunk of file.data) {
          chunks.push(chunk);
        }
        currentContent = Buffer.concat(chunks).toString('utf-8');
      } catch (err) {
        console.warn('⚠️ [LogRemoto] Erro ao ler log existente, criando novo conteúdo.', err.message);
      }
    } else {
        console.log(`📝 [LogRemoto] Arquivo de log não encontrado. Criando novo.`);
    }

    // 3. Adicionar nova linha
    const timestamp = new Date().toISOString();
    const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    
    const newRow = [
      timestamp,
      logData.requestFolder,
      logData.cleanPath,
      logData.resolvedParentId,
      logData.fileName,
      logData.status,
      logData.message
    ].map(escapeCsv).join(',') + '\n';

    const newContent = currentContent + newRow;

    // 4. Atualizar ou Criar arquivo
    const media = {
      mimeType: 'text/csv',
      body: newContent
    };

    if (fileId) {
      await drive.files.update({
        fileId,
        media,
      });
      console.log('✅ [LogRemoto] Arquivo atualizado com sucesso.');
    } else {
      const created = await drive.files.create({
        resource: {
          name: LOG_FILE_NAME,
          parents: [logFolderId]
        },
        media,
        fields: 'id'
      });
      console.log(`✅ [LogRemoto] Arquivo criado com sucesso. ID: ${created.data.id}`);
    }

  } catch (error) {
    console.error('❌ [LogRemoto] FALHA CRÍTICA:', error.message);
    if (error.response && error.response.data) {
        console.error('❌ [LogRemoto] Detalhes do erro API:', JSON.stringify(error.response.data, null, 2));
    }
  }
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

  let parentFolderId = null;
  let cleanPath = '';

  try {
    // Resolve a estrutura de pastas dinamicamente
    cleanPath = folderName ? folderName.replace(/['"]/g, '').trim() : '';
    parentFolderId = await resolveFolderPath(folderName);

    const fileMetadata = {
      name: `${Date.now()}_${fileObject.originalname}`,
    };

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const { data } = await drive.files.create({
      resource: fileMetadata,
      media: {
        mimeType: fileObject.mimetype,
        body: bufferStream,
      },
      fields: 'id, name, webViewLink, webContentLink',
    });

    // Tornar o arquivo público (Restaurado)
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

    // Log Sucesso
    logDebugToDrive({
        requestFolder: folderName,
        cleanPath,
        resolvedParentId: parentFolderId,
        fileName: fileObject.originalname,
        status: 'SUCCESS',
        message: `File ID: ${data.id}`
    });

    return data;
  } catch (error) {
    // Log Erro
    logDebugToDrive({
        requestFolder: folderName,
        cleanPath,
        resolvedParentId: parentFolderId,
        fileName: fileObject.originalname,
        status: 'ERROR',
        message: error.message
    });
    throw error;
  }
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
