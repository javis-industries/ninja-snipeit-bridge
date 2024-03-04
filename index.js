const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const http = require('http')
const sqlite3 = require('sqlite3').verbose();

// Read secrets from the file
const secretsPath = path.join(__dirname, 'secrets.json');
const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
const snipeItURL = secrets.snipeItURL;

const app = express();
const port = 3000;

const conn = new sqlite3.Database('./SQL/NinjaSnipeITBridge.db');

// let ninjaDevices;
let manufacturers  = [];
let models = [];
let organizations = [];
let snipeitDevices;

app.use(express.json());

// Main page load for content with refresh button

app.get('/', (req, res) => {
  res.send(`<div>
              <h1>Click to Refresh Devices</h1>
              <button onclick="triggerRefresh()" type="button">Refresh!</button>
              <script>
                function triggerRefresh() {
                  fetch('http://localhost:3000/trigger-refresh')
                  .then(response => response.text())
                  .then(data => console.log(data))
                  .catch(error => console.error('Error:', error));
                }
              </script>
            <div>`);
});

// API Endpoint for refreshing manually, this may not be used in the future.

app.get('/refresh', (req, res) => {
  res.send('Refresh triggered!')
  console.log('Refreshing...')
  update();
})

// Page for manually refreshing from button

app.get('/trigger-refresh', (req, res) => {
  update();
  res.send('Refresh triggered!');
});

// Cron schedule for automatically running every 5 minutes

cron.schedule('*/5 * * * *', () => {
  
  update();
  console.log('Scheduled refresh executed!');
});


// Function to kick off all updates
function update() { 

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
    // console.log(data);
    // getManufacturers(data);
    loadOrgs(data);
    // loadNinjaDevices(data);

    console.log("Refreshing...")
  })
  .catch((error) => console.error('Error:', error));
}

function loadOrgs(values) {
  const url = 'https://app.ninjarmm.com/v2/organizations';
  const options = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${values.token_type} ${values.access_token}`,
    },
  };

  fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} + " " + ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {

      updateCompanies(data);

    })
    .catch((error) => console.error('Error:', error));
}

function updateCompanies(orgs) {

  const url = `${snipeItURL}/api/v1/companies`;

  orgs.forEach((org) => {
      console.log(org.name);
      // if(!checkOrgExists(org.name)) {
      setTimeout(() => {
          fetch(url, {
              method: 'POST',
              headers: {
                  Accept: 'application/json',
                  Authorization: `Bearer ${secrets.snipeitsecret}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  name: org.name
              }),
              timeout: 10000
          })
          .then((response) => {
              if (!response.ok) {
                  throw new Error(`HTTP error! Status: ${response.status} + " " + ${response.statusText}`);
              }

              return response.json();
          })
          .then((data) => {
              if (!checkOrgExists(org.name)) {
                conn.run(
                    'INSERT INTO organizations (orgid, name) VALUES (?, ?)', [org.id, org.name], function (err) {
                        if (err) {
                            console.error(err.message);
                        }
                    }
                );
              }
          })
          .catch((error) => console.error('Error:', error));
      });
  });
}




function checkOrgExists(org) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS count FROM organizations WHERE name = ?`;

    conn.get(query, [org], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row.count > 0);
    });
  });
}



// Grabbing all ninja devices and 

function loadNinjaDevices(values) {
  const url = 'https://app.ninjarmm.com/v2/devices-detailed';
  const options = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${values.token_type} ${values.access_token}`,
    },
  };

  fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} + " " + ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      // ninjaDevices = data;
      
      // console.log(manufacturers);
      getManufacturers(data);
      // addToSnipeIT(ninjaDevices);

    })
    .catch((error) => console.error('Error:', error));
  
}

// Function that gets all manufacturers from Ninja and write them to snipeIT
// *** Might break out into two functions ***

function getManufacturers(data) {
  data.forEach(device => {

    // console.log(device.system.name);

    if(device.system === undefined || device.system === null) {
      // console.log("Unknown")
    } else {
      // console.log(device.system.manufacturer);
      if(!(manufacturers.includes(device.system.manufacturer)) && device.system.manufacturer !== undefined) {
        if((device.system.manufacturer === 'To Be Filled By O.E.M.') || (device.system.manufacturer === '')) {
          if(!manufacturers.includes('UNKNOWN')) {
            manufacturers.push('UNKNOWN')
          }
        } else {
          manufacturers.push(device.system.manufacturer)
        }
      }
    }
        
  })
  // Write manufacturers to snipeit
  updateManufacturers()
}

