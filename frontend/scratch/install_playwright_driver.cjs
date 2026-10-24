const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
  const targetDir = path.join(localAppData, 'ms-playwright-go', '1.57.0');
  const tempDir = path.join(__dirname, 'pw_driver_temp');

  console.log('Target directory:', targetDir);
  console.log('Temporary working directory:', tempDir);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const tgzPath = path.join(tempDir, 'playwright-core-1.57.0.tgz');
  const downloadUrl = 'https://registry.npmjs.org/playwright-core/-/playwright-core-1.57.0.tgz';

  console.log('Downloading playwright-core@1.57.0 package from npm registry...');
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tgzPath);
    https.get(downloadUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: status ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', reject);
  });

  console.log('Downloaded tgz to:', tgzPath, `(${fs.statSync(tgzPath).size} bytes)`);

  console.log('Extracting package...');
  execSync(`tar.exe -xzf "${tgzPath}" -C "${tempDir}"`, { stdio: 'inherit' });

  const extractedPkg = path.join(tempDir, 'package');
  if (!fs.existsSync(extractedPkg)) {
    throw new Error('Extracted package directory not found!');
  }

  const targetPkg = path.join(targetDir, 'package');
  console.log(`Copying package to target: ${targetPkg}...`);
  if (fs.existsSync(targetPkg)) {
    fs.rmSync(targetPkg, { recursive: true, force: true });
  }
  fs.cpSync(extractedPkg, targetPkg, { recursive: true });

  // Copy node.exe
  const nodeSrc = process.execPath;
  const nodeDest = path.join(targetDir, 'node.exe');
  console.log(`Copying node executable from ${nodeSrc} to ${nodeDest}...`);
  fs.copyFileSync(nodeSrc, nodeDest);

  // Verify cli.js exists
  const cliJs = path.join(targetPkg, 'cli.js');
  console.log('Checking cli.js entrypoint:', cliJs, fs.existsSync(cliJs) ? 'OK' : 'MISSING');

  // Test execution
  console.log('Testing driver version output:');
  const verOutput = execSync(`"${nodeDest}" "${cliJs}" --version`).toString().trim();
  console.log('Driver output:', verOutput);

  if (verOutput.includes('1.57.0')) {
    console.log('SUCCESS: Playwright driver 1.57.0 is correctly installed and functional!');
  } else {
    console.warn('WARNING: Output does not contain 1.57.0:', verOutput);
  }

  // Install Chromium browser if needed
  console.log('Ensuring Chromium browser is installed permanently...');
  execSync(`"${nodeDest}" "${cliJs}" install chromium`, { stdio: 'inherit' });

  // Cleanup temp
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('All steps completed successfully!');
}

main().catch(err => {
  console.error('Installation failed:', err);
  process.exit(1);
});
