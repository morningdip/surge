const re_imgur_links = /<a[^>]*href="(https?:\/\/(?:i\.|m\.)?imgur\.com\/w+\.\w+)"[^>]*>/g;

let modifiedBody = $response.body;

// 使用正則表達式找到並替換 Imgur 的連結
modifiedBody = modifiedBody.replace(re_imgur_links, (match, url) => {
 const imgurIdMatch = url.match(/https?:\/\/(?:i\.|m\.)?imgur\.com\/(\w+)\.?(\w+)?/);
  if (imgurIdMatch) {
    const imgurId = imgurIdMatch[1];
    let imgurSuffix = imgurIdMatch[2] || 'webp';
    if (imgurSuffix === 'gif') {
      imgurSuffix = 'gif'; // 保留 gif
    }
    const imgTag = `<div style="margin-top:0.5em;text-align:center;"><img referrerpolicy="no-referrer" src="https://i.imgur.com/${imgurId}.${imgurSuffix}" /></div>`;
    return match + imgTag; // 在原始連結後插入圖片
  }
 return match;
});

// 返回修改後的 HTML
$done({
  body: modifiedBody
});
