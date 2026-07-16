/**
 * Google API helpers (OAuth, Drive).
 */

export async function getGoogleAccessToken(env) {
  // Use OAuth refresh token (Option B - User Consent)
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_REFRESH_TOKEN;

  if (
    !clientId ||
    !clientSecret ||
    !refreshToken ||
    clientSecret.includes('PASTE_YOUR_') ||
    refreshToken.includes('PASTE_YOUR_')
  ) {
    return null;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = (await res.json() as any);
    return data.access_token || null;
  } catch (e) {
    console.error('Failed to get Google access token:', e.message);
    return null;
  }
}

export async function getOrCreateDriveFolder(token: any, folderName: any, parentFolderId?: any) {
  // Search for existing folder
  const query = encodeURIComponent(
    `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false` +
      (parentFolderId ? ` and '${parentFolderId}' in parents` : '')
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = (await searchRes.json() as any);
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : [],
    }),
  });
  const createData = (await createRes.json() as any);
  return createData.id || null;
}

export async function uploadFileToGoogleDrive(env, fileBlob, filename, clientName, jobId) {
  const token = await getGoogleAccessToken(env);
  if (!token) return null;

  // Get or create the main folder
  const mainFolderId = await getOrCreateDriveFolder(token, 'Awesome Myanmar - Service Records');
  if (!mainFolderId) return null;

  // Get or create client subfolder
  const clientFolderId = await getOrCreateDriveFolder(
    token,
    clientName || 'Unknown Client',
    mainFolderId
  );
  if (!clientFolderId) return null;

  // Get or create job subfolder
  const jobFolderId = await getOrCreateDriveFolder(token, jobId || 'General', clientFolderId);
  if (!jobFolderId) return null;

  // Upload file
  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/related; boundary=boundary123',
      },
      body: [
        `--boundary123\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: filename, parents: [jobFolderId] })}\r\n`,
        `--boundary123\r\nContent-Type: ${fileBlob.type || 'application/octet-stream'}\r\n\r\n`,
        fileBlob,
        `\r\n--boundary123--`,
      ].join(''),
    }
  );
  const uploadData = (await uploadRes.json() as any);
  return uploadData.id || null;
}

export async function uploadBackupToGoogleDrive(env, backupJsonString: string, filename: string) {
  const token = await getGoogleAccessToken(env);
  if (!token) return null;

  const mainFolderId = await getOrCreateDriveFolder(token, 'Awesome Myanmar - Service Records');
  if (!mainFolderId) return null;

  const backupsFolderId = await getOrCreateDriveFolder(token, 'Database Backups', mainFolderId);
  if (!backupsFolderId) return null;

  const metadata = JSON.stringify({
    name: filename,
    parents: [backupsFolderId],
    mimeType: 'application/json'
  });

  const boundary = 'boundary_backup_123';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    backupJsonString +
    closeDelimiter;

  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  const uploadData = (await uploadRes.json() as any);
  return uploadData.id || null;
}
