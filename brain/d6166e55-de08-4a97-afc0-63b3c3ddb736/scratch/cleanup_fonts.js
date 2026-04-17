const fs = require('fs');

function cleanupFile(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');

    // Remove the 4-line font-family stack I added
    // Indentation might vary, so using regex to catch it
    const stackRegex = /\s+font-family:\s+"Margarine",\s+"Jua",\s+"Noto Sans KR",\s+sans-serif;/g;
    
    // Also catch the single-line versions
    const singleLineRegex = /font-family:\s+"Margarine",\s+"Jua",\s+"Noto Sans KR",\s+sans-serif;/g;

    let newContent = content.replace(stackRegex, '');
    newContent = newContent.replace(singleLineRegex, '');

    if (content !== newContent) {
        fs.writeFileSync(path, newContent);
        console.log(`Successfully cleaned up redundant fonts in ${path}`);
    } else {
        console.log(`No redundant fonts found in ${path}`);
    }
}

cleanupFile('frontend/src/app/styles.css');
cleanupFile('frontend/src/app/landing.css');
