require('dotenv').config();
const { google } = require('googleapis');

async function testDownload() {
  const FILE_ID = '1VLCZ5AC0rUT9VPY9tJNxBLVpK7VZDBd2'; // ID fornecido pelo usuário

  console.log('--- Iniciando Diagnóstico do Drive ---');
  console.log('CLIENT_ID:', process.env.GOOGLE_DRIVE_CLIENT_ID ? 'OK' : 'MISSING');
  console.log('REFRESH_TOKEN:', process.env.GOOGLE_DRIVE_REFRESH_TOKEN ? 'OK' : 'MISSING');

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI
  );

  auth.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });

  const drive = google.drive({ version: 'v3', auth });

  try {
    console.log(`Tentando acessar arquivo: ${FILE_ID}`);
    
    // Teste 1: Metadados
    const meta = await drive.files.get({ fileId: FILE_ID, fields: 'id, name, mimeType' });
    console.log('✅ Metadados OK:', meta.data);

    // Teste 2: Stream
    console.log('Tentando baixar stream...');
    const res = await drive.files.get({ fileId: FILE_ID, alt: 'media' }, { responseType: 'stream' });
    
    console.log('✅ Stream iniciado com sucesso via Google API');
    console.log('Status:', res.status);
    console.log('Headers:', res.headers['content-type']);

  } catch (error) {
    console.error('❌ ERRO FATAL:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    console.error('Full Error:', error);
  }
}

testDownload();
