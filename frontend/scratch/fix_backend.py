import os

path = r'C:\SpringWork\Mocha\backend\src\main\java\com\motionchallenge\board\repository\BoardPostRepository.java'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_text = '                    select count(post)\n                    from BoardPost post\n                    where (:category is null'
new_text = '                    select count(post)\n                    from BoardPost post\n                    join post.member\n                    where (:category is null'

if old_text in content:
    new_content = content.replace(old_text, new_text)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated BoardPostRepository.java")
else:
    print("Could not find the target text. Checking for variations...")
    # Try with \r\n
    old_text_rn = old_text.replace('\n', '\r\n')
    if old_text_rn in content:
        new_text_rn = new_text.replace('\n', '\r\n')
        new_content = content.replace(old_text_rn, new_text_rn)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Successfully updated BoardPostRepository.java (with CRLF)")
    else:
        print("Failed to find target text even with CRLF.")
