import pg from 'pg';
import { readFileSync } from 'node:fs';
const {password}=JSON.parse(readFileSync('.local/database.json','utf8'));
const client=new pg.Client({host:'127.0.0.1',port:15432,user:'gehna',password,database:'postgres'});
await client.connect();
const {rows}=await client.query("SELECT 1 FROM pg_database WHERE datname='gehna_store'");
if(!rows.length)await client.query("CREATE DATABASE gehna_store ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0");
console.log('UTF-8 store database ready.');await client.end();
