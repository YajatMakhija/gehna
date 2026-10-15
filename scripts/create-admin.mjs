import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const path='.local/admin-credentials.json';
const credentials=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{email:'owner@gehna.local',password:randomBytes(18).toString('base64url')};
if(!existsSync(path))writeFileSync(path,JSON.stringify(credentials,null,2));
const r=spawnSync(process.execPath,[resolve('backend/node_modules/@medusajs/cli/cli.js'),'user','-e',credentials.email,'-p',credentials.password],{cwd:resolve('backend'),env:{...process.env,MEDUSA_DISABLE_TELEMETRY:'true'},encoding:'utf8'});
if(r.status!==0){console.error((r.stderr||r.stdout).replaceAll(credentials.password,'[redacted]'));process.exit(r.status||1);}
console.log('Local owner account is ready. Credentials are saved in .local/admin-credentials.json (ignored by Git).');
