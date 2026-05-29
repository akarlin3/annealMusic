const fs = require('fs');
const path = require('path');

const pbxprojPath = path.join(
  __dirname,
  '../ios/App/App.xcodeproj/project.pbxproj',
);
if (!fs.existsSync(pbxprojPath)) {
  console.error(`Error: pbxproj file not found at ${pbxprojPath}`);
  process.exit(1);
}

let content = fs.readFileSync(pbxprojPath, 'utf8');

// 1. Check if the block definition is already there
if (content.includes('504EC3001FED79650016851A /* Run Script */ = {')) {
  console.log(
    'Version sync build phase block already exists in project.pbxproj.',
  );
  process.exit(0);
}

// 2. Define the PBXShellScriptBuildPhase section
const shellScriptSection = `/* Begin PBXShellScriptBuildPhase section */
\t\t504EC3001FED79650016851A /* Run Script */ = {
\t\t\tisa = PBXShellScriptBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\tinputFileListPaths = (
\t\t\t);
\t\t\tinputPaths = (
\t\t\t);
\t\t\tname = "Sync Version from package.json";
\t\t\toutputFileListPaths = (
\t\t\t);
\t\t\toutputPaths = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t\tshellPath = /bin/sh;
\t\t\tshellScript = "VERSION=\\$(node -p \\"require('../../package.json').version\\")\\nCOMMIT_COUNT=\\$(git rev-list --count HEAD)\\n/usr/libexec/PlistBuddy -c \\"Set :CFBundleShortVersionString \\$VERSION\\" \\"\\$PROJECT_DIR/\\$INFOPLIST_PATH\\"\\n/usr/libexec/PlistBuddy -c \\"Set :CFBundleVersion \\$COMMIT_COUNT\\" \\"\\$PROJECT_DIR/\\$INFOPLIST_PATH\\"\\n";
\t\t};
/* End PBXShellScriptBuildPhase section */\n\n`;

// 3. Insert the PBXShellScriptBuildPhase section
if (content.includes('/* Begin PBXSourcesBuildPhase section */')) {
  content = content.replace(
    '/* Begin PBXSourcesBuildPhase section */',
    shellScriptSection + '/* Begin PBXSourcesBuildPhase section */',
  );
} else {
  console.error(
    'Could not find PBXSourcesBuildPhase section to insert shell script.',
  );
  process.exit(1);
}

// 4. Ensure the target has the build phase in its list
const targetBlock = '504EC3031FED79650016851F /* App */ = {';
const buildPhasesStart = 'buildPhases = (';

const targetIdx = content.indexOf(targetBlock);
if (targetIdx !== -1) {
  const buildPhasesIdx = content.indexOf(buildPhasesStart, targetIdx);
  if (buildPhasesIdx !== -1) {
    const insertIdx = buildPhasesIdx + buildPhasesStart.length;
    // Check if it already has the build phase ID
    const searchRange = content.substring(insertIdx, insertIdx + 300);
    if (!searchRange.includes('504EC3001FED79650016851A')) {
      content =
        content.slice(0, insertIdx) +
        '\n\t\t\t\t504EC3001FED79650016851A /* Run Script */,' +
        content.slice(insertIdx);
    }
  }
}

fs.writeFileSync(pbxprojPath, content, 'utf8');
console.log('Successfully added version sync build phase to project.pbxproj.');
