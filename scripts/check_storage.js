import fs from 'fs';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';

try {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const token = config.tokens?.access_token;
  if (!token) {
    throw new Error('Access token not found in firebase-tools.json');
  }
  
  console.log("Got Firebase CLI token successfully!");
  
  const bucketName = 'canvasgame-2025.firebasestorage.app'; // or 'canvasgame-2025.appspot.com'
  const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  if (data.error) {
    console.log("Error response from storage API:", data.error);
    // Let's try the other bucket name 'canvasgame-2025.appspot.com'
    const url2 = `https://storage.googleapis.com/storage/v1/b/canvasgame-2025.appspot.com/o`;
    const response2 = await fetch(url2, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data2 = await response2.json();
    console.log("Second bucket response:", JSON.stringify(data2, null, 2).substring(0, 1500));
  } else {
    console.log("Storage Files:", JSON.stringify(data, null, 2).substring(0, 1500));
  }
} catch (e) {
  console.error("Error fetching storage:", e);
}
