$files = Get-ChildItem src/modules/routes/*.js
foreach ($file in $files) {
    $c = Get-Content $file.FullName -Raw
    
    # Replace require with import
    $c = $c -replace 'const \{ success, error \} = require\("\.\./utils/response"\);', 'import { success, error } from "../utils/response.js";'
    $c = $c -replace 'const \{ verifyToken \} = require\("\.\./utils/jwt"\);', 'import { verifyToken } from "../utils/jwt.js";'
    $c = $c -replace 'const \{ getCorsHeaders \} = require\("\.\./utils/cors"\);', 'import { getCorsHeaders } from "../utils/cors.js";'
    $c = $c -replace 'const \{ signToken, verifyToken \} = require\("\.\./utils/jwt"\);', 'import { signToken, verifyToken } from "../utils/jwt.js";'
    $c = $c -replace 'const \{ sendTelegramMessage \} = require\("\.\./utils/telegram"\);', 'import { sendTelegramMessage } from "../utils/telegram.js";'
    $c = $c -replace 'const \{ saveToGoogleDrive \} = require\("\.\./utils/google"\);', 'import { saveToGoogleDrive } from "../utils/google.js";'
    $c = $c -replace 'const bcrypt = require\("bcryptjs"\);', 'import bcrypt from "bcryptjs";'
    
    # Replace module.exports with export
    $c = $c -replace 'module\.exports = \{ register \};', 'export { register };'
    
    # Remove duplicate signToken imports (keep the combined one)
    $c = $c -replace 'import { signToken, verifyToken } from "../utils/jwt.js";\s*\nimport { verifyToken } from "../utils/jwt.js";', 'import { signToken, verifyToken } from "../utils/jwt.js";'
    $c = $c -replace 'import { signToken } from "../utils/jwt.js";\s*\nimport { verifyToken } from "../utils/jwt.js";', 'import { signToken, verifyToken } from "../utils/jwt.js";'
    
    Set-Content $file.FullName -Value $c -NoNewline
    Write-Host "Fixed: $($file.Name)"
}