import {defineConfig} from '@playwright/test';
import chromium from '@sparticuz/chromium';
import {resolve} from 'node:path';
export default defineConfig({
  testDir:'./tests/e2e',workers:1,timeout:120000,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:3100',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:chromium.args.filter(arg=>!['--disable-web-security','--allow-running-insecure-content','--single-process'].includes(arg))},headless:true,reducedMotion:'reduce',trace:'retain-on-failure',ignoreHTTPSErrors:true},
  webServer:[
    {command:'node --import tsx scripts/admin-api-fixture.ts',url:'https://localhost:3444/__health',ignoreHTTPSErrors:true,reuseExistingServer:false,timeout:30000},
    {command:'node scripts/public-api-fixture.mjs',url:'https://localhost:3443/__health',ignoreHTTPSErrors:true,reuseExistingServer:false,timeout:30000},
    {command:'npm run start -- --port 3100',url:'http://127.0.0.1:3100',env:{PUBLIC_INVENTORY_MODE:'snapshot',NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'',SITE_URL:''},reuseExistingServer:false,timeout:120000},
    {command:'npm run start -- --port 3104',url:'http://127.0.0.1:3104',env:{PUBLIC_INVENTORY_MODE:'supabase',PUBLIC_SUPABASE_URL:'https://localhost:3444',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_admin_fixture_only',NEXT_PUBLIC_SUPABASE_URL:'https://localhost:3444',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_admin_fixture_only',MEDIA_STORAGE_SECRET_KEY:'sb_secret_media_fixture_only',BUSINESS_INTAKE_ENABLED:'true',INTAKE_SECRET_KEY:'sb_secret_intake_fixture_only',INTAKE_HASH_SECRET:'local-test-only-intake-hash-secret-32-characters',SITE_URL:'https://dealer.example.test',NODE_EXTRA_CA_CERTS:resolve('.generated/test-tls/cert.pem')},reuseExistingServer:false,timeout:120000},
    {command:'npm run start -- --port 3102',url:'http://127.0.0.1:3102',env:{PUBLIC_INVENTORY_MODE:'supabase',PUBLIC_SUPABASE_URL:'https://localhost:3443',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_only',NEXT_PUBLIC_SUPABASE_URL:'https://localhost:3443',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_only',SITE_URL:'https://dealer.example.test',NODE_EXTRA_CA_CERTS:resolve('.generated/test-tls/cert.pem')},reuseExistingServer:false,timeout:120000},
  ],
});
