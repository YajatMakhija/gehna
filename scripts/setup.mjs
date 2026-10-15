import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
mkdirSync('.local',{recursive:true});
if(!existsSync('.local/database.json'))writeFileSync('.local/database.json',JSON.stringify({password:randomBytes(24).toString('hex')}));
if(!existsSync('backend/.env')){const {password}=JSON.parse(readFileSync('.local/database.json','utf8'));const contents=readFileSync('backend/.env.example','utf8').replace('CHANGE_ME',password).replace('REPLACE_WITH_RANDOM_SECRET',randomBytes(48).toString('hex')).replace('REPLACE_WITH_RANDOM_SECRET',randomBytes(48).toString('hex'));writeFileSync('backend/.env',contents);}
console.log('Local environment prepared without overwriting existing credentials.');
