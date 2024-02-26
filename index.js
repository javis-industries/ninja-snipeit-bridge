const fs = require('fs');
const path = require('path');

// Read secrets from the file
const secretsPath = path.join(__dirname, 'secrets.json');
const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));

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
  })
  .catch((error) => console.error('Error:', error));

function getDevices(values) {
  const url1 = 'https://app.ninjarmm.com/v2/devices';
  const options1 = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${values.token_type} ${values.access_token}`,
    },
  };

  fetch(url1, options1)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log(data);
    })
    .catch((error) => console.error('Error:', error));
}
