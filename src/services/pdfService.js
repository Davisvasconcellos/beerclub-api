const puppeteer = require('puppeteer');

class PdfService {
  /**
   * Generates a PDF from HTML content
   * @param {string} htmlContent - The HTML string to render
   * @param {object} options - Puppeteer PDF options (format, margin, etc.)
   * @returns {Promise<Buffer>} - The generated PDF buffer
   */
  async generatePdf(htmlContent, options = {}) {
    let browser;
    try {
      console.log('[PdfService] Launching browser...');
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: 'new'
      });
      
      const page = await browser.newPage();
      console.log('[PdfService] Setting content...');
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      console.log('[PdfService] Generating PDF...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          bottom: '20px',
          left: '20px',
          right: '20px'
        },
        ...options
      });

      console.log('[PdfService] PDF generated successfully.');
      return pdfBuffer;
    } catch (error) {
      console.error('[PdfService] Error generating PDF:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = new PdfService();
