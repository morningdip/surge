/*
[Script]
http-request ^https:?//shopee\.tw/me/setting max-size=0,script-path=shopee_getcookie.js
[MITM]
hostname= shopee.tw
*/

if ($request.headers['Cookie']) {
    var headerSP = $request.headers['Cookie'];
    var cookie = $persistentStore.write(headerSP, "CookieSP");
    if (!cookie) {
      $notification.post("Shopee Cookie", "", "Error! Try again later")
    } else {
      $notification.post("Shopee Cookie", "", "Get cookie!")
    }
} else {
    $notification.post("Shopee Cookie", "", "Error! Try again later")
}

$done({})
