const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const http = require('http')

// Read secrets from the file
const secretsPath = path.join(__dirname, 'secrets.json');
const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));

const app = express();
const port = 3000;

let ninjaDevices;
let snipeitDevices;

app.use(express.json());

app.get('/', (req, res) => {
  res.send(`<button onclick=${refreshFunction()} type="button">Refresh!</button>`);
});

app.get('/refresh', (req, res) => {
  res.send('Refresh triggered!')
  console.log('Refreshing...')
  refreshFunction();
})

cron.schedule('30 * * * *', () => {
  
  refreshFunction();
  console.log('Scheduled refresh executed!');
});


function refreshFunction() {

  const url = 'https://app.ninjarmm.com/ws/oauth/token';
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: secrets.client_id,
      client_secret: secrets.client_secret,
      scope: 'management monitoring',
    }),
  };

  fetch(url, options)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  })
  .then((data) => {
    console.log(data);
    getDevices(data);

    console.log("Refreshing...")
  })
  .catch((error) => console.error('Error:', error));
}


function getDevices(values) {
  const url = 'https://app.ninjarmm.com/v2/devices';
  const options = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${values.token_type} ${values.access_token}`,
    },
  };

  const url1 = 'http://javis-si.javis.local/api/v1/hardware';
  const options1 = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${secrets.snipeitsecret}`
    }
  }

  fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} + " " + ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      ninjaDevices = data;
      console.log(ninjaDevices);
    })
    .catch((error) => console.error('Error:', error));

  fetch(url1, options1)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! Statis: ${response.status} + " " + ${response.statusText}`)
    }
    return response.json();
  })
  .then((data) => {
    snipeitDevices = data;
    console.log(snipeitDevices);
  })
}

app.listen(port, () => {
  console.log('Server Running on port ' + port + '...');
})

function jsonParseNinjaID(ninjaDevices) {
  try {
    const parsedData = JSON.parse(ninjaDevices);
    const ninjaID = [];

    if (parsedData && parsedData.items && Array.isArray(parsedData.items)) {
        parsedData.items.forEach(item => {
            if (typeof item.ID === 'number') {
                ninjaID.push(item.ID);
            } else if (typeof item.ID === 'string' && /^\d+$/.test(item.ID)) {
                ninjaID.push(parseInt(item.ID, 10));
            }
        });
    }

    return ninjaID;
  } catch (error) {
      console.error('Error parsing JSON - ninjaDevices:', error);
      return [];
  }
}