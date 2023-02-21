const express = require('express');
const multer = require('multer');
const csv = require('csvtojson');
const XLSX = require('xlsx');
const Canvas = require('canvas');
const fs = require('fs');
const { promisify } = require('util');

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const app = express();

// Set up multer to handle file uploads
const upload = multer({ dest: 'uploads/' });

// Define the API endpoint for file uploads
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // Load the uploaded CSV file into memory
    const jsonArray = await csv().fromFile(req.file.path);

    // Eliminate blank rows
    const filteredArray = jsonArray.filter((row) => Object.values(row).some((value) => value));

    // Add a serial number column to each row
    const numberedArray = filteredArray.map((row, index) => ({ Serial: index + 1, ...row }));

    // Convert the data to an XLSX file
    const worksheet = XLSX.utils.json_to_sheet(numberedArray);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    const xlsxFile = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Generate a pie chart of the gender ratio
    const maleCount = numberedArray.filter((row) => row.Gender === 'M').length;
    const femaleCount = numberedArray.filter((row) => row.Gender === 'F').length;
    const total = maleCount + femaleCount;
    const canvas = Canvas.createCanvas(400, 400);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 400, 400);
    context.fillStyle = '#00f';
    context.beginPath();
    context.moveTo(200, 200);
    context.arc(200, 200, 200, 0, (Math.PI * 2 * maleCount) / total, false);
    context.lineTo(200, 200);
    context.fill();
    context.fillStyle = '#f00';
    context.beginPath();
    context.moveTo(200, 200);
    context.arc(200, 200, 200, (Math.PI * 2 * maleCount) / total, Math.PI * 2, false);
    context.lineTo(200, 200);
    context.fill();
    const pngFile = canvas.toBuffer();

    // Write the XLSX and PNG files to disk
    const xlsxPath = `public/${req.file.originalname.replace('.csv', '.xlsx')}`;
    await writeFileAsync(xlsxPath, xlsxFile);
    const pngPath = `public/${req.file.originalname.replace('.csv', '.png')}`;
    await writeFileAsync(pngPath, pngFile);

    // Remove the uploaded CSV file from disk
    await unlinkAsync(req.file.path);

    // Send the file URLs back in the API response
    res.json({
      xlsxUrl: `http://localhost:3000/${xlsxPath}`,
      pngUrl: `http://localhost:3000/${pngPath}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// Start the server
app.listen(3000, () => console.log('Server started on 3000'));