// updates manufacturers in SnipeIT
function updateManufacturers() {

  const url1 = `${snipeItURL}/api/v1/manufacturers`;
  
  manufacturers.forEach(manufacturer => {
    if(!checkManufacturerExists(manufacturer)) {
      fetch(url1, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${secrets.snipeitsecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: manufacturer
        })
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Statis: ${response.status} + " " + ${response.statusText}`)
        }
        return response.json();
      })
    }
  })   

  refreshManufacturers();
}

// Function to check if manufacturer exists in local cached database
// Returns true if found in Manufacturers table

function checkManufacturerExists(manufacturer) {
  return new Promise((resolve, reject) => {
    const query = `SELECT COUNT(*) AS count FROM manufacturers WHERE name = ?`;

    conn.get(query, [manufacturer], (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row.count > 0);
    });
  });
}

// Function that gets all manufacturers from SnipeIT and writes them to database

function refreshManufacturers() {

  const url = `${snipeItURL}/api/v1/manufacturers`;
  const options = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${secrets.snipeitsecret}`
    }
  }

  fetch(url, options)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! Statis: ${response.status} + " " + ${response.statusText}`)
    }
    return response.json();
    })
  .then((data) => {
    data.rows.forEach(manufacturer => {

      if(!checkManufacturerExists(manufacturer)) {
        console.log(manufacturer.name + " " + manufacturer.id)
        conn.run(
          'INSERT INTO manufacturers (manufacturerId, name) VALUES (?, ?)', [manufacturer.id, manufacturer.name], function (err) {
            if (err) {
              console.error(err.message);
            }
          }
        );
      }
    })
  })
}

// Function that gets all models from Ninja

function getModels(values) {
  const url = 'https://app.ninjarmm.com/v2/devices-detailed';
  const options = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${values.token_type} ${values.access_token}`,
    },
  };

  fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} + " " + ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      ninjaDevices = data;
      // console.log(ninjaDevices);
      ninjaDevices.forEach(device => {

        // console.log(device.system.name);

        if(device.system === undefined || device.system === null) {
          // console.log("Unknown")
        } else {
          // console.log(device.system.manufacturer);
          if(!(models.includes(device.system.model)) && device.system.model !== undefined) {
            if((device.system.model === '')) {
              if(!models.includes('UNKNOWN')) {
                models.push('UNKNOWN')
              }
            } else {
              models.push(device.system.model)
            }
          }
        }
        
      })
      console.log(models);
      // addToSnipeIT(ninjaDevices);

    })
    .catch((error) => console.error('Error:', error));

  // const url1 = `${snipeItURL}/api/v1/manufacturers`;
  
  // manufacturers.forEach(manufacturer => {
  //   fetch(url1, {
  //     method: 'POST',
  //     headers: {
  //       Accept: 'application/json',
  //       Authorization: `Bearer ${secrets.snipeitsecret}`,
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify({
  //       name: manufacturer
  //     })
  //   })
  //   .then((response) => {
  //     if (!response.ok) {
  //       throw new Error(`HTTP error! Statis: ${response.status} + " " + ${response.statusText}`)
  //     }
  //     refreshManufacturers();
  //     return response.json();
  //     })
  // })   
}

function updateModels() {

}


// Returns all detailed information about all ninja devices

function getDevices(values) {
  const url = 'https://app.ninjarmm.com/v2/devices-detailed';
  const options = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${values.token_type} ${values.access_token}`,
    },
  };

  const url1 = `${snipeItURL}/api/v1/hardware`;
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
      // console.log(ninjaDevices);
      ninjaDevices.forEach(device => {

        // console.log(device.system.name);

        if(device.system === undefined || device.system === null) {
          // console.log("Unknown")
        } else {
          // console.log(device.system.manufacturer);
          if(!(manufacturers.includes(device.system.manufacturer)) && device.system.manufacturer !== undefined) {
            if((device.system.manufacturer === 'To Be Filled By O.E.M.') || (device.system.manufacturer === '')) {
              if(!manufacturers.includes('UNKNOWN')) {
                manufacturers.push('UNKNOWN')
              }
            } else {
              manufacturers.push(device.system.manufacturer)
            }
          }
        }
        
      })
      console.log(manufacturers);
      // addToSnipeIT(ninjaDevices);

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
    // console.log(snipeitDevices);

  })
}

// Adds a device to SnipeIT

function addToSnipeIT() {
  const url = `${snipeItURL}/api/v1/hardware`;
  const options = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${secrets.snipeitsecret}`,
      'content-type': 'application/json'
    }
  }

  fetch(url, options)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! Statis: ${response.status} + " " + ${response.statusText}`)
    }
    return response.json();
  })
  .then((data) => {
    snipeitDevices = data;
    // console.log(snipeitDevices);

  })
}

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

app.listen(port, () => {
  console.log('Server Running on port ' + port + '...');
})