import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,NEXT_PUBLIC_DEMO_MODE:'true',NEXT_PUBLIC_SAMPLE_CATALOG:'true',NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY:'',NEXT_PUBLIC_MEDUSA_REGION_ID:''}});
process.exit(result.status??1);
