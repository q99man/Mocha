const fs = require('fs');
const path = 'frontend/src/app/styles.css';
let content = fs.readFileSync(path, 'utf8');

// Use regex to match different indentation/newliness
const target = /"Margarine",\s+"Noto Sans KR",/g;
const replacement = '"Margarine",\n    "Jua",\n    "Noto Sans KR",';

const newContent = content.replace(target, replacement);

if (content === newContent) {
    console.log('No matches found. Checking generic version...');
    const target2 = /"Margarine",\s+"Rajdhani",\s+"Noto Sans KR",/g;
    const newContent2 = content.replace(target2, replacement);
    if (content === newContent2) {
        console.log('Still no matches.');
    } else {
        fs.writeFileSync(path, newContent2);
        console.log('Successfully updated styles.css with Jua font (fallback 2).');
    }
} else {
    fs.writeFileSync(path, newContent);
    console.log('Successfully updated styles.css with Jua font.');
}
