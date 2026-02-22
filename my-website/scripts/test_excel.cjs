const ExcelJS = require('exceljs');
const fs = require('fs');
const JSZip = require('jszip');

async function test() {
    const wb = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet('Sheet1', { views: [{ rightToLeft: true, showGridLines: false }] });
    ws1.getCell('A1').value = 'Hello';

    const ws2 = wb.addWorksheet('Sheet2');
    ws2.views = [{ rightToLeft: true, showGridLines: false }];
    ws2.getCell('A1').value = 'World';

    const buf = await wb.xlsx.writeBuffer();

    const zip = await JSZip.loadAsync(buf);
    const sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const sheet2Xml = await zip.file('xl/worksheets/sheet2.xml').async('string');

    console.log('Sheet 1 views:', sheet1Xml.match(/<sheetViews>.*?<\/sheetViews>/)[0]);
    console.log('Sheet 2 views:', sheet2Xml.match(/<sheetViews>.*?<\/sheetViews>/)[0]);
}

test().catch(console.error);
